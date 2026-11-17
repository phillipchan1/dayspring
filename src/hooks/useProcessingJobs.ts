import { useEffect, useRef, useState } from 'react'
import { apiGet } from '@/lib/api'
import { isPresent, onPresenceResume } from '@/lib/presence'
import { useSession } from './useSession'

export type ProcessingKind =
  | 'reflections'
  | 'scripture'
  | 'altar_harvest'
  | 'altar_embed'
  | 'altar_thread'
  | 'gather'

export interface ProcessingJob {
  kind: ProcessingKind
  status: 'queued' | 'running' | 'done' | 'failed'
  completed: number
  total: number
  updatedAt: string
}

export type ProcessingPhase = 'idle' | 'active' | 'complete'

export interface ProcessingState {
  byKind: Partial<Record<ProcessingKind, ProcessingJob>>
  anyActive: boolean
  /** Aggregate progress across all known jobs (0–100), for the global banner. */
  overallPct: number
  /**
   * 'active' = work in flight; 'complete' = there were jobs and they've all
   * finished (so we can celebrate); 'idle' = nothing to show.
   */
  phase: ProcessingPhase
  /**
   * A stable id for the CURRENT completion (latest job updated_at), or null while
   * active/idle. Persist this when the user dismisses the "done" banner so it
   * stays dismissed across restarts — and a fresh import (newer key) re-celebrates.
   */
  completionKey: string | null
  /** Rough minutes remaining from observed throughput, or null until measurable. */
  etaMinutes: number | null
}

interface JobRow {
  kind: ProcessingKind
  status: ProcessingJob['status']
  completed: number
  total: number
  updated_at: string
}

/** Fast poll only while a job is queued/running. */
export const JOB_POLL_ACTIVE_MS = 4_000
/**
 * Slow poll once nothing is in flight — and only while someone is present
 * (presence.ts): an idle window must not keep the database awake.
 */
export const JOB_POLL_IDLE_MS = 45_000

export function isActive(status: string): boolean {
  return status === 'queued' || status === 'running'
}

/**
 * Live view of the current owner's processing_jobs (the import backfill engine),
 * via Worker polling. Surfaces read this to show honest PROCESSING progress
 * instead of a blank "empty" state while an archive is still being built.
 */
export function useProcessingJobs(): ProcessingState {
  const { session } = useSession()
  const owner = session?.user?.id ?? null
  const [byKind, setByKind] = useState<Partial<Record<ProcessingKind, ProcessingJob>>>({})
  const anyActiveRef = useRef(false)

  useEffect(() => {
    if (!owner) {
      setByKind({})
      return
    }
    let alive = true
    let timeout: ReturnType<typeof setTimeout> | null = null

    const reduce = (rows: JobRow[]) => {
      const map: Partial<Record<ProcessingKind, ProcessingJob>> = {}
      for (const r of rows) {
        const job: ProcessingJob = {
          kind: r.kind,
          status: r.status,
          completed: r.completed,
          total: r.total,
          updatedAt: r.updated_at,
        }
        const existing = map[r.kind]
        // Prefer an active row over a stale done/failed one for the same kind.
        if (!existing || (isActive(r.status) && !isActive(existing.status))) {
          map[r.kind] = job
        }
      }
      if (alive) setByKind(map)
      anyActiveRef.current = Object.values(map).some((j) => j && isActive(j.status))
    }

    const refetch = async () => {
      try {
        const data = await apiGet<{ jobs: JobRow[] }>('/api/data/jobs')
        if (data.jobs) reduce(data.jobs)
      } catch {
        /* offline — keep the last snapshot */
      }
    }

    const schedule = () => {
      if (!alive) return
      if (timeout) clearTimeout(timeout)
      const ms = anyActiveRef.current ? JOB_POLL_ACTIVE_MS : JOB_POLL_IDLE_MS
      timeout = setTimeout(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          schedule()
          return
        }
        // Nothing in flight and nobody here: wait. The first input after the
        // idle stretch refetches (onPresenceResume below).
        if (!anyActiveRef.current && !isPresent()) {
          schedule()
          return
        }
        void refetch().then(schedule)
      }, ms)
    }

    const onFocus = () => {
      void refetch().then(schedule)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus()
    }

    void refetch().then(schedule)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    const offResume = onPresenceResume(onFocus)

    return () => {
      alive = false
      offResume()
      if (timeout) clearTimeout(timeout)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [owner])

  const jobs = Object.values(byKind).filter((j): j is ProcessingJob => j != null)
  const anyActive = jobs.some((j) => isActive(j.status))
  const totalSum = jobs.reduce((s, j) => s + j.total, 0)
  const doneSum = jobs.reduce((s, j) => s + Math.min(j.completed, j.total), 0)
  const overallPct = totalSum > 0 ? Math.min(100, Math.round((doneSum / totalSum) * 100)) : 0

  // ETA from observed throughput: average rate since we first saw it active.
  // Resets when work stops or progress regresses (e.g. a mid-flight reorder).
  const startRef = useRef<{ t: number; done: number } | null>(null)
  let etaMinutes: number | null = null
  if (anyActive && totalSum > 0) {
    const now = Date.now()
    if (!startRef.current || doneSum < startRef.current.done) {
      startRef.current = { t: now, done: doneSum }
    }
    const dt = (now - startRef.current.t) / 1000
    const dDone = doneSum - startRef.current.done
    if (dt > 30 && dDone > 0) {
      const secs = (totalSum - doneSum) / (dDone / dt)
      const mins = secs / 60
      // Round to the nearest 5 once it's more than ~10 min, to avoid false precision.
      etaMinutes = mins >= 10 ? Math.round(mins / 5) * 5 : Math.max(1, Math.round(mins))
    }
  } else {
    startRef.current = null
  }

  // Completion = there WERE jobs and every one has finished cleanly (no active,
  // no failures). A failed step doesn't get a celebration.
  const allDone = jobs.length > 0 && jobs.every((j) => j.status === 'done')
  const phase: ProcessingPhase = jobs.length === 0 ? 'idle' : anyActive ? 'active' : allDone ? 'complete' : 'idle'
  const completionKey = phase === 'complete'
    ? jobs.reduce((latest, j) => (j.updatedAt > latest ? j.updatedAt : latest), '')
    : null

  return { byKind, anyActive, overallPct, phase, completionKey, etaMinutes }
}
