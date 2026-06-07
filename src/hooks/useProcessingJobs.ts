import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSession } from './useSession'

export type ProcessingKind =
  | 'reflections'
  | 'scripture'
  | 'altar_harvest'
  | 'altar_embed'
  | 'altar_thread'

export interface ProcessingJob {
  kind: ProcessingKind
  status: 'queued' | 'running' | 'done' | 'failed'
  completed: number
  total: number
}

export interface ProcessingState {
  byKind: Partial<Record<ProcessingKind, ProcessingJob>>
  anyActive: boolean
}

interface JobRow {
  kind: ProcessingKind
  status: ProcessingJob['status']
  completed: number
  total: number
}

const SELECT = 'kind,status,completed,total'

export function isActive(status: string): boolean {
  return status === 'queued' || status === 'running'
}

/**
 * Live view of the current owner's processing_jobs (the import backfill engine),
 * via Supabase Realtime. Surfaces read this to show honest PROCESSING progress
 * instead of a blank "empty" state while an archive is still being built.
 */
export function useProcessingJobs(): ProcessingState {
  const { session } = useSession()
  const owner = session?.user?.id ?? null
  const [byKind, setByKind] = useState<Partial<Record<ProcessingKind, ProcessingJob>>>({})

  useEffect(() => {
    const sb = supabase
    if (!sb || !owner) {
      setByKind({})
      return
    }
    let alive = true

    const reduce = (rows: JobRow[]) => {
      const map: Partial<Record<ProcessingKind, ProcessingJob>> = {}
      for (const r of rows) {
        const existing = map[r.kind]
        // Prefer an active row over a stale done/failed one for the same kind.
        if (!existing || (isActive(r.status) && !isActive(existing.status))) {
          map[r.kind] = r
        }
      }
      if (alive) setByKind(map)
    }

    const refetch = () => {
      void sb
        .from('processing_jobs')
        .select(SELECT)
        .eq('owner', owner)
        .then(({ data }) => {
          if (data) reduce(data as JobRow[])
        })
    }

    refetch()

    const channel = sb
      .channel(`processing_jobs:${owner}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'processing_jobs', filter: `owner=eq.${owner}` },
        refetch,
      )
      .subscribe()

    return () => {
      alive = false
      void sb.removeChannel(channel)
    }
  }, [owner])

  const anyActive = Object.values(byKind).some((j) => j != null && isActive(j.status))
  return { byKind, anyActive }
}
