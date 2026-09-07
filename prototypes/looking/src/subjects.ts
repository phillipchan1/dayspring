/**
 * The things you carry — offered, and kept.
 *
 * ── The argument this settles ───────────────────────────────────────────────
 *
 * RECALL Act one lays out four mechanisms for how the journal comes to know
 * what you carry, and the two live ones pull against each other:
 *
 *   1.1  Nothing is kept — your own words are already the index. Zero
 *        maintenance, which is exactly the ask. But it fails the moment you
 *        arrive not knowing the word, and a blank field is only free if you do.
 *   1.3  You name what you carry. Maximum control, maximum setup — and one
 *        gesture away from the tag manager SURFACES.md forbids.
 *
 * The answer is 1.2, which RECALL already calls "probably the strongest":
 * **it offers, and you keep.** Recognition beats recall, there is nothing to
 * set up, and every kept subject traces to something you actually wrote.
 *
 * ── What keeps this legal ───────────────────────────────────────────────────
 *
 * An OFFERED subject is pure arithmetic: a word that appears in enough separate
 * entries. Recurrence is a count, and a count is a fact (D-016). The app is not
 * saying this matters to you — it is saying you wrote it eleven times.
 *
 * A KEPT subject is the writer supplying the signal, which is the only kind of
 * significance this product renders at all.
 *
 * ── Order, which is where this goes wrong if you are careless ───────────────
 *
 * Kept subjects are ordered by WHEN THEY WERE KEPT. Never by count. Riverside
 * above Mom at 31 entries to 14 would be the app ranking what someone carries,
 * and a ranking of the people in your life is a verdict rendered in a sort.
 *
 * Offered subjects are ordered by FIRST APPEARANCE, for the same reason.
 *
 * ── And what this must never become ─────────────────────────────────────────
 *
 * Keeping is ONE gesture with no decision attached — no colour, no rename, no
 * merge, no nesting, no archive. The moment it grows management affordances it
 * is a to-do list about someone's prayer life, and this is a Return surface, so
 * it may only ever show.
 */

import { ENTRIES, SUBJECTS as NAMED, type Entry, type Subject } from './corpus'
import { hits } from './lib'

export type Held = Subject & {
  /** The writer kept this. Offered subjects are the ones she hasn't. */
  kept: boolean
  /** Pages carrying it — arithmetic, and the only number ever shown. */
  pages: number
  /** When it first appeared in the journal. Offered subjects sort by this. */
  first: string
}

/**
 * Words a sentence capitalised in the middle of itself.
 *
 * ── Why this rule, after a worse one ────────────────────────────────────────
 *
 * The first version offered any word appearing in four or more separate
 * entries. On this corpus that returns twenty-eight words, and they are:
 * *down, also, used, already, going, without, second, found, instead, stop.*
 * Raising the floor does not help and neither does a stop list — the junk is
 * not rare, it is just ordinary English, and every stop list is a hand-tuned
 * guess about which of someone's words are the real ones.
 *
 * Tightening it to "words that appear inside something she marked" was no
 * better, because a marking quote is a whole sentence and carries the same
 * ordinary English with it.
 *
 * What works is capitalisation in the middle of a sentence. That is not a
 * guess about meaning — it is a thing SHE typed, on purpose, because the word
 * is a name. Same rule the Concordance already runs on the real archive, and
 * it is arithmetic end to end: no model, no part-of-speech tagging, no
 * judgement about which subjects matter.
 *
 * ── The finding this exposes, which is the point ────────────────────────────
 *
 * On four years of journal it returns exactly this: **David · Mom · Leo · God ·
 * Mira · Grandma.** Six, all of them people, and it is right about every one.
 *
 * And it will never once return "marriage", or "work", or "the move" — because
 * she does not capitalise them, because they are not names.
 *
 * **That is the answer to automatic versus named, and it is not a compromise.**
 * Detection finds people for free and cannot find matters at all. So the people
 * arrive on their own, and a matter becomes a subject the moment she says so —
 * one gesture, from the same field, with nothing to set up. Neither half is
 * making up for the other being weak; they are good at different things.
 */

/**
 * Capitalised words that are not names — sentence openers, weekdays, months.
 *
 * Short and mechanical on purpose. This is not a stop list of meanings, which
 * is the thing that went wrong above; it is a list of words English capitalises
 * for grammatical reasons rather than because they name anything.
 */
