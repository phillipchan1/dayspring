/**
 * The semantic leg — a fixture, not a model.
 *
 * There is no embedding here and no network call. Every "near" hit below was
 * chosen by hand so that a call can argue about the SHAPE of a semantic result
 * — can a page that came back explain itself? — without anyone having to
 * believe a retrieval score.
 *
 * ── The honesty rule ────────────────────────────────────────────────────────
 *
 * A hand-picked fixture where the clever leg always wins is a sales pitch. So
 * this one is built to lose in three specific places, and `#notes` says so out
 * loud rather than hoping nobody checks:
 *
 *   1. WRONG hits. Pages marked `wrong: true` came back and should not have.
 *      They are rendered exactly like the others — no warning label, no styling
 *      — because the whole question is whether a reader can tell. If the false
 *      positives are invisible on the call, that is the finding.
 *   2. LITERAL-ONLY pages. Typing the word finds pages this leg misses. The
 *      scenes compute those in code from `terms` (never by hand) so the
 *      comparison cannot be rigged in the fixture's favour.
 *   3. A QUESTION IT REFUSES. "how did I grow this year?" returns nothing at
 *      all. That failure is not a gap in the fixture — it is the reason the
 *      arrangements exist, and returning nothing is the correct answer.
 *
 * ── Why a hit carries a line ────────────────────────────────────────────────
 *
 * D-020 wrote this surface's kill condition when it deleted Remember: "people
 * ask questions and then can't tell WHY a page came back — literal matching
 * shows its work by lighting the word, and a vector hit has no word to light."
 *
 * So a hit here is never just an entry id. It is an entry id AND the writer's
 * own sentence that was nearest, verbatim. That is what a page lights instead
 * of a word. It is still a fact about the text rather than a claim about her:
 * the app says "this line was nearest", never "this page is about waiting".
 */

import { ENTRIES, type Entry } from './corpus'
import { hits } from './lib'

export type Hit = {
  entryId: string
  /** Which paragraph was nearest. The margin needs an anchor. */
  para: number
  /** Verbatim substring of paragraphs[para]. Enforced by validateSemantics(). */
  quote: string
  /**
   * This page came back and should not have.
   *
   * Deliberately NOT rendered differently anywhere in the prototype. A false
   * positive you have flagged for the reader is not a false positive, it is a
   * demonstration.
   */
  wrong?: boolean
}

export type Question = {
  id: string
  /** As she would type it. */
  text: string
  /** What a literal search would match on. Code applies these, never the fixture. */
  terms: string[]
  /** The semantic leg's answer, oldest first. */
  near: Hit[]
  /**
   * The declared kind that answers this question exactly, where one does.
   *
   * The strongest argument in the prototype: for some questions the marks she
   * already made are a better answer than any retrieval, because she made them.
   */
  declared?: 'absence' | 'desire' | 'gift' | 'learned' | 'story' | 'sense' | 'prayer'
  /** Set when the honest answer is nothing. */
  refuses?: boolean
  /** Facilitator only. Never rendered on a shared screen. */
  note: string
}

