// Precision/recall scoring over the recognition corpus.
//
// Shared by both tiers: Tier 1's scorecard test asserts floors against these
// numbers, and Tier 2's report prints them. One scorer means the two tiers can
// never disagree about what "recall" meant.
//
// A scorer with a bug quietly reports whatever you hoped for, so score.test.ts
// tests this file directly rather than trusting it.

import { corpusFor } from './corpus'
import type { LoadedEntry } from './corpus/types'

export interface Score {
  tp: number
  fp: number
  fn: number
  precision: number
  recall: number
  f1: number
  /** Entry ids with a miss or a spurious hit, for the report's misses section. */
  missedIn: string[]
  spuriousIn: string[]
}

export interface Miss {
  entryId: string
  kind: 'fn' | 'fp'
  detail: string
}

const ratio = (num: number, den: number): number => (den === 0 ? 1 : num / den)

/**
 * Entries annotated on `axis`, optionally narrowed to a subset of ids.
 *
 * `only` exists for --limit runs in scripts/recognition-eval.ts: when a run
 * sends just part of the corpus to the model, the entries it never sent must
 * leave the denominator too. Scoring them as misses would report a cheap run as
 * a catastrophic one and make the cost-control lever useless.
 */
function scopeTo(axis: Parameters<typeof corpusFor>[0], only?: Set<string>) {
  const all = corpusFor(axis)
  return only ? all.filter((e) => only.has(e.id)) : all
}

export function summarize(tp: number, fp: number, fn: number, misses: Miss[]): Score {
  const precision = ratio(tp, tp + fp)
  const recall = ratio(tp, tp + fn)
  return {
    tp,
    fp,
    fn,
    precision,
    recall,
    f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
    missedIn: [...new Set(misses.filter((m) => m.kind === 'fn').map((m) => m.entryId))],
    spuriousIn: [...new Set(misses.filter((m) => m.kind === 'fp').map((m) => m.entryId))],
  }
}

/**
 * Multiset comparison. Order-insensitive but count-sensitive, because a corpus
 * entry that cites the same passage twice expects two refs — deduping is
 * scan.ts's job, not the parser's, and folding that boundary away here would
 * hide which side of it a bug is on.
 */
function diffMultiset(expected: string[], actual: string[]): { tp: number; missing: string[]; extra: string[] } {
  const pool = new Map<string, number>()
  for (const a of actual) pool.set(a, (pool.get(a) ?? 0) + 1)
  const missing: string[] = []
  let tp = 0
  for (const e of expected) {
    const n = pool.get(e) ?? 0
    if (n > 0) {
      pool.set(e, n - 1)
      tp++
    } else {
      missing.push(e)
    }
  }
  const extra: string[] = []
  for (const [value, n] of pool) for (let i = 0; i < n; i++) extra.push(value)
  return { tp, missing, extra }
}

// ── scripture ────────────────────────────────────────────────────────────────

export interface ScriptureScore {
  /** Explicit citations — the headline number. */
  explicit: Score
  /**
   * Unreferenced allusions, scored separately and never folded into `explicit`.
   * Nothing in the pipeline writes status:'suggested', so this is 0/N by
   * construction until a detector exists. Reporting it on its own line is how
   * the gap stays visible instead of being averaged away.
   */
  allusions: { detected: number; total: number }
  misses: Miss[]
}

/**
 * @param parse the reference parser under test, injected so this module stays
 *   free of any dependency on parse.ts's internals.
 */
export function scoreScripture(
  parse: (text: string) => { osis_ref: string }[],
  only?: Set<string>,
): ScriptureScore {
  let tp = 0
  let fp = 0
  let fn = 0
  let allusionsDetected = 0
  let allusionsTotal = 0
  const misses: Miss[] = []

  for (const e of scopeTo('refs', only)) {
    const expectedAll = e.refs ?? []
    const explicit = expectedAll.filter((r) => r.status !== 'suggested').map((r) => r.osis)
    const allusions = expectedAll.filter((r) => r.status === 'suggested').map((r) => r.osis)
    const actual = parse(e.body).map((r) => r.osis_ref)

    allusionsTotal += allusions.length
    allusionsDetected += allusions.filter((a) => actual.includes(a)).length

    // Allusions the parser happens to emit are credited above, not counted as
    // spurious explicit hits.
    const actualExplicit = actual.filter((a) => !allusions.includes(a))
    const { tp: hit, missing, extra } = diffMultiset(explicit, actualExplicit)
    tp += hit
    fn += missing.length
    fp += extra.length
    for (const m of missing) misses.push({ entryId: e.id, kind: 'fn', detail: m })
    for (const x of extra) misses.push({ entryId: e.id, kind: 'fp', detail: x })
  }

  return {
    explicit: summarize(tp, fp, fn, misses),
    allusions: { detected: allusionsDetected, total: allusionsTotal },
    misses,
  }
}

/** The false-positive control set — entries that must yield nothing at all. */
export const CORPUS_NOTHING: LoadedEntry[] = corpusFor('refs').filter((e) => e.yieldsNothing === true)

/**
 * Scripture precision restricted to entries that must yield nothing. Asserted
 * on its own so a single fabricated reference in ordinary prose fails loudly
 * rather than being averaged into a corpus-wide figure.
 */
export function scoreOrdinaryProse(parse: (text: string) => { osis_ref: string }[]): {
  spurious: Miss[]
} {
  const spurious: Miss[] = []
  for (const e of CORPUS_NOTHING) {
    for (const r of parse(e.body)) {
      spurious.push({ entryId: e.id, kind: 'fp', detail: r.osis_ref })
    }
  }
  return { spurious }
}

