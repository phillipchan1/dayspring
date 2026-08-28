// The ways to read what is lit.
//
// Every one of them is an ARRANGEMENT of things the writer already has — never a
// selection of the good ones, never a summary, never a claim about what a
// stretch of time was. The arithmetic is all here and none of it involves a
// model: a gap opens a burst, a floor shortens a word list, a year splits two
// spans, a line count decides what counts as near. What the reader draws from
// the arrangement is theirs.
//
// Three rules hold across all of them, and each one is a written decision
// rather than a taste call:
//
//   · No vertical axis anywhere. Nothing here returns a score, a ratio or a
//     trend, because a rising or falling line beside someone's spiritual life
//     is a grade (Principle 1).
//   · Order by first appearance, never by count. A ranking of what someone
//     carries is a verdict rendered as a sort.
//   · A line view shows EVERY match. A top eight means something selected
//     them, and selection is significance (D-016).

import { entryContentLines } from '@/lib/entryLabels'
import type { Entry } from '@/lib/types'

export type Reading = 'order' | 'thennow' | 'bursts' | 'words' | 'near'

export const READINGS: { id: Reading; label: string; gloss: string }[] = [
  // "Every" is the load-bearing word, not the direction: a top eight would mean
  // something selected them, and selection is significance (D-016).
  { id: 'order', label: 'in order', gloss: 'Every page, in date order.' },
  { id: 'thennow', label: 'then & now', gloss: 'Two spans. Nothing between them.' },
  // Arithmetic, not narrative. The app never says these are stories.
  { id: 'bursts', label: 'close together', gloss: 'Stretches bounded by silence.' },
  { id: 'words', label: 'the words you used', gloss: 'Yours, then against now. Never a score.' },
  /*
   * The only reading that joins the two halves of the filter.
   *
   * A subject lights lines; a marking lit a whole page, so "Tiffany and
   * Scripture" could only mean "both are true somewhere here" and opening one
   * showed nothing connecting them. With the markings' own text both live in
   * the same prose and the real question becomes answerable: the verses you
   * reached for while you were writing about her (see `nearby.ts`).
   *
   * It needs a subject to be near, and says so rather than being dimmed —
   * greying a reading out is exactly what made "the words you used" impossible
   * to find.
   */
  { id: 'near', label: 'marked near it', gloss: 'What you marked, beside the pages that say it.' },
]

const year = (iso: string): number => new Date(iso).getFullYear()
const day = (iso: string): number => Math.floor(Date.parse(iso) / 86_400_000)

/** Oldest first. Every matching page — a subset would be a judgement. */
export function inOrder(entries: Entry[]): Entry[] {
  return entries.slice().sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/** Every year the pages span, for the split control. */
export function yearsIn(entries: Entry[]): number[] {
  return [...new Set(entries.map((e) => year(e.created_at)))].sort((a, b) => a - b)
}

export interface TwoSpans {
  before: Entry[]
  after: Entry[]
  split: number
}

/**
 * Two spans of pages, and NO ARROW BETWEEN THEM.
 *
 * An arrow is a vertical axis laid on its side — it says the second span is
 * where the first was heading. The page count for each span stays on screen
 * because an uneven comparison reads as a verdict on the thinner side, and the
 * reader can only discount it if they can see it.
 */
export function thenAndNow(entries: Entry[], split: number): TwoSpans {
  const ordered = inOrder(entries)
  return {
    before: ordered.filter((e) => year(e.created_at) < split),
    after: ordered.filter((e) => year(e.created_at) >= split),
    split,
  }
}

export interface Burst {
  entries: Entry[]
  /** Calendar days from the first page to the last, inclusive. */
  days: number
  /** Days of silence before this one. Zero for the first. */
  quietDaysBefore: number
}

export interface BurstOptions {
  /** A gap this long, in days, ends a stretch. Defaults to the set's own rhythm. */
  quiet?: number
  /** A stretch has to hold at least this many pages to be one. */
  min?: number
}

/**
 * What counts as silence, for THIS set of pages.
 *
 * A fixed threshold cannot work. Fifty days is a long silence for someone who
 * writes about their mother twice a year and no silence at all for someone who
 * writes every morning — on a near-daily archive it returns one "stretch" of
 * 1,414 pages, which is not a stretch, it is the journal.
 *
 * So silence is relative to the writer's own rhythm here: several times the
 * typical gap between these pages. Median rather than mean, because one
 * eleven-year-old entry would drag an average until nothing looked quiet.
 * Still pure arithmetic, and it says the true thing — a gap is only a silence
 * against how often you usually write.
 */
export function quietFor(entries: Entry[]): number {
  const days = inOrder(entries).map((e) => day(e.created_at))
  const gaps: number[] = []
  for (let i = 1; i < days.length; i++) gaps.push(days[i]! - days[i - 1]!)
  if (gaps.length === 0) return 14
  gaps.sort((a, b) => a - b)
  const median = gaps[Math.floor(gaps.length / 2)] ?? 1
  return Math.min(400, Math.max(14, median * 6))
}

/**
 * Stretches bounded by silence.
 *
 * A story in a journal is not a theme, it is an EPISODE, and an episode has a
 * shape: a run of entries with quiet on both sides. This is arithmetic and
 * nothing else — a gap of `quiet` days opens a new stretch, and a stretch has
 * to hold `min` pages to count as one.
 *
 * EVERY HEADING IS A COUNT. "5 pages in 59 days, after 10 quiet months" is a
 * fact; a title would be a claim about what the stretch was, and the writer is
 * the only one who gets to say that.
 */
export function bursts(entries: Entry[], opts: BurstOptions = {}): Burst[] {
  const ordered = inOrder(entries)
  if (ordered.length === 0) return []
  const quiet = opts.quiet ?? quietFor(ordered)
  const min = opts.min ?? 3

  const groups: Entry[][] = []
  let current: Entry[] = []
  let previous: number | null = null

  for (const e of ordered) {
    const t = day(e.created_at)
    if (previous !== null && t - previous > quiet) {
      groups.push(current)
      current = []
    }
    current.push(e)
    previous = t
  }
  if (current.length > 0) groups.push(current)

  const out: Burst[] = []
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!
    if (g.length < min) continue
    const first = day(g[0]!.created_at)
    const last = day(g[g.length - 1]!.created_at)
    const prev = groups[i - 1]
    const prevEnd = prev ? day(prev[prev.length - 1]!.created_at) : null
    out.push({
      entries: g,
      days: last - first + 1,
      quietDaysBefore: prevEnd === null ? 0 : first - prevEnd,
    })
  }
  return out
}