export const QUESTIONS: Question[] = [
  /*
   * The literal leg's worst case, and the reason this question opens the set.
   *
   * "waiting" appears exactly once in four years of journal — in "Waiting at
   * pickup", which is about a school car line and has nothing to do with God.
   * So the literal answer is one page and it is the wrong page, while five
   * pages circle the thing without ever using the word.
   */
  {
    id: 'waiting',
    text: 'what has God been teaching me about waiting?',
    terms: ['waiting', 'wait', 'patience'],
    note:
      'Literal returns ONE page and it is a school pickup. This is the clearest case in the fixture for a leg that is not literal. Watch whether the false positive at the end is spotted.',
    near: [
      {
        entryId: 'e-2024-12-01',
        para: 1,
        quote: 'the fear was worse in the week before we knew than it has been in any week since',
      },
      {
        entryId: 'e-2025-02-18',
        para: 2,
        quote: 'I just know I have been asking for one',
      },
      {
        entryId: 'e-2025-07-08',
        para: 2,
        quote: 'I think God has been kind in small ways I only see when I sit still long enough.',
      },
      // Came back on "an answer I am waiting for". It is a work deadline.
      {
        entryId: 'e-2025-06-19',
        para: 2,
        quote: 'Work wants an answer by Friday on a thing I do not want to do.',
        wrong: true,
      },
      {
        entryId: 'e-2026-06-22',
        para: 1,
        quote: 'Maybe the new thing is not a change in circumstance. Maybe it is that I am still here, still asking.',
      },
      {
        entryId: 'e-2026-08-16',
        para: 2,
        quote: 'I am not going to make that into a sentence God has to answer.',
      },
    ],
  },

  /*
   * The growth question, in the one form the corpus can actually answer.
   *
   * Four pages say "marriage" outright, which is a real literal win and has to
   * stay visible: two of them are the January entries a year apart, and reading
   * those two next to each other IS the answer. What the near leg adds is the
   * pages that are plainly about the marriage and never name it.
   */
  {
    id: 'marriage',
    text: 'how have my thoughts about my marriage changed?',
    terms: ['marriage', 'married', 'david'],
    note:
      'Both legs are needed here and neither is embarrassed. Literal finds the two Januaries a year apart, which is the whole answer to "changed". Near finds the pages that never say the word. The wrong one is about the kids.',
    near: [
      {
        entryId: 'e-2023-06-24',
        para: 1,
        quote: 'I am something with fewer letters than angry and it lasts longer',
      },
      {
        entryId: 'e-2025-02-03',
        para: 1,
        quote: 'I was grateful and irritated at the same time, which is a stupid combination',
      },
      // Came back on regret and a short temper. She was short with the CHILDREN.
      {
        entryId: 'e-2025-01-22',
        para: 2,
        quote: 'I was short with both of them in the car and then sorry the whole way home.',
        wrong: true,
      },
      {
        entryId: 'e-2025-06-02',
        para: 1,
        quote: "I cried in the car on the way home, which I hated, and he didn't try to fix it.",
      },
      {
        entryId: 'e-2026-02-14',
        para: 0,
        quote: 'Just my name and a line from a song we used to know.',
      },
      {
        entryId: 'e-2026-07-14',
        para: 0,
        quote: 'I want to be praying about David the way I used to, before I turned it into a project.',
      },
    ],
  },

  /*
   * The question the marks already answer better than retrieval does.
   *
   * She declared five absences. That set is exact, it is hers, and no model was
   * involved in any of it. The near leg returns an approximation of the same
   * set plus a page from her first month that is ordinary beginner's doubt.
   *
   * This scene's argument is not "semantics is bad". It is that where a
   * declared kind exists, retrieval is the second-best tool in the drawer.
   */
  {
    id: 'far',
    text: 'when did I feel far from God?',
    terms: ['far', 'absent', 'dry'],
    declared: 'absence',
    note:
      'Walk the declared answer FIRST, then the near answer. Five marks she made against six pages a machine picked. The point is whose answer it is, not which is longer.',
    near: [
      {
        entryId: 'e-2023-02-05',
        para: 3,
        quote: 'Is this the kind of thing that works, or the kind of thing people say works?',
        wrong: true,
      },
      {
        entryId: 'e-2024-06-11',
        para: 2,
        quote: 'Is anyone hearing any of this, or am I talking to the ceiling?',
      },
      {
        entryId: 'e-2025-01-08',
        para: 2,
        quote: 'I keep making lists instead of actually talking to God about it.',
      },
      {
        entryId: 'e-2025-08-15',
        para: 1,
        quote: 'I could not sit there doing nothing and I also could not pray out loud',
      },
      {
        entryId: 'e-2025-10-11',
        para: 2,
        quote: 'I prayed about it for four minutes and then folded laundry',
      },
      {
        entryId: 'e-2026-05-09',
        para: 2,
        quote: "I keep wanting a conclusion. There isn't one.",
      },
    ],
  },

  /*
   * Three sentences, three years, one wish. She declared every one of them.
   * Nothing was retrieved and nothing was inferred — this is a filter on a kind.
   */
  {
    id: 'wanted',
    text: 'what have I wanted?',
    terms: ['want', 'wanted'],
    declared: 'desire',
    note:
      'The cheapest thing in the prototype and possibly the best. Jan 2024, Jan 2025, Jul 2026 — read in order they are one sentence being said three times, and the app wrote none of it.',
    near: [
      {
        entryId: 'e-2024-01-14',
        para: 0,
        quote: 'I want to be someone who prays for her family on purpose instead of in emergencies.',
      },
      {
        entryId: 'e-2025-01-08',
        para: 1,
        quote: 'I want to be praying about my marriage this year.',
      },
      {
        entryId: 'e-2026-07-14',
        para: 0,
        quote: 'I want to be praying about David the way I used to, before I turned it into a project.',
      },
    ],
  },

  /*
   * The one it refuses.
   *
   * "grow" appears nowhere in four years, and there is no set of pages that
   * honestly answers this — growth is not a thing she wrote about, it is a
   * thing that happened across everything she wrote. A leg that returned six
   * plausible pages here would be inventing an answer, and the empty result is
   * what sends the call to #year and #thread instead.
   */
  {
    id: 'grow',
    text: 'how did I grow this year?',
    terms: ['grow', 'growth', 'better'],
    refuses: true,
    note:
      'THE IMPORTANT ONE. It returns nothing, on purpose. Ask what they expected to get. Then walk #year. A search box is the wrong shape for this question and the empty state is how the prototype admits it.',
    near: [],
  },
]

