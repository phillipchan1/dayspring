// The state behind Remember: what has been set apart, and marking it.
//
// Kept out of JournalScreen deliberately — that file is already 1,800 lines, and
// this is self-contained: it reads the cached corpus, derives passages, and owns
// the mark round trip.
//
// Everything reads the IndexedDB cache rather than the network, the same
// contract Find has (features/remember/findLocal.ts). Remember opens on a plane.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { cacheGetAll } from '@/lib/db'
import { supabase } from '@/lib/supabase'
import { addMark, listMarks, pullMarks, removeMark, type Mark } from '@/lib/marks'
import { collectPassages, type DeclaredRow, type Passage } from '@/lib/remember'
import type { Entry } from '@/lib/types'

export interface UseRemember {
  /** Everything set apart, newest first. */
  passages: Passage[]
  /** All marks, for the editor decoration. */
  marks: Mark[]
  /** False until the first read finishes — distinguishes "loading" from "empty". */
  ready: boolean
  /** Marks on one entry. */
  marksFor: (entryId: string) => Mark[]
  toggleMark: (entryId: string, quote: string, charStart: number, existing: Mark | null) => void
}

/**
 * Writer-declared prayers only.
 *
 * `spiritual_items` also holds ~6k rows the Altar's model harvested
 * (source = 'scanned'). Those are inferences, and showing an inference as
 * something the writer set apart would be the app asserting significance it
 * decided on — Principle 1 and 4. The filter is `.is('source', null)`, and it is
 * load-bearing: dropping it silently fills Remember with machine output.
 */
async function fetchDeclaredPrayers(): Promise<DeclaredRow[]> {
  const sb = supabase
  if (!sb) return []
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) return []

  const { data, error } = await sb
    .from('spiritual_items')
    .select('entry_id, created_at, content, source')
    .eq('owner', session.user.id)
    .is('source', null)
    .in('type', ['prayer', 'sense'])
    .not('entry_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return []

  return (data ?? []).map((r: Record<string, unknown>) => ({
    entry_id: String(r.entry_id),
    created_at: String(r.created_at),
    text: String(r.content ?? ''),
    source: (r.source as string | null) ?? null,
  }))
}

/**
 * @param surfaceOpen  Remember is on screen. Gates the expensive half.
 *
 * The two loads are split on purpose. Marks are a small store and the editor
 * needs them to draw its decoration, so they load always. Deriving passages
 * needs the WHOLE corpus out of IndexedDB — 3,500 rows on a real archive — and
 * only Remember itself needs that, so it waits until the surface opens. Doing
 * both at boot would put a multi-thousand-row read on the path to the editor,
 * which Principle 3 doesn't allow.
 */
export function useRemember(surfaceOpen: boolean): UseRemember {
  const [entries, setEntries] = useState<Entry[]>([])
  const [marks, setMarks] = useState<Mark[]>([])
  const [prayers, setPrayers] = useState<DeclaredRow[]>([])
  const [ready, setReady] = useState(false)

  const reloadMarks = useCallback(async () => {
    setMarks(await listMarks())
  }, [])

  // Cheap, and needed by the editor whether or not the surface is open.
  useEffect(() => {
    let alive = true
    void (async () => {
      const local = await listMarks()
      if (alive) setMarks(local)
      await pullMarks().catch(() => {})
      if (alive) await reloadMarks()
    })()
    return () => {
      alive = false
    }
  }, [reloadMarks])

  useEffect(() => {
    if (!surfaceOpen) return
    let alive = true
    void (async () => {
      // The local read settles the surface; the network pull refines it.
      // Remember must render before any round trip returns.
      const all = await cacheGetAll()
      if (!alive) return
      setEntries(all)
      setReady(true)
      const p = await fetchDeclaredPrayers()
      if (alive) setPrayers(p)
    })()
    return () => {
      alive = false
    }
  }, [surfaceOpen])

  const passages = useMemo(
    () =>
      collectPassages(
        entries,
        marks.map((m) => ({ entry_id: m.entryId, quote: m.quote, noticed_at: m.noticedAt })),
        prayers,
      ),
    [entries, marks, prayers],
  )

  const byEntry = useMemo(() => {
    const m = new Map<string, Mark[]>()
    for (const mark of marks) {
      const list = m.get(mark.entryId)
      if (list) list.push(mark)
      else m.set(mark.entryId, [mark])
    }
    return m
  }, [marks])

  const marksFor = useCallback((entryId: string) => byEntry.get(entryId) ?? [], [byEntry])

  const toggleMark = useCallback(
    (entryId: string, quote: string, charStart: number, existing: Mark | null) => {
      void (async () => {
        if (existing) await removeMark(existing.id)
        else await addMark(entryId, quote, charStart)
        await reloadMarks()
      })()
    },
    [reloadMarks],
  )

  return { passages, marks, ready, marksFor, toggleMark }
}