/**
 * A second, much wider stop list, used ONLY by the vocabulary diff.
 *
 * The matcher's word boundaries are tuned for matching, where a stray
 * "actually" costs nothing. A vocabulary diff is different: a person READS the
 * list, and a list opening with `something`, `because` and `doing` says nothing
 * about anybody.
 *
 * This is not the stop list the prototype warned against. That warning was
 * about guessing which of someone's MEANINGFUL words are the real ones. These
 * are the words English uses to hold a sentence together, and removing them is
 * how the writer's own vocabulary becomes visible at all.
 */
export const COMMON = new Set(
  `the a an and or but i to of in it is was be been am are my me you he she they we not that this there here for on at with as if so do did does have has had what when how why who all just still keep about from into out over under again more most some any than then them their her his our your no nor too very can will would could should
  one two three four five six seven eight nine ten first last next same other another each every both few many much lot lots
  back down away off out up around along across before after until while during since between within without through
  say says said saying tell tells told telling ask asks asked asking think thinks thought know knows knew knowing
  go goes going gone went come comes coming came get gets got getting give gives gave given take takes took taken taking
  make makes made making put puts putting keep keeps kept let lets letting want wants wanted feel feels felt
  look looks looked looking see sees saw seen seeing hear hears heard hearing
  like likes liked need needs needed try tries tried trying turn turns turned
  thing things something anything nothing everything someone anyone everyone nobody
  time times day days week weeks month months year years today tonight tomorrow yesterday morning night evening
  good bad better best worse well fine okay real really actually maybe perhaps probably almost even ever never always sometimes
  long short small little big large whole half full empty easy hard
  because though although however instead else also only quite rather already yet soon
  being done doing didn wasn isn aren cannot
  which whom whose where whether
  work works worked working use uses used using`
    .split(/\s+/)
    .filter(Boolean),
)

/**
 * A word has to appear in more than one page in its span.
 *
 * THE FLOOR IS THE ONLY LEGAL WAY TO SHORTEN THIS LIST, and it is stated on
 * screen. "Appears in at least two pages" is arithmetic about the text, where
 * "the most significant thirty" would be selection — and selection is
 * significance, and significance is a verdict (D-016).
 *
 * It is also the truer question. A word said once is a word someone used; a
 * word said in two separate sittings is a word they use.
 */
export const WORD_FLOOR = 2

