/**
 * What the landing says, computed — never written by a model.
 *
 * Principle 4: facts come from queries, the model only selects and phrases.
 * There is no model here at all, so every clause below can be traced to a row.
 *
 * ── The line this file will not cross ───────────────────────────────────────
 * Lamp is the precedent, and Lamp is disciplined about one distinction that is
 * easy to miss. Every number it shows is about the MATERIAL — which book, which
 * verse, how often that verse appeared in the writing. It has no number about
 * the PRACTICE: no "you read scripture 4 days this week", no cadence, no gap.
 *
 *   A count of what you wrote about is evidence.
 *   A count of how often you showed up is a verdict.
 *
 * A practice is harder than a book, because a practice is a thing you DO, so
 * its frequency is one step from a streak. `The Morning Offering ×18 / Psalmic
 * Lament ×2` ranks your devotional life by frequency, and the 2 beside Lament
 * reads as neglect — which fails Principle 2's test outright (does it work by
 * making you feel bad?).
 *
 * Lamp's own dodge is the one used here: rank is turned into WORDS ("the book
 * you return to most") and the count itself is never printed. Depth is shown by
 * showing more of the writing, never by counting it.
 */
import type { Thread } from './model'

export interface Landing {
  /** The one descriptive line. Empty when there is nothing honest to say. */
  line: string
  /** Threads to lead with, deepest first — the questions, not the practices. */
  lead: Thread['movements']
  /** Which practice each lead question came from, by index. */
  leadPractice: string[]
  /** True when the archive is too thin to lead with anything. */
  thin: boolean
}

function humanList(xs: string[]): string {
  if (xs.length === 0) return ''
  if (xs.length === 1) return xs[0]!
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

/** Depth, then brevity — a column of brain dumps is a wall, of one-liners a thread. */
function rank(movements: { answers: { text: string }[] }[]): number[] {
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  return movements
    .map((m, i) => ({ i, m }))
    .sort(
      (a, b) =>
        b.m.answers.length - a.m.answers.length ||
        mean(a.m.answers.map((x) => x.text.length)) - mean(b.m.answers.map((x) => x.text.length)),
    )
    .map((x) => x.i)
}

/** How many answers a thread must hold before it is worth leading with. */
const WORTH_LEADING = 3

export function buildLanding(threads: Thread[]): Landing {
  const all = threads.flatMap((t) => t.movements.map((m) => ({ practice: t.practice, m })))
  const ranked = rank(all.map((x) => x.m)).map((i) => all[i]!)
  const deepest = ranked[0]

  /**
   * At most one lead card per practice.
   *
   * Ranking movements globally means the best-walked practice takes every slot
   * — the first draft led with three Morning Offering movements and read like a
   * page about one ritual. The second and third cards are worth more as a
   * different question from a different practice than as the same practice's
   * runner-up, which you will meet anyway the moment you open the first.
   */
  const seen = new Set<string>()
  const ordered = ranked.filter((x) => {
    if (seen.has(x.practice)) return false
    seen.add(x.practice)
    return true
  })

  // Principle 5 — an archive with nothing in it gets told the truth, not a
  // manufactured headline. "The question you've come back to most" over a
  // thread of two is a mirror pretending to be a window.
  if (!deepest || deepest.m.answers.length < WORTH_LEADING) {
    return {
      line: deepest
        ? 'Only a few rituals so far. This page fills in as you walk more of them.'
        : '',
      lead: ordered.slice(0, 2).map((x) => x.m),
      leadPractice: ordered.slice(0, 2).map((x) => x.practice),
      thin: true,
    }
  }

  // Practices by how much writing they hold — RANKED, never numbered, exactly
  // as Lamp turns `rank === 1` into "the book you return to most".
  const leaned = [...threads]
    .sort(
      (a, b) =>
        b.movements.reduce((n, m) => n + m.answers.length, 0) -
        a.movements.reduce((n, m) => n + m.answers.length, 0),
    )
    .slice(0, 2)
    .map((t) => t.practice)

  const question = deepest.m.question || deepest.m.label

  return {
    line: `You’ve leaned toward ${humanList(leaned)}. “${question}” is the question you’ve come back to most.`,
    lead: ordered.slice(0, 3).map((x) => x.m),
    leadPractice: ordered.slice(0, 3).map((x) => x.practice),
    thin: false,
  }
}