// ── prayer cue prefilter ─────────────────────────────────────────────────────

/**
 * Scores altar.ts's HARVEST_CUE regex, which decides which entries reach the
 * model at all. Recall here is a hard ceiling on the Altar: an entry the cue
 * misses can never yield a prayer no matter how good the model is.
 *
 * "Precision" for a prefilter means wasted model calls, not wrong answers — a
 * generous net is the intended design. It is reported, not gated.
 */
export function scoreCuePrefilter(cue: (text: string) => boolean, only?: Set<string>): Score {
  let tp = 0
  let fp = 0
  let fn = 0
  const misses: Miss[] = []
  for (const e of scopeTo('passages', only)) {
    const shouldFire = (e.passages ?? []).length > 0
    const fires = cue(e.body)
    if (shouldFire && fires) tp++
    else if (shouldFire && !fires) {
      fn++
      misses.push({ entryId: e.id, kind: 'fn', detail: 'prayer present, cue silent' })
    } else if (!shouldFire && fires) {
      fp++
      misses.push({ entryId: e.id, kind: 'fp', detail: 'cue fires, no prayer — a model call spent for nothing' })
    }
  }
  return summarize(tp, fp, fn, misses)
}

// ── prayer passages (Tier 2 — model output) ──────────────────────────────────

export interface ModelPassage {
  entryId: string
  type: 'prayer' | 'sense'
  text: string
}

const nz = (s: string): string => s.replace(/\s+/g, ' ').trim().toLowerCase()

/**
 * Boundary-tolerant match: models legitimately pick a tighter or looser span
 * than a human annotator would. Containment either way counts as a hit;
 * overlapping nothing is a false positive.
 */
export function passagesOverlap(a: string, b: string): boolean {
  const x = nz(a)
  const y = nz(b)
  if (!x || !y) return false
  return x.includes(y) || y.includes(x)
}

export interface PassageScore {
  span: Score
  /** Type agreement among matched spans, scored separately so a boundary win
   *  isn't masked by a prayer/sense mix-up. */
  typeAgreement: { agreed: number; matched: number }
  misses: Miss[]
}

export function scorePassages(actual: ModelPassage[], only?: Set<string>): PassageScore {
  let tp = 0
  let fp = 0
  let fn = 0
  let agreed = 0
  let matched = 0
  const misses: Miss[] = []

  for (const e of scopeTo('passages', only)) {
    const expected = e.passages ?? []
    const got = actual.filter((p) => p.entryId === e.id)
    const claimed = new Set<number>()

    for (const exp of expected) {
      const idx = got.findIndex((g, i) => !claimed.has(i) && passagesOverlap(exp.text, g.text))
      if (idx === -1) {
        fn++
        misses.push({ entryId: e.id, kind: 'fn', detail: exp.text.slice(0, 80) })
        continue
      }
      claimed.add(idx)
      tp++
      matched++
      if (got[idx]!.type === exp.type) agreed++
    }
    got.forEach((g, i) => {
      if (claimed.has(i)) return
      fp++
      misses.push({ entryId: e.id, kind: 'fp', detail: g.text.slice(0, 80) })
    })
  }

  return { span: summarize(tp, fp, fn, misses), typeAgreement: { agreed, matched }, misses }
}

// ── concordance entities (Tier 2 — model output) ─────────────────────────────

export interface ModelEntity {
  entryId: string
  kind: string
  canonical: string
  surfaceForm: string
  descriptor?: string
}

export interface EntityScore {
  identity: Score
  kindAgreement: { agreed: number; matched: number }
  /** How often a proposed descriptor survives the evaluative gate. */
  descriptors: { kept: number; proposed: number }
  misses: Miss[]
}

export function scoreEntities(actual: ModelEntity[], only?: Set<string>): EntityScore {
  let tp = 0
  let fp = 0
  let fn = 0
  let agreed = 0
  let matched = 0
  let kept = 0
  let proposed = 0
  const misses: Miss[] = []

  for (const e of scopeTo('entities', only)) {
    const expected = e.entities ?? []
    const got = actual.filter((x) => x.entryId === e.id)
    const claimed = new Set<number>()

    for (const exp of expected) {
      // An alias is as good as the canonical name — "Es" identifies Esther.
      const names = new Set([exp.canonical, ...exp.surfaceForms].map(nz))
      const idx = got.findIndex(
        (g, i) => !claimed.has(i) && (names.has(nz(g.canonical)) || names.has(nz(g.surfaceForm))),
      )
      if (idx === -1) {
        fn++
        misses.push({ entryId: e.id, kind: 'fn', detail: exp.canonical })
        continue
      }
      claimed.add(idx)
      tp++
      matched++
      if (got[idx]!.kind === exp.kind) agreed++

      const gotDescriptor = got[idx]!.descriptor ?? ''
      if (exp.descriptor !== undefined) {
        proposed++
        // exp.descriptor === '' means the body baits a descriptor that the
        // evaluative gate must strip.
        if (exp.descriptor === '' ? gotDescriptor === '' : nz(gotDescriptor) === nz(exp.descriptor)) {
          kept++
        } else {
          misses.push({
            entryId: e.id,
            kind: 'fp',
            detail: `descriptor ${JSON.stringify(gotDescriptor)}, expected ${JSON.stringify(exp.descriptor)}`,
          })
        }
      }
    }
    got.forEach((g, i) => {
      if (claimed.has(i)) return
      fp++
      misses.push({ entryId: e.id, kind: 'fp', detail: g.canonical })
    })
  }

  return {
    identity: summarize(tp, fp, fn, misses),
    kindAgreement: { agreed, matched },
    descriptors: { kept, proposed },
    misses,
  }
}
