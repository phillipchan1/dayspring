import { LEXICON, type Theme } from './fathers'

/**
 * The tradition's questions.
 *
 * ── Why this file exists, and why it replaced the last one ──────────────────
 *
 * The first pass quoted the fathers' STATEMENTS beside her words. It was
 * pretty and it did nothing: a sentence set next to a sentence is an ornament,
 * and the only job it could plausibly be doing — telling her what her season
 * meant — is the job H4 forbids.
 *
 * The surface's actual job is to help her ask better. So quote the tradition's
 * QUESTIONS instead. Same corpus architecture, same three-hop join, aimed at
 * the thing the page is for.
 *
 * ── The defence, and it is stronger than the statement version's ────────────
 *
 * A question is the most efficient way to smuggle a verdict. "Where might God
 * be inviting you to be still?" asserts that God is inviting, that stillness
 * is the theme, and that she needs it — three claims behind one question mark.
 * That is H1, H4 and P4 in nine words, and it is why a model may not write one.
 *
 * What makes a quoted question safe is not its grammar. It is this:
 *
 *   A QUESTION WRITTEN IN 400 AD CANNOT BE A DIAGNOSIS OF HER,
 *   BECAUSE IT WAS NOT WRITTEN ABOUT HER.
 *
 * Cassian's Abba Moses asked a room of monks what the end of their profession
 * was. He did not ask her. She is overhearing somebody else's question and
 * deciding whether to take it up — which is exactly how spiritual reading has
 * always worked, and it is the one posture in this space that involves no
 * claim about the reader at all.
 *
 * The corollary is a hard rule: NOTHING HERE IS EVER ADDRESSED TO HER. No
 * second person that was not in the original, no "for you", no re-pointing. If
 * a question has to be reworded to land, it does not go in the corpus.
 *
 * ── Not therapy, and the word matters ───────────────────────────────────────
 *
 * The posture Phil described as "a Christian therapist voice" is right; the
 * vocabulary is dangerous. A therapeutic register invites disclosure the app
 * cannot handle, and D-007 — crisis content has no handling — is still open
 * and unimplemented. The moment this surface sounds clinical, that gap stops
 * being a logged risk and becomes the thing standing between a user and harm.
 *
 * The tradition's own words are examen and discernment. Neither appears on
 * screen either, because both are tradition-specific (P6) — the page shows a
 * question and a citation and says nothing about what kind of act it is.
 *
 * ── Same honesty as fathers.ts ──────────────────────────────────────────────
 *
 * `verified: false` on every row. NOT ONE LINE HERE HAS BEEN CHECKED AGAINST A
 * PRINTED SOURCE. The corpus is the feature and it is a library problem; see
 * README § "The corpus is the feature".
 */

export type TraditionQuestion = {
  id: string
  /** Verbatim, and it ends in a question mark — validateAsking() enforces it. */
  text: string
  who: string
  when: string
  where: string
  /** The translation, because the translation is the part that is owned. */
  edition: string
  themes: Theme[]
  /**
   * Who the question was originally put to.
   *
   * Rendered on screen, and not as trivia. It is the whole defence made
   * visible: "Abba Moses, to a room of monks" says plainly that this was not
   * asked of her. A question with no addressee starts to read as though it
   * were addressed to whoever is holding the page.
   */
  askedOf: string
  verified: boolean
}

/**
 * Nine questions. A shipped corpus would be a few hundred and no more.
 *
 * Deliberately spread across traditions — desert, Augustinian, English
 * mystical, Ignatian, à Kempis — because a council drawn from one school is a
 * school, and P6 says a Reformed Baptist and a charismatic should both be able
 * to read this without feeling like a guest in someone else's house. It does
 * not solve that problem. It is the least we can do about it.
 */