const NOT_A_NAME = new Set([
  'The', 'This', 'That', 'There', 'These', 'Those', 'Then', 'Now', 'What', 'When',
  'Why', 'How', 'Where', 'Not', 'And', 'But', 'For', 'Nor', 'Yet', 'She', 'Her',
  'His', 'They', 'Them', 'We', 'You', 'Our', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March',
  'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November',
  'December',
])

/** Appears in at least this many separate entries before it is worth offering. */
const FLOOR = 2

/**
 * The people the journal noticed, without being told.
 *
 * Counted over ENTRIES, not occurrences: a name said nine times in one pour is
 * one day, and a name said once in nine entries across two years is a person
 * you carry. That distinction is why this is per-entry.
 */
export function offered(): Held[] {
  const pages = new Map<string, Set<string>>()
  const firstSeen = new Map<string, string>()

  for (const e of ENTRIES) {
    const text = e.paragraphs.join(' ')
    const seen = new Set<string>()
    // Capitalised, and NOT at the start of a sentence — a sentence-initial
    // capital says nothing, because every sentence has one.
    for (const m of text.matchAll(/[a-z,;]\s+([A-Z][a-z]{2,})/g)) {
      const w = m[1]!
      if (!NOT_A_NAME.has(w)) seen.add(w)
    }
    for (const w of seen) {
      const set = pages.get(w) ?? new Set<string>()
      set.add(e.id)
      pages.set(w, set)
      if (!firstSeen.has(w)) firstSeen.set(w, e.date)
    }
  }

  /*
   * Everything detected is offered, including the names the fixture happens to
   * have hand-written into SUBJECTS. Nothing is kept until she keeps it, so
   * filtering those out would hide exactly the names the first run is meant to
   * show her.
   */
  /*
   * Detection decides WHICH words; code decides the count.
   *
   * The two are different questions and must not share an answer. Capitalisation
   * mid-sentence is what identifies "Mom" as a name — it fires on 7 entries,
   * because the other 10 open a sentence with it. But the number beside the word
   * has to be the number of pages the word is ON, or the pill says 7 and the
   * page it opens says 17, and the writer has no way to tell which is lying.
   */
  return [...pages.entries()]
    .filter(([, set]) => set.size >= FLOOR)
    .map(([w, set]) => {
      const term = w.toLowerCase()
      const carrying = ENTRIES.filter((e) => hits(e.paragraphs.join(' '), [term]))
      return {
        key: `w:${term}`,
        label: w,
        terms: [term],
        kind: 'person' as const,
        kept: false,
        pages: carrying.length || set.size,
        first: firstSeen.get(w)!,
      }
    })
    // First appearance, never count. A frequency ranking turns order into
    // significance, and significance is a verdict.
    .sort((a, b) => a.first.localeCompare(b.first))
}

/**
 * Anything she types, kept as a subject.
 *
 * The other half of the hybrid, and the whole of it is this function: no
 * management screen, no form, no colour picker. She types a word the detector
 * will never find — *marriage* — and keeps it from the same field she was
 * already searching in.
 *
 * Returns null when nothing in the archive says it. Keeping a subject with no
 * pages behind it would be keeping a wish, and the list would slowly fill with
 * things she meant to write about.
 */
export function asSubject(raw: string): Held | null {
  const word = raw.trim().toLowerCase()
  if (word.length < 3) return null
  const pages = ENTRIES.filter((e) => hits(e.paragraphs.join(' '), [word]))
  if (pages.length === 0) return null
  return {
    key: `w:${word}`,
    label: raw.trim(),
    terms: [word],
    kind: 'matter',
    kept: true,
    pages: pages.length,
    first: pages[0]!.date,
  }
}

/** The named ones, as held subjects. In this fixture these start out kept. */
export function named(): Held[] {
  return NAMED.map((s) => {
    const pages = ENTRIES.filter((e) => hits(e.paragraphs.join(' '), s.terms))
    return {
      ...s,
      kept: true,
      pages: pages.length,
      first: pages[0]?.date ?? '',
    }
  })
}

export function entriesCarrying(s: Subject, from: Entry[] = ENTRIES): Entry[] {
  return from.filter((e) => hits(e.paragraphs.join(' '), s.terms))
}

/** Every line naming it, oldest first. EVERY one — a subset would be a judgement. */
export function linesCarrying(s: Subject): { entryId: string; date: string; text: string }[] {
  const out: { entryId: string; date: string; text: string }[] = []
  for (const e of ENTRIES) {
    for (const p of e.paragraphs) {
      if (hits(p, s.terms)) out.push({ entryId: e.id, date: e.date, text: p })
    }
  }
  return out
}
