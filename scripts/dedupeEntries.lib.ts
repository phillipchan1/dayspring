// Finding duplicate entry rows. Pure, and separate from the script that deletes
// them (scripts/dedupe-entries.ts), because this decides which of someone's
// journal entries is the redundant one and that judgement is worth testing.
//
// Two shapes of duplicate, from two different bugs:
//
//   CONTAINED — one body is wholly inside the other after whitespace
//   normalisation. The autosave torn-state bug (fixed June 2026, see
//   src/lib/saveSession.ts) re-created an existing body under a fresh id, so its
//   duplicates are exact copies or extensions of their twin. Dropping the
//   smaller loses nothing: every word of it survives in the one that's kept.
//
//   NEAR — the bodies are almost the same but neither contains the other. This
//   is the conflict-fork bug: a cron watermark bumped updated_at on an untouched
//   row, the next push read that as a foreign edit, and the server's older copy
//   was preserved as its own entry. The two differ by whatever the writer changed
//   in between — a fixed typo, a deleted clause — which is exactly why the
//   contained test can't find them.
//
// Only CONTAINED is safe to delete automatically. In a NEAR pair the smaller row
// holds at least one thing the larger one doesn't, and this is a journal: a
// sentence someone prayed is not ours to throw away on a similarity score. Those
// are reported for a human to read and merge.

export interface DupeRow {
  id: string
  owner: string
  created_at: string
  updated_at: string
  body_markdown: string
  word_count: number
  source: string
}

export type PairKind = 'contained' | 'near'

export interface DupePair {
  keep: DupeRow
  drop: DupeRow
  kind: PairKind
  /** Fraction of the smaller body's phrasing that also appears in the larger, 0..1. */
  coverage: number
}

export interface FindOptions {
  /** Ignore bodies shorter than this, so daily one-liner rituals can't false-positive. */
  minChars?: number
  /** How much of the smaller body must appear in the larger to call it a near-duplicate. */
  nearThreshold?: number
  /** Word pairs the smaller body needs before `coverage` means anything. */
  minShingles?: number
}

export const normalize = (s: string): string => s.replace(/\s+/g, ' ').trim()

/** Adjacent word pairs of an already-normalised body, with repeats counted. */
function shingles(s: string): Map<string, number> {
  const words = s.toLowerCase().split(' ').filter(Boolean)
  const out = new Map<string, number>()
  for (let i = 0; i < words.length - 1; i++) {
    const g = `${words[i]} ${words[i + 1]}`
    out.set(g, (out.get(g) ?? 0) + 1)
  }
  return out
}

export function shingleCount(s: string): number {
  let n = 0
  for (const count of shingles(s).values()) n += count
  return n
}

/**
 * How much of `part` also appears in `whole`, by word pairs, 0..1.
 *
 * Deliberately asymmetric. A symmetric score answers "how alike are these two",
 * which is not the question — the question is "if I delete the smaller one, how
 * much writing goes with it", and that stays the same however much was appended
 * to the larger. A conflict fork differs from its twin by one edit inside
 * otherwise identical prose, so nearly all of its phrasing survives in the twin
 * no matter how long the writer kept going afterwards.
 *
 * Word pairs rather than character bigrams because unrelated English prose
 * shares a great deal of the latter and almost none of the former.
 */
export function coverage(part: string, whole: string): number {
  const p = shingles(part)
  const w = shingles(whole)
  let total = 0
  let shared = 0
  for (const [gram, n] of p) {
    total += n
    const m = w.get(gram)
    if (m !== undefined) shared += Math.min(m, n)
  }
  return total === 0 ? 0 : shared / total
}

/**
 * Was this row minted by conflict preservation rather than by the user?
 *
 * Preserved versions are named with a UUIDv5 derived from the version they hold
 * (src/lib/conflictShadowId.ts); everything else the app creates is a v4 from
 * crypto.randomUUID(). Only true for rows created after that change shipped, so
 * it is a hint for triage and never a licence to delete.
 */
export function isPreservedVersionId(id: string): boolean {
  return id[14] === '5'
}

/**
 * Of a duplicate pair, the one to delete — or null if neither is safely
 * droppable. Never drop an imported row (it wasn't minted by either bug, and
 * deleting it would also break the import's external_id dedup on re-import).
 * Prefer dropping the shorter body; ties → the older update.
 */
function lesserOf(a: DupeRow, b: DupeRow): DupeRow | null {
  const aNative = a.source === 'native'
  const bNative = b.source === 'native'
  if (!aNative && !bNative) return null
  if (aNative !== bNative) return aNative ? a : b
  if (a.body_markdown.length !== b.body_markdown.length) {
    return a.body_markdown.length < b.body_markdown.length ? a : b
  }
  return a.updated_at <= b.updated_at ? a : b
}

/**
 * Duplicate pairs among `rows`, grouped by owner and calendar day. Each row
 * appears in at most one pair, so a run can never propose deleting both halves
 * of anything.
 */
export function findDuplicates(
  rows: DupeRow[],
  { minChars = 12, nearThreshold = 0.8, minShingles = 10 }: FindOptions = {},
): { contained: DupePair[]; near: DupePair[] } {
  const groups = new Map<string, DupeRow[]>()
  for (const r of rows) {
    const key = `${r.owner}:${r.created_at.slice(0, 10)}`
    const g = groups.get(key)
    if (g) g.push(r)
    else groups.set(key, [r])
  }

  const contained: DupePair[] = []
  const near: DupePair[] = []
  const claimed = new Set<string>()

  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!
        const b = group[j]!
        if (claimed.has(a.id) || claimed.has(b.id)) continue

        const na = normalize(a.body_markdown)
        const nb = normalize(b.body_markdown)
        const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na]
        if (shorter.length < minChars) continue

        const score = coverage(shorter, longer)
        let kind: PairKind
        if (longer.includes(shorter)) kind = 'contained'
        else if (shingleCount(shorter) >= minShingles && score >= nearThreshold) kind = 'near'
        else continue

        const drop = lesserOf(a, b)
        if (!drop) continue
        const keep = drop === a ? b : a
        // Never drop the superset of an imported twin — content would be lost.
        if (
          keep.source !== 'native' &&
          normalize(keep.body_markdown).length < normalize(drop.body_markdown).length
        ) {
          continue
        }

        claimed.add(a.id)
        claimed.add(b.id)
        ;(kind === 'contained' ? contained : near).push({ keep, drop, kind, coverage: score })
      }
    }
  }

  return { contained, near }
}
