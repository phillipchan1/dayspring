// Shapes for the import-recognition corpus.
//
// The corpus is hand-authored journal prose with hand-labeled expected output.
// It is the executable spec for what Dayspring is supposed to notice when
// someone imports years of history from another app: which scripture refs light
// the map, which passages land on the Altar, which people and places enter the
// Concordance — and, just as importantly, what must be left alone.
//
// Two consumers share these shapes:
//   Tier 1 — src/lib/recognition/*.test.ts and src/lib/scripture/parse.test.ts.
//            Free, deterministic, runs in CI.
//   Tier 2 — scripts/recognition-eval.ts. Hits the real model, scores
//            precision/recall, prints a report. Opt-in, costs money.
//
// Everything here is synthetic. No line of it came from a real journal.

/**
 * A recognition defect the corpus pins. Each id appears on at least one entry
 * (asserted in corpus.test.ts) and is described in DEFECTS in ./index.ts.
 *
 * These are measured, not fixed. An entry carrying a DefectId records what the
 * pipeline does TODAY in `currentRefs`, alongside what it should do in `refs`.
 */
// Retired once fixed (2026-08-01), in the order they fell:
//   'crosschapter-verse-overwrite'  Romans 8:28-9:2 → Rom.8.2 at confidence 1.0
//   'list-swallows-numbered-book'   "Ps 62:5, 2 Cor 5:17" ate the next book's digit
//   'sentence-boundary'             "Met Mark 5 minutes late" → Mark.5
//   'lowercase-book'                a lowercase journal lit nothing on the map
//   'ordinal-book-form'             canon.ts knew no "1st Corinthians"
// Their corpus entries now assert the correct answer instead, and each fix is
// pinned by name in src/lib/scripture/parse.test.ts.
export type DefectId =
  /**
   * A book name that is also an ordinary English word ("Acts", "Mark", "Job")
   * is only admitted with a verse or an explicit "chapter", so "Taught on
   * Acts 2" yields nothing. A deliberate trade, not an oversight: every softer
   * rule tried admitted "reading Mark 5 emails" and friends. Recall on a few
   * famous chapters, given up to never invent a reading.
   */
  | 'ambiguous-word-needs-verse'
  /** `Romans 8-9` yields only the first chapter; the range end is discarded. */
  | 'crosschapter-range'
  /** A book named with no chapter number never matches. */
  | 'bare-book-no-chapter'
  /** `vv. 4-5` with no book+chapter anchor is invisible. */
  | 'anchorless-verse-marker'
  /** Quoted or paraphrased scripture with no reference. No detector exists. */
  | 'allusion-undetected'
  /** A genuine prayer whose wording trips none of altar.ts's HARVEST_CUE terms. */
  | 'cue-blind-prayer'

export type Category =
  | 'scripture-baseline'
  | 'scripture-lowercase'
  | 'scripture-crosschapter-verse'
  | 'scripture-crosschapter-range'
  | 'scripture-bare-book'
  | 'scripture-ordinal'
  | 'scripture-sentence-boundary'
  | 'scripture-anchorless'
  | 'scripture-numbered-list'
  | 'scripture-allusion'
  | 'scripture-dense'
  | 'scripture-clamping'
  | 'prayer-clear'
  | 'prayer-cue-blind'
  | 'prayer-cue-false-positive'
  | 'prayer-distractor'
  | 'prayer-paraphrase-trap'
  | 'entity-alias'
  | 'entity-descriptor-bait'
  | 'entity-generic-control'
  | 'subject-stoplist'
  | 'ordinary'

export interface ExpectedRef {
  /**
   * OSIS exactly as parse.ts emits it: 'Rom.8.28', 'Rom.8.28-Rom.8.30', 'Ps.23'.
   */
  osis: string
  /**
   * 'confirmed' — an explicit citation the parser should find. Scored as the
   *               headline scripture number.
   * 'suggested' — an unreferenced allusion. Nothing in the pipeline produces
   *               these today; they are scored separately so the gap stays
   *               visible rather than being averaged into the main figure.
   */
  status?: 'confirmed' | 'suggested'
}

export interface ExpectedPassage {
  type: 'prayer' | 'sense'
  /**
   * The verbatim span. corpus.test.ts asserts this is a real substring of the
   * body — if it weren't, altar.ts's isVerbatim gate would drop the model's
   * (correct) extraction and every prayer score would be a lie.
   */
  text: string
}

export interface ExpectedEntity {
  kind: 'person' | 'place' | 'org' | 'project' | 'term'
  canonical: string
  /** Every spelling appearing verbatim in this body. Asserted at load. */
  surfaceForms: string[]
  /**
   * The identity-only descriptor the model may attach ('my wife', 'our church').
   * `''` means the body offers bait but no descriptor should survive the gate.
   */
  descriptor?: string
}

export interface ExpectedSubject {
  label: string
  kind: 'person' | 'place' | 'theme'
}

export interface CorpusEntry {
  /** Stable slug. Reports name entries by this, so don't renumber casually. */
  id: string
  category: Category
  /** 0-based week offset from EPOCH_MS in ./index.ts. */
  week: number
  /** 0..6 within the week. */
  day: number
  body: string

  // The four annotation axes are TRI-STATE, and the distinction is load-bearing:
  //   omitted — this axis isn't annotated for this entry; don't score it
  //   []      — this axis MUST yield nothing (false-positive control)
  //   [...]   — exactly this, no more
  refs?: ExpectedRef[]
  passages?: ExpectedPassage[]
  entities?: ExpectedEntity[]
  subjects?: ExpectedSubject[]

  /** Shorthand for refs/passages/entities/subjects all `[]`. */
  yieldsNothing?: true

  /**
   * What parseReferences emits TODAY, as OSIS strings, when it differs from
   * `refs`. This is the frozen lie: parse.test.ts asserts against it so the
   * defect is pinned rather than merely known, and fixing the defect is a
   * visible, deliberate act rather than a silent drift.
   */
  currentRefs?: string[]
  /** Required whenever currentRefs is present. */
  defect?: DefectId
  /** One line: what the user actually sees when this goes wrong. */
  note?: string
}

/** A CorpusEntry with dates materialized and the tri-state axes resolved. */
export interface LoadedEntry extends CorpusEntry {
  created_at: string
  /** ISO week key ('2026-W02') — the unit declared.ts's MIN_WEEKS gate counts. */
  isoWeek: string
}
