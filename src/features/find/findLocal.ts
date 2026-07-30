// Instant Find — local, offline, and over the WHOLE corpus.
//
// The entry list's filterEntries() only ever saw entries already loaded into
// memory, so search silently missed anything that hadn't paged in. Find reads
// the IndexedDB cache instead (lib/db.ts holds every synced entry), which makes
// it both complete and genuinely instantaneous: no network round trip, so it can
// run on every keystroke without a debounce.
//
// Nothing in this file calls the server. That's the contract that lets Find work
// on a plane and Ask not have to.

import { cacheGetAll } from '@/lib/db'
import { asEntryMarkdown } from '@/lib/entryLabels'
import { listConcordance, type ConcordanceItem } from '@/lib/concordance'
import type { Entry } from '@/lib/types'

export interface FindHit {
  entry: Entry
  /** Text around the match, with the matched range marked. */
  snippet: { before: string; match: string; after: string }
}

/** The Concordance offering the wider question — the one bridge from Find to Ask. */
export interface FindBridge {
  canonical: string
  kind: string
  /** Other ways the writer says it, for the subline. */
  forms: string[]
  occurrences: number
}

const SNIPPET_RADIUS = 46
export const FIND_LIMIT = 8

// ── corpus (cached; the palette warms it on open) ───────────────────────────

let corpus: Entry[] | null = null
let corpusAt = 0
const CORPUS_TTL_MS = 30_000

export async function warmFindCorpus(): Promise<void> {
  if (corpus && Date.now() - corpusAt < CORPUS_TTL_MS) return
  try {
    const all = await cacheGetAll()
    // Sort once here, not per keystroke — findEntries() runs on every character.
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    corpus = all
    corpusAt = Date.now()
  } catch {
    corpus = corpus ?? []
  }
}

/** Drop the cache so the next open re-reads (after a sync, delete, or sign-out). */
export function resetFindCorpus(): void {
  corpus = null
  corpusAt = 0
}

// ── concordance (cached; small, and it changes rarely) ───────────────────────

let concordance: ConcordanceItem[] | null = null

export async function warmConcordance(): Promise<void> {
  if (concordance) return
  try {
    concordance = await listConcordance()
  } catch {
    concordance = [] // offline or table missing — Find still works, just no bridge
  }
}

export function resetConcordance(): void {
  concordance = null
}

// ── find ────────────────────────────────────────────────────────────────────

function snippetAround(body: string, at: number, len: number): FindHit['snippet'] {
  const start = Math.max(0, at - SNIPPET_RADIUS)
  const end = Math.min(body.length, at + len + SNIPPET_RADIUS)
  const squash = (s: string) => s.replace(/\s+/g, ' ')
  return {
    before: (start > 0 ? '…' : '') + squash(body.slice(start, at)),
    match: squash(body.slice(at, at + len)),
    after: squash(body.slice(at + len, end)) + (end < body.length ? '…' : ''),
  }
}

/**
 * Case-insensitive substring search, newest first. Synchronous on purpose —
 * warmFindCorpus() is awaited when the palette opens, so keystrokes never wait.
 */
export function findEntries(query: string, limit = FIND_LIMIT): FindHit[] {
  const q = query.trim().toLowerCase()
  if (!q || !corpus) return []

  const hits: FindHit[] = []
  for (const entry of corpus) {
    const body = asEntryMarkdown(entry.body_markdown)
    const at = body.toLowerCase().indexOf(q)
    if (at === -1) continue
    hits.push({ entry, snippet: snippetAround(body, at, q.length) })
    if (hits.length >= limit) break
  }
  return hits
}

/** How many entries contain the query, beyond the ones being shown. */
export function findCount(query: string): number {
  const q = query.trim().toLowerCase()
  if (!q || !corpus) return 0
  let n = 0
  for (const entry of corpus) {
    if (asEntryMarkdown(entry.body_markdown).toLowerCase().includes(q)) n++
  }
  return n
}

/**
 * Does this query name something the writer has a word for?
 *
 * Prefix match, so the bridge appears while you're still typing ("trad" finds
 * "trading"). Prefers the entity whose matched form is SHORTEST — the closest
 * thing to what was actually typed, rather than whichever alias happens to run
 * longest. One offer at a time; the bridge is a door, not a result list.
 */
export function findBridge(query: string): FindBridge | null {
  const q = query.trim().toLowerCase()
  if (q.length < 2 || !concordance) return null

  let best: { item: ConcordanceItem; matched: string } | null = null
  for (const item of concordance) {
    const forms = [item.canonical, ...(item.surface_forms ?? [])].filter(Boolean)
    for (const form of forms) {
      const term = form.trim().toLowerCase()
      if (term.length < 2 || !term.startsWith(q)) continue
      if (!best || term.length < best.matched.length) best = { item, matched: term }
    }
  }
  if (!best) return null

  const item = best.item
  return {
    canonical: item.canonical,
    kind: item.kind,
    forms: (item.surface_forms ?? []).filter((f) => f !== item.canonical),
    occurrences: item.occurrence_count,
  }
}