export const QUESTIONS: TraditionQuestion[] = [
  {
    id: 'cassian-goal',
    text: 'What is the goal and what is the end of your profession?',
    who: 'Abba Moses, recorded by John Cassian',
    when: 'Scetis, c. 420',
    where: 'Conferences, I.2',
    edition: 'tr. Edgar Gibson, 1894',
    themes: ['desire', 'staying'],
    askedOf: 'a room of monks',
    verified: false,
  },
  {
    id: 'augustine-love',
    text: 'What then do I love, when I love my God?',
    who: 'Augustine of Hippo',
    when: 'Hippo, c. 400',
    where: 'Confessions, X.6',
    edition: 'tr. E. B. Pusey, 1838',
    themes: ['desire', 'love'],
    askedOf: 'himself, in writing',
    verified: false,
  },
  {
    id: 'augustine-memory',
    text: 'Great is this force of memory, excessive great, O my God; a large and boundless chamber! who ever sounded the bottom thereof?',
    who: 'Augustine of Hippo',
    when: 'Hippo, c. 400',
    where: 'Confessions, X.8',
    edition: 'tr. E. B. Pusey, 1838',
    themes: ['memory'],
    askedOf: 'God, in writing',
    verified: false,
  },
  {
    id: 'augustine-time',
    /*
     * Trimmed. The famous line continues "If no one asks me, I know: if I wish
     * to explain it to one that asketh, I know not" — and validateAsking()
     * refused it, because the passage then ENDS on a statement.
     *
     * The gate is right and the loss is worth taking. A passage that lands on
     * an assertion is a passage that tells her something, and the whole reason
     * this corpus is questions is that a question makes no claim about the
     * reader. Where the tradition's best line is a question followed by an
     * answer, the answer is somebody else's and it does not go on her page.
     */
    text: 'What then is time?',
    who: 'Augustine of Hippo',
    when: 'Hippo, c. 400',
    where: 'Confessions, XI.14',
    edition: 'tr. E. B. Pusey, 1838',
    themes: ['waiting', 'memory'],
    askedOf: 'himself, in writing',
    verified: false,
  },
  {
    id: 'lot-more',
    text: 'Father, according as I am able I keep my little rule, and my little fast, my prayer, meditation and contemplative silence; and according as I am able I strive to cleanse my heart of my thoughts: now what more should I do?',
    who: 'Abba Lot, to Abba Joseph',
    when: 'Egypt, 4th century',
    where: 'Sayings of the Desert Fathers, Joseph of Panephysis 7',
    edition: 'translation not yet chosen — see README',
    themes: ['littleness', 'staying', 'asking'],
    askedOf: 'his elder',
    verified: false,
  },
  {
    id: 'kempis-humility',
    text: 'What doth it profit thee to discourse profoundly of the Trinity, if thou be lacking in humility?',
    who: 'Thomas à Kempis',
    when: 'Zwolle, c. 1420',
    where: 'The Imitation of Christ, I.1',
    edition: 'tr. William Benham, 1874',
    themes: ['littleness'],
    askedOf: 'a novice reader',
    verified: false,
  },
  {
    id: 'julian-meaning',
    text: "Wouldst thou learn thy Lord's meaning in this thing?",
    who: 'Julian of Norwich',
    when: 'Norwich, c. 1395',
    where: 'Revelations of Divine Love, ch. 86',
    edition: 'tr. Grace Warrack, 1901',
    themes: ['love', 'asking'],
    askedOf: 'her own reader',
    verified: false,
  },
  {
    id: 'ignatius-three',
    text: 'What have I done for Christ? What am I doing for Christ? What ought I to do for Christ?',
    who: 'Ignatius of Loyola',
    when: 'Manresa, c. 1522',
    where: 'The Spiritual Exercises, First Week',
    edition: 'tr. Elder Mullan, 1909',
    themes: ['asking', 'love'],
    askedOf: 'a retreatant, before a crucifix',
    verified: false,
  },
  {
    id: 'poemen-silence',
    text: 'A man may seem to be silent, but if his heart is condemning others he is babbling ceaselessly. And what of the man who talks from morning till night, and keeps silence in the depth of his heart?',
    who: 'Abba Poemen',
    when: 'Egypt, 5th century',
    where: 'Sayings of the Desert Fathers, Poemen 27',
    edition: 'translation not yet chosen — see README',
    themes: ['silence'],
    askedOf: 'a brother who had asked about silence',
    verified: false,
  },
]

/**
 * The join, identical in shape to fathers.ts and identical in what it refuses.
 *
 * Her word → a theme → questions carrying it. No embedding, no model call, no
 * network. One question per theme per reading, taken in the order her words
 * first appear, each taking the first question nobody has taken — so a reading
 * never puts the same question under two of her words.
 *
 * A theme with no question RETURNS NOTHING. On this corpus `silence` is thin
 * and that is fine; the page shows her words with nothing beneath them, which
 * is Principle 4's second half doing its job.
 */
export function questionFor(theme: Theme, taken: Set<string>): TraditionQuestion | null {
  const hit = QUESTIONS.find((q) => q.themes.includes(theme) && !taken.has(q.id))
  if (!hit) return null
  taken.add(hit.id)
  return hit
}

/**
 * The fixture's gate.
 *
 * It cannot check a quote against a book — that is the human work this corpus
 * keeps insisting on. What it CAN check is the one invariant that makes this a
 * questions corpus rather than a quotations corpus: **every row ends in a
 * question mark.** The moment a statement sneaks in, the surface has quietly
 * gone back to telling her things, and it will not look any different.
 *
 * It also refuses a row that has stopped being auditable — no citation, no
 * edition, no addressee. `askedOf` is required precisely because it is the
 * defence: a question with no stated addressee starts to read as addressed to
 * the reader.
 */
export function validateAsking(): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const q of QUESTIONS) {
    if (seen.has(q.id)) problems.push(`${q.id}: duplicate id`)
    seen.add(q.id)
    if (!q.text.trim().endsWith('?')) {
      problems.push(`${q.id}: does not end in a question mark — this corpus is questions, or it is telling her things`)
    }
    if (!q.where.trim()) problems.push(`${q.id}: no citation — a question you cannot check is model memory`)
    if (!q.edition.trim()) problems.push(`${q.id}: no edition — the translation is the part that is owned`)
    if (!q.askedOf.trim()) problems.push(`${q.id}: no addressee — the addressee IS the defence`)
    if (!q.themes.length) problems.push(`${q.id}: no theme, so nothing can ever reach it`)
  }
  return problems
}

/** Themes the lexicon can reach that no question answers. Informational — silence is legal. */
export function themesWithoutQuestion(): Theme[] {
  const reachable = new Set(Object.values(LEXICON))
  return [...reachable].filter((t) => !QUESTIONS.some((q) => q.themes.includes(t)))
}

export function unverifiedQuestions(): number {
  return QUESTIONS.filter((q) => !q.verified).length
}