/**
 * The floor, scaled to the span it is filtering.
 *
 * Two pages is the right floor on a fixture of 47 entries and badly wrong on a
 * real archive: across 3,580 pages it leaves thousands of words and returns
 * exactly the word cloud the floor exists to prevent — `ascii`, `espn`,
 * `tknow`, every typo anybody made twice.
 *
 * So the floor is a proportion rather than a constant: a word has to appear in
 * at least one page in a hundred of its span. That is still arithmetic about
 * the text — which is what keeps it legal, because "the most significant
 * thirty" would be selection, and selection is significance, and significance
 * is a verdict (D-016). Nothing here ranks anything; the bar simply moved.
 *
 * ONE floor for both spans, taken from the SMALLER of the two. Giving each span
 * its own bar would make a word "stopped" purely because the spans are
 * different sizes, which is an artifact of the split rather than anything the
 * writer did.
 */
export function wordFloor(beforePages: number, afterPages: number): number {
  const smaller = Math.min(beforePages, afterPages)
  return Math.max(WORD_FLOOR, Math.ceil(smaller / 100))
}

/** Shortest word worth reading back. Below this it is grammar, not vocabulary. */
const MIN_WORD_LENGTH = 4

/** Words to the pages they first appeared on. */
function vocabulary(entries: Entry[], terms: string[], floor: number): Map<string, string> {
  const lowered = terms.map((t) => t.trim().toLowerCase())
  const seen = new Map<string, { pages: number; first: string }>()

  for (const e of inOrder(entries)) {
    const here = new Set<string>()
    for (const line of entryContentLines(e.body_markdown)) {
      for (const w of line.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)) {
        if (w.length < MIN_WORD_LENGTH) continue
        if (COMMON.has(w)) continue
        // The subject's own name is not a finding about the subject.
        if (lowered.includes(w)) continue
        here.add(w)
      }
    }
    for (const w of here) {
      const held = seen.get(w)
      if (held) held.pages += 1
      else seen.set(w, { pages: 1, first: e.created_at })
    }
  }

  const out = new Map<string, string>()
  for (const [w, v] of seen) if (v.pages >= floor) out.set(w, v.first)
  return out
}

export interface WordsUsed {
  /** Words in the later span that are not in the earlier one. */
  started: string[]
  /** Words in the earlier span that are not in the later one. */
  stopped: string[]
  beforePages: number
  afterPages: number
  split: number
  /** The floor actually applied, so the surface can state it. */
  floor: number
}

/**
 * The sentiment question, answered the only legal way there is.
 *
 * A mood curve is forbidden three times over — GUARDRAILS H2 (never infer
 * interior state), Principle 1 (no vertical axis: a falling line over a subject
 * called "Mom" reads as *you care less about your mother now*), and D-016 (the
 * writer supplies the signal). A sentiment MARK does not rescue it either: that
 * is `Sense` with a mood attached, and any arrangement of it over time rebuilds
 * the axis.
 *
 * What IS sanctioned is the writer's own vocabulary — GUARDRAILS' approved
 * example is literally *"'Angry' appears in 7 entries this month."* So this
 * shows the words on their pages in one span and not the other:
 *
 *   · no number beside any word
 *   · ordered by first appearance, never by frequency
 *   · never sorted into good and bad
 *   · the page count for each span always on screen
 *   · a floor, stated on screen
 *
 * Nobody scores anything, and the shift — if there is one — is the reader's to
 * see. Per RECALL that is "the most meaningful thing in the product precisely
 * because the app didn't hand it to them."
 */
export function wordsUsed(entries: Entry[], split: number, terms: string[] = []): WordsUsed {
  const { before, after } = thenAndNow(entries, split)
  const floor = wordFloor(before.length, after.length)
  const wasThen = vocabulary(before, terms, floor)
  const isNow = vocabulary(after, terms, floor)

  // By first appearance. There is no count to sort by, and that is the point.
  const byFirst = (a: [string, string], b: [string, string]) => a[1].localeCompare(b[1])

  return {
    started: [...isNow.entries()].filter(([w]) => !wasThen.has(w)).sort(byFirst).map(([w]) => w),
    stopped: [...wasThen.entries()].filter(([w]) => !isNow.has(w)).sort(byFirst).map(([w]) => w),
    beforePages: before.length,
    afterPages: after.length,
    split,
    floor,
  }
}

/**
 * A sensible year to split on: the midpoint of what is lit, by pages rather
 * than by calendar.
 *
 * By pages, because a calendar midpoint on an archive that got busier puts
 * nine tenths of the writing on one side and the comparison reads as a verdict
 * on the thin span. The writer can move it; this is only where it opens.
 */
export function defaultSplit(entries: Entry[]): number {
  const years = yearsIn(entries)
  if (years.length <= 1) return years[0] ?? new Date().getFullYear()
  const ordered = inOrder(entries)
  const middle = ordered[Math.floor(ordered.length / 2)]
  return middle ? year(middle.created_at) : years[Math.floor(years.length / 2)]!
}
