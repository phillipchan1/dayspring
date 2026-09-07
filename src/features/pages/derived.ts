// What the wall derives from the archive, remembered between visits.
//
// ── The delay this exists to remove ─────────────────────────────────────────
//
// Pages is unmounted the moment you leave it, so every tap of the Journal tab
// rebuilt both corpus indexes from scratch: a flatten-and-lowercase per page for
// subject matching, and a scripture parse plus four regex passes and a fence
// parse per page for the facets. On a 3,000-page archive that is ~130ms of
// blocked main thread on a fast desktop, which on a phone is closer to half a
// second — every single tap, for an answer that was identical to last time.
//
// Both derivations depend on ONE page's own markdown and nothing else, so they
// are cached per entry and keyed on the text they were derived from. Coming back
// to Pages having changed nothing costs a map lookup per page; coming back
// having written one entry costs one page's derivation. Neither cache holds
// anything but a flattened string and a short list of keys taken from the
// writer's own document, and both are dropped wholesale when the archive shrinks
// under them.
//
// It is deliberately not a `WeakMap` keyed on the Entry object: the repo hands
// back a NEW object for an entry on every local edit, so identity keying would
// miss on exactly the change we most want to survive — the other 2,999 pages
// nobody touched.

import { buildFacetIndex, documentFacets, type FacetIndex, type FacetKey } from './facets'
import { buildSubjectIndex, haystackFor, type SubjectIndex } from './subjects'
import type { MarkingRef } from '@/lib/spiritual'
import type { Entry } from '@/lib/types'

interface Slot<T> {
  /** The exact text this was derived from — the only thing that invalidates it. */
  body: string
  value: T
}

const haystacks = new Map<string, Slot<string>>()
const facets = new Map<string, Slot<readonly FacetKey[]>>()

/**
 * Stale keys are pages that no longer exist — deleted, or a different account.
 *
 * Pruning per build would mean a set-difference over the whole archive on every
 * visit, which is the cost this module exists to avoid. Dropping the lot when a
 * cache outgrows the corpus it serves is O(1) and self-limiting: the next build
 * refills it, once.
 */
function prune(cache: Map<string, unknown>, corpusSize: number): void {
  if (cache.size > corpusSize * 2 + 64) cache.clear()
}

function memo<T>(cache: Map<string, Slot<T>>, entry: Entry, derive: (e: Entry) => T): T {
  const body = entry.body_markdown ?? ''
  const held = cache.get(entry.id)
  if (held && held.body === body) return held.value
  const value = derive(entry)
  cache.set(entry.id, { body, value })
  return value
}

/** The corpus, flattened for subject matching — cached per page. */
export function subjectIndexFor(entries: Entry[]): SubjectIndex {
  prune(haystacks, entries.length)
  return buildSubjectIndex(entries, (e) => memo(haystacks, e, haystackFor))
}

/**
 * What each page carries — cached per page for the document-derived half only.
 *
 * Marks and markings are layered on top every time, and must be: they come from
 * their own tables and change without the document changing at all.
 */
export function facetIndexFor(
  entries: Entry[],
  markedEntryIds: Iterable<string>,
  markings: Iterable<MarkingRef>,
): FacetIndex {
  prune(facets, entries.length)
  return buildFacetIndex(entries, markedEntryIds, markings, (e) =>
    memo(facets, e, documentFacets),
  )
}

/**
 * Derive ahead of the first visit, while nothing is waiting on the main thread.
 *
 * The caches make the SECOND tap of the Journal tab free; this is what makes the
 * first one free too. Called from the shell once the archive has loaded, in idle
 * time, so the cost lands where there is nothing to be late for.
 *
 * Chunked, because the point is not to move a 500ms block from one moment to
 * another — an idle callback that runs long is a dropped frame wherever it
 * lands. Each slice checks the deadline and yields.
 */
export function warmPageIndexes(entries: Entry[]): () => void {
  if (entries.length === 0) return () => {}
  let cancelled = false
  let at = 0

  const idle: typeof requestIdleCallback | undefined =
    typeof requestIdleCallback === 'function' ? requestIdleCallback : undefined
  // No `requestIdleCallback` in Safari/WKWebView, which is the platform that
  // needs this most. A timeout is not idle time, but it is off the critical
  // path, and the chunking below is what actually keeps it from being felt.
  const schedule = (fn: (deadline?: IdleDeadline) => void): number =>
    idle ? idle(fn, { timeout: 2000 }) : (setTimeout(fn, 1) as unknown as number)
  const unschedule = (id: number) => (idle ? cancelIdleCallback(id) : clearTimeout(id))

  let handle = 0
  const step = (deadline?: IdleDeadline) => {
    if (cancelled) return
    const spare = () => (deadline ? deadline.timeRemaining() > 4 : true)
    let budget = idle ? Number.POSITIVE_INFINITY : 60
    while (at < entries.length && budget-- > 0 && spare()) {
      const entry = entries[at++]!
      memo(haystacks, entry, haystackFor)
      memo(facets, entry, documentFacets)
    }
    if (at < entries.length) handle = schedule(step)
  }
  handle = schedule(step)

  return () => {
    cancelled = true
    unschedule(handle)
  }
}