export function questionById(id: string): Question | undefined {
  return QUESTIONS.find((q) => q.id === id)
}

/**
 * What typing the words would have found — computed, never curated.
 *
 * Deliberately derived in code from `terms` rather than listed in the fixture,
 * so the literal leg cannot be quietly weakened to make the other one look
 * good. Whatever this returns is what the corpus actually says.
 */
export function literalFor(q: Question): Entry[] {
  return ENTRIES.filter((e) => hits(e.paragraphs.join(' '), q.terms))
}

/** The paragraph a literal match landed on, for lighting the card. */
export function literalLine(e: Entry, q: Question): { para: number; text: string } | null {
  for (let i = 0; i < e.paragraphs.length; i += 1) {
    const p = e.paragraphs[i]!
    if (hits(p, q.terms)) return { para: i, text: p }
  }
  return null
}

export function nearFor(q: Question): Hit[] {
  return [...q.near].sort((a, b) => a.entryId.localeCompare(b.entryId))
}

/** Ids in each leg, for the set arithmetic the scenes show. */
export function legs(q: Question): {
  literal: Set<string>
  near: Set<string>
  both: Set<string>
  literalOnly: Set<string>
  nearOnly: Set<string>
} {
  const literal = new Set(literalFor(q).map((e) => e.id))
  const near = new Set(q.near.map((h) => h.entryId))
  const both = new Set([...literal].filter((id) => near.has(id)))
  const literalOnly = new Set([...literal].filter((id) => !near.has(id)))
  const nearOnly = new Set([...near].filter((id) => !literal.has(id)))
  return { literal, near, both, literalOnly, nearOnly }
}

/**
 * The grounding rule, enforced on this fixture too.
 *
 * A "nearest line" that isn't a verbatim substring of the paragraph it claims
 * is precisely the failure the whole surface exists to avoid — worse here than
 * in the markings, because this is the one place the app is pretending to be
 * clever. Loud in dev, same as validateMarkings().
 */
export function validateSemantics(): string[] {
  const problems: string[] = []
  for (const q of QUESTIONS) {
    for (const h of q.near) {
      const entry = ENTRIES.find((e) => e.id === h.entryId)
      if (!entry) {
        problems.push(`${q.id}: no entry ${h.entryId}`)
        continue
      }
      const para = entry.paragraphs[h.para]
      if (para === undefined) {
        problems.push(`${q.id} → ${h.entryId}: paragraph ${h.para} does not exist`)
      } else if (!para.includes(h.quote)) {
        problems.push(`${q.id} → ${h.entryId} p${h.para}: "${h.quote}" is not verbatim`)
      }
    }
  }
  return problems
}
