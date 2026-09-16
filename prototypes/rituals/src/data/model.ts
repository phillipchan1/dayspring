/**
 * The shape a ritual thread has — and it is deliberately the shape the archive
 * already holds, not a new one.
 *
 * `scripts/ritual-threads-extract.ts` produces exactly this by running the real
 * `parseRitualBlocks` over real entries. Nothing here is computed, inferred, or
 * summarised: a thread is the writer's own answers to the same movement, in
 * order, verbatim. That is the whole idea and it is why there is no model call
 * anywhere in this prototype.
 */

export interface Answer {
  entryId: string
  /** ISO timestamp of the entry the answer was written in. */
  at: string
  text: string
}

export interface Movement {
  /** The section label, as written into the entry's hidden token. */
  label: string
  /** Looked up live from practicesData, exactly as both renderers do. */
  question: string
  answers: Answer[]
}

export interface Thread {
  practice: string
  /** How many blocks of this practice the archive holds. Never shown. See below. */
  walks: number
  firstAt: string
  lastAt: string
  movements: Movement[]
}

export interface Archive {
  generatedAt: string
  entries: number
  threads: Thread[]
}

/**
 * `walks` is carried because the extractor produces it, and it is NOT rendered.
 *
 * MORNING_RITUALS_PLAN §5.3 wrote the constraint down before anyone built this:
 * a surface reflecting how often you practise is one design review away from a
 * frequency, and a frequency here is a streak (Principle 2). So the shelf orders
 * by last walked and shows names. No counts, no gaps, no "you haven't done this
 * since June".
 *
 * A DATE ON AN INDIVIDUAL ANSWER IS NOT A FREQUENCY. It is the archive saying
 * when you wrote something, which every other Dayspring surface already does.
 * The line is: facts about a page, yes; aggregate judgments about the writer, no.
 */
export const SHOW_COUNTS = false

/** Newest first — a thread is read backwards, like the rest of the product. */
export function byNewest(a: Answer, b: Answer): number {
  return b.at.localeCompare(a.at)
}

/** Practices in the order last walked. The shelf's only ordering. */
export function shelfOrder(threads: Thread[]): Thread[] {
  return [...threads].sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}

/** Movements that actually carry writing — an unanswered movement has no thread. */
export function livingMovements(t: Thread): Movement[] {
  return t.movements.filter((m) => m.answers.length > 0)
}

export function totalAnswers(t: Thread): number {
  return t.movements.reduce((n, m) => n + m.answers.length, 0)
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** "9 June 2026" — the archive's own way of saying when, never "3 months ago". */
export function longDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function shortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]?.slice(0, 3)}`
}

export function year(iso: string): number {
  return new Date(iso).getFullYear()
}
