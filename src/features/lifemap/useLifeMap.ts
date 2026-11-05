// Loading and writing the Life Map.
//
// The read layer (`lifeMap.ts`) is pure; this is the half that talks to the
// database. It keeps its own Concordance query rather than reusing
// `listConcordance()`, for one reason: that query excludes `dormant`, and the
// Life Map must not. See `retired()` — dormant is recency, and on a fifteen-year
// archive it is most of the people in it.

import { useCallback, useEffect, useRef, useState } from 'react'
import { getCache, setCache } from '@/lib/asyncCache'
import { requireSupabase } from '@/lib/supabase'
import { withOfflineSnapshot } from '@/lib/offlineSnapshot'
import { listKeptSubjects, dropSubject, type KeptSubject } from '@/features/pages/keptSubjects'
import { forgetConcordanceItem, type ConcordanceKind } from '@/lib/concordance'
import { buildLifeMap, floorFor, type LifeMapItem, type LifeMapSection, type SectionId } from './lifeMap'
import type { ConcordanceItem } from '@/lib/concordance'
import { typedItem, withoutItem, withRestored, withTyped, type Removed } from './lifeMapEdits'

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
  return withOfflineSnapshot('lifemap', async () => {
    const pages = await pageCount()
    const floor = floorFor(pages)
    const [concordance, kept] = await Promise.all([listForLifeMap(floor), listKeptSubjects()])
    return { sections: buildLifeMap(concordance, kept, floor), floor, pages }
  })
}

/**
 * Remove — the one gesture on a chip, and it means two different things.
 *
 * A TYPED subject just loses its `kept_subjects` row; the journal still notices
 * the word and adding it again is one keystroke.
 *
 * A FOUND subject is superseded in the Concordance, which is what makes removal
 * stick: without it the next scan would offer the same wrong name again, and a
 * dismissal that does not hold is worse than no dismissal at all. `forget` also
 * appends to `concordance_events`, so the correction survives a rebuild — and
 * that event log is the labelled-negative stream The Keeping has never had.
 *
 * Nothing the writer wrote changes either way.
 */
export async function removeItem(item: LifeMapItem): Promise<void> {
  if (item.id === null) {
    await dropSubject(item.key)
    return
  }
  await forgetConcordanceItem({
    id: item.id,
    kind: item.section === 'domain' ? 'org' : (item.section as ConcordanceKind),
    canonical: item.label,
  } as ConcordanceItem)
  await dropSubject(item.key)
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

/** Where the last map is kept between visits (asyncCache; scrubbed on sign-out). */
export const LIFEMAP_CACHE_KEY = 'lifemap:map'

/** How long a removal can be taken back before it is written. */
export const UNDO_MS = 5000

/** A line under the lists: a removal that can be undone, or a write that failed. */
export type LifeMapNotice =
  | { kind: 'removed'; label: string; section: SectionId }
  | { kind: 'failed'; text: string; section: SectionId }

/**
 * The surface's one hook: the map, and the two things a writer does to it.
 *
 * ── Instant ──────────────────────────────────────────────────────────────────
 * The last map is kept in `asyncCache` and painted on arrival, with a fresh
 * read behind it — it used to be "Reading your journal…" every visit.
 *
 * ── Optimistic, and honest about it ─────────────────────────────────────────
 * Adding and removing used to wait on two round trips and swallow any error:
 * a chip you removed sat there, and if the write failed it simply stayed with
 * no word why. Now both show at once (`lifeMapEdits`), and a failure puts the
 * map back the way it was AND says so.
 *
 * A removal is held for `UNDO_MS` with an Undo before it is written — the
 * found-name half of a removal supersedes a Concordance row, which has no
 * inverse, so "undo" has to mean "never sent". Leaving the surface, or removing
 * something else, sends it at once.
 */
export function useLifeMap() {
  const [map, setMapState] = useState<LifeMap | null>(() => getCache<LifeMap>(LIFEMAP_CACHE_KEY) ?? null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<LifeMapNotice | null>(null)
  const mapRef = useRef(map)
  const alive = useRef(true)
  /** Bumped by every edit; a read started before the latest edit is stale. */
  const edits = useRef(0)
  const pending = useRef<{ removed: Removed; timer: ReturnType<typeof setTimeout> } | null>(null)
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const setMap = useCallback((next: LifeMap) => {
    mapRef.current = next
    setCache(LIFEMAP_CACHE_KEY, next)
    if (alive.current) setMapState(next)
  }, [])

  const say = useCallback((next: LifeMapNotice | null, ms?: number) => {
    clearTimeout(noticeTimer.current)
    if (!alive.current) return
    setNotice(next)
    if (next && ms) noticeTimer.current = setTimeout(() => alive.current && setNotice(null), ms)
  }, [])

  const refresh = useCallback(() => {
    const gen = edits.current
    loadLifeMap()
      .then((next) => {
        if (gen !== edits.current) return
        // A removal still inside its Undo window is not on the server yet.
        const held = pending.current
        setMap(held ? withoutItem(next, held.removed.item.key).map : next)
        if (alive.current) setError(null)
      })
      .catch((e: unknown) => {
        // With a map already on screen, a failed refresh keeps it.
        if (!mapRef.current && alive.current) {
          setError(e instanceof Error ? e.message : 'Could not load your Life Map.')
        }
      })
  }, [setMap])

  /** Write the held removal now. */
  const commit = useCallback(() => {
    const held = pending.current
    if (!held) return
    pending.current = null
    clearTimeout(held.timer)
    const { item } = held.removed
    say(null)
    const gen = ++edits.current
    removeItem(item).then(
      () => {
        if (gen === edits.current) refresh()
      },
      () => {
        if (mapRef.current) setMap(withRestored(mapRef.current, held.removed))
        say({ kind: 'failed', text: `Couldn’t take ${item.label} off your map, so it’s back.`, section: held.removed.section }, 6000)
      },
    )
  }, [refresh, say, setMap])

  const remove = useCallback(
    (item: LifeMapItem) => {
      const current = mapRef.current
      if (!current) return
      commit()
      const { map: next, removed } = withoutItem(current, item.key)
      if (!removed) return
      edits.current++
      setMap(next)
      pending.current = { removed, timer: setTimeout(commit, UNDO_MS) }
      say({ kind: 'removed', label: item.label, section: item.section })
    },
    [commit, say, setMap],
  )

  const undo = useCallback(() => {
    const held = pending.current
    if (!held) return
    pending.current = null
    clearTimeout(held.timer)
    edits.current++
    if (mapRef.current) setMap(withRestored(mapRef.current, held.removed))
    say(null)
  }, [say, setMap])

  const add = useCallback(
    (label: string, section: SectionId) => {
      const current = mapRef.current
      if (!current || label.trim().length < 2) return
      const item = typedItem(label, section, new Date().toISOString())
      const next = withTyped(current, item)
      if (next === current) return
      const gen = ++edits.current
      setMap(next)
      addTyped(item.label, section).then(
        () => {
          if (gen === edits.current) refresh()
        },
        () => {
          if (mapRef.current) setMap(withoutItem(mapRef.current, item.key).map)
          say({ kind: 'failed', text: `Couldn’t add ${item.label} just now. Try it again in a moment.`, section }, 6000)
        },
      )
    },
    [refresh, say, setMap],
  )

  useEffect(() => {
    alive.current = true
    refresh()
    return () => {
      alive.current = false
      clearTimeout(noticeTimer.current)
      // Leaving inside the Undo window: the removal stands, so send it.
      commit()
    }
  }, [refresh, commit])

  return { map, error, notice, refresh, add, remove, undo }
}
