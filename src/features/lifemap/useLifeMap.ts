// Loading and writing the Life Map.
//
// The read layer (`lifeMap.ts`) is pure; this is the half that talks to the
// database. It keeps its own Concordance query rather than reusing
// `listConcordance()`, for one reason: that query excludes `dormant`, and the
// Life Map must not. See `retired()` — dormant is recency, and on a fifteen-year
// archive it is most of the people in it.

import { useCallback, useEffect, useState } from 'react'
import { requireSupabase } from '@/lib/supabase'
import type { ConcordanceItem } from '@/lib/concordance'
import { listKeptSubjects, dropSubject, type KeptSubject } from '@/features/pages/keptSubjects'
import { buildLifeMap, floorFor, type LifeMapItem, type LifeMapSection, type SectionId } from './lifeMap'

const COLUMNS =
  'id, kind, canonical, surface_forms, descriptor, status, source, occurrence_count, first_seen, last_seen'

/**
 * The Concordance rows this surface offers.
 *
 * Everything except `superseded`, above the floor — and anything the writer has
 * already answered regardless of the floor, because a kept name must never
 * vanish for going quiet.
 */
async function listForLifeMap(floor: number): Promise<ConcordanceItem[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('concordance')
    .select(COLUMNS)
    .neq('status', 'superseded')
    .or(`occurrence_count.gte.${floor},status.eq.confirmed,source.eq.explicit,source.eq.correction`)
    .order('canonical', { ascending: true })
  if (error) throw error
  return (data ?? []) as ConcordanceItem[]
}

/**
 * Pages in the archive, for the floor.
 *
 * `head: true` so this is a count and never a download — the floor needs one
 * integer, not three thousand rows.
 */
async function pageCount(): Promise<number> {
  const sb = requireSupabase()
  const { count, error } = await sb.from('entries').select('id', { count: 'exact', head: true })
  if (error) throw error
  return count ?? 0
}

export interface LifeMap {
  sections: LifeMapSection[]
  /** Stated on screen. The list is short by a rule the reader can see. */
  floor: number
  pages: number
}

export async function loadLifeMap(): Promise<LifeMap> {
  const pages = await pageCount()
  const floor = floorFor(pages)
  const [concordance, kept] = await Promise.all([listForLifeMap(floor), listKeptSubjects()])
  return { sections: buildLifeMap(concordance, kept, floor), floor, pages }
}

/**
 * Keep — the writer answering "yes, that one".
 *
 * Writes `kind` alongside, which `keepSubject()` does not: a typed subject has
 * no Concordance row to carry its kind, so without this "Vera" typed into People
 * would land nowhere. Rows from the Concordance carry theirs already and pass
 * null.
 */
export async function keepItem(item: LifeMapItem): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('kept_subjects').upsert(
    {
      subject_key: item.key,
      label: item.label,
      terms: item.terms,
      kind: item.key.startsWith('word:') ? item.section : null,
    },
    { onConflict: 'owner,subject_key' },
  )
  if (error) throw error
}

/** What the writer typed into one of the four boxes. */
export async function addTyped(raw: string, section: SectionId): Promise<void> {
  const label = raw.trim()
  if (label.length < 2) return
  const sb = requireSupabase()
  const { error } = await sb.from('kept_subjects').upsert(
    { subject_key: `word:${label}`, label, terms: [label], kind: section },
    { onConflict: 'owner,subject_key' },
  )
  if (error) throw error
}

/**
 * Drop.
 *
 * Nothing else changes — the journal still notices the name and keeping it again
 * is one click. Deliberately the same shape as `dropSubject`, because a drop that
 * felt consequential would make keeping a decision, and keeping is not one.
 */
export { dropSubject as dropItem }

export type { KeptSubject }

/** The surface's one hook: load, and re-load after a write. */
export function useLifeMap() {
  const [map, setMap] = useState<LifeMap | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    let cancelled = false
    loadLifeMap()
      .then((next) => {
        if (!cancelled) {
          setMap(next)
          setError(null)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your Life Map.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => refresh(), [refresh])

  return { map, error, refresh }
}
