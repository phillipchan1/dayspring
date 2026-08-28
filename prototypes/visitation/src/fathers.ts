/**
 * The council — a second grounded corpus.
 *
 * ── The doctrine this whole file exists to make possible ────────────────────
 *
 * Everything the product shows about a person's life traces to a row they
 * wrote. That rule (Principle 4) is what keeps the app out of the oracle's
 * chair, and it has always implied a second rule nobody had to write down:
 * the app may show her nothing but her own words.
 *
 * This is the one place that second rule is deliberately relaxed, and the
 * relaxation is narrow enough to state in a sentence:
 *
 *   TWO GROUNDED CORPORA — HERS AND THE CHURCH'S — AND NOTHING BETWEEN THEM.
 *
 * A passage here is as verbatim, as cited, and as un-generated as one of her
 * own sentences. It comes out of a table. The model never writes it, never
 * paraphrases it, and — see the join below — never picks it either. What is
 * forbidden is the sentence that would sit *between* the two: any bridge,
 * gloss, application, or "this may speak to your season." The app sets her
 * page beside a father's page and says nothing at all. See RECALL.md Act four:
 * "The app says nothing here on purpose."
 *
 * ── Why the model is not in this loop ───────────────────────────────────────
 *
 * The obvious build is: embed the span, embed the corpus, return the nearest
 * passage. It fails GUARDRAILS H4 on contact. Selection IS counsel — if the
 * app reads a dry season and reaches for a passage on perseverance, the app
 * has just told her what her dry season means and what to do about it, and
 * dressing that in Chrysostom's voice does not launder it. It makes it worse,
 * because now the advice arrives with sixteen centuries of authority behind
 * it.
 *
 * So the join is arithmetic, in three hops, all auditable:
 *
 *   a word she wrote  →  a theme (this file's LEXICON, editorial, fixed)
 *                     →  passages carrying that theme (this file's tags)
 *
 * No embedding, no model call, no network. The lexicon is a stored editorial
 * judgement made once, in the open, that a reader can disagree with — which is
 * a different kind of object from a judgement a model makes about her, freshly,
 * every month, in private.
 *
 * The consequence worth stating: THE PIN IS ALWAYS ON SCREEN. Every passage
 * carries the word of hers that reached it. If the word is wrong, the pin is
 * visibly wrong, and she can see that it is wrong. A model-selected passage
 * offers nothing to check.
 *
 * ── H3, and why nothing here came out of model memory ───────────────────────
 *
 * Patristic quotation on the internet is a swamp: a large share of what
 * circulates under Augustine's name he never wrote. A fabricated father in a
 * spiritual journal is the exact H3 betrayal that the scripture layer already
 * exists to prevent, and it is worse than a misquoted verse, because there is
 * no concordance in the user's head to catch it. She will retell it.
 *
 * Therefore the same architecture as scripture: THE TEXT COMES FROM THE DATA
 * LAYER. This file is the data layer, and it is small on purpose.
 *
 * ── The honest state of this fixture ────────────────────────────────────────
 *
 * `verified: false` on every row below, and that is not a formality.
 * NOT ONE LINE HERE HAS BEEN CHECKED AGAINST A PRINTED SOURCE. They were
 * written down from memory, which is precisely the failure mode the feature
 * exists to prevent, reproduced inside the prototype that argues for it.
 *
 * That is deliberate and it is the finding: the council is not a prompting
 * problem, it is a LIBRARY problem. Building it for real means someone sitting
 * with public-domain editions and typing, and the work is measured in weeks,
 * not in tokens. See README § "The corpus is the feature."
 *
 * ── And the rights problem underneath it ────────────────────────────────────
 *
 * `edition` is a required field because the translation is the part that is
 * owned. The Ante-Nicene Fathers (1885), Pusey's Augustine (1838), Warrack's
 * Julian (1901) and Longfellow's Teresa are safely public domain and read as
 * Victorian. The renderings a modern person would actually want — Ward's
 * desert fathers above all — are in copyright and would have to be licensed.
 *
 * So the real choice is: archaic and free, or contemporary and licensed. That
 * is a decision with a budget attached and it should be made before a line of
 * this ships.
 */

export type Theme =
  | 'staying'
  | 'memory'
  | 'desire'
  | 'waiting'
  | 'silence'
  | 'littleness'
  | 'love'
  | 'asking'

export type Passage = {
  id: string
  /** Verbatim. Byte-identical to the cited edition, or it does not ship. */
  text: string
  /** Who wrote it. Never rendered as a speaker — see README § "not a séance". */
  who: string
  /** Roughly when, for the reader's own sense of distance. */
  when: string
  /** The work and the locus. A citation you can go and check. */
  where: string
  /** The translation, because the translation is the part that is owned. */
  edition: string
  themes: Theme[]
  /**
   * Checked against a printed source by a person.
   *
   * False on every row in this fixture. A shipped corpus with a false here
   * is a P0 — the row does not render.
   */
  verified: boolean
}

/**
 * Twelve passages. A shipped corpus would be a few hundred and no more.
 *
 * The ceiling is not technical. A council you could read through in an evening
 * is a council; ten thousand rows is a search index, and a search index over
 * the fathers is a different product that somebody else should build.
 */
export const PASSAGES: Passage[] = [
  {
    id: 'moses-cell',
    text: 'Go, sit in your cell, and your cell will teach you everything.',
    who: 'Abba Moses',
    when: 'Egypt, 4th century',
    where: 'Sayings of the Desert Fathers, Moses 6',
    edition: 'translation not yet chosen — see README',
    themes: ['staying', 'silence'],
    verified: false,
  },
  {
    id: 'julian-overcome',
    text: 'He said not: Thou shalt not be tempested, thou shalt not be travailed, thou shalt not be afflicted; but He said: Thou shalt not be overcome.',
    who: 'Julian of Norwich',
    when: 'Norwich, c. 1395',
    where: 'Revelations of Divine Love, ch. 68',
    edition: 'tr. Grace Warrack, 1901',
    themes: ['staying', 'waiting'],
    verified: false,
  },
  {
    id: 'augustine-restless',
    text: 'Thou hast made us for Thyself, and our heart is restless, until it repose in Thee.',
    who: 'Augustine of Hippo',
    when: 'Hippo, c. 400',
    where: 'Confessions, I.1',
    edition: 'tr. E. B. Pusey, 1838',
    themes: ['desire'],
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
    verified: false,
  },
  {
    id: 'augustine-late',
    text: 'Late have I loved Thee, O Beauty so ancient and so new; late have I loved Thee!',
    who: 'Augustine of Hippo',
    when: 'Hippo, c. 400',
    where: 'Confessions, X.27',
    edition: 'tr. E. B. Pusey, 1838',
    themes: ['desire', 'love'],
    verified: false,
  },
  {
    id: 'ignatius-silence',
    text: 'It is better to keep silence and to be, than to talk and not to be.',
    who: 'Ignatius of Antioch',
    when: 'on the road to Rome, c. 107',
    where: 'To the Ephesians, 15',
    edition: 'tr. J. B. Lightfoot, 1885',
    themes: ['silence'],
    verified: false,
  },
  {
    id: 'ignatius-anvil',
    text: 'Stand thou firm, as an anvil when it is smitten.',
    who: 'Ignatius of Antioch',
    when: 'on the road to Rome, c. 107',
    where: 'To Polycarp, 3',
    edition: 'tr. J. B. Lightfoot, 1885',
    themes: ['staying'],
    verified: false,
  },
  {
    id: 'lawrence-little',
    text: 'That we ought not to be weary of doing little things for the love of God, who regards not the greatness of the work, but the love with which it is performed.',
    who: 'Brother Lawrence',
    when: 'Paris, c. 1670',
    where: 'The Practice of the Presence of God, Fourth Conversation',
    edition: 'tr. anon., 1692 · public domain',
    themes: ['littleness', 'love'],
    verified: false,
  },
  {
    id: 'teresa-nothing',
    text: 'Let nothing disturb thee, nothing affright thee; all things are passing; God never changeth.',
    who: 'Teresa of Ávila',
    when: 'Ávila, c. 1570',
    where: 'lines found in her breviary',
    edition: 'tr. H. W. Longfellow, 1867',
    themes: ['staying', 'waiting'],
    verified: false,
  },
  {
    id: 'antony-temptation',
    text: 'Whoever has not experienced temptation cannot enter into the Kingdom of Heaven.',
    who: 'Abba Antony',
    when: 'Egypt, 4th century',
    where: 'Sayings of the Desert Fathers, Antony 5',
    edition: 'translation not yet chosen — see README',
    themes: ['waiting', 'staying'],
    verified: false,
  },
  {
    id: 'poemen-heart',
    text: 'A man may seem to be silent, but if his heart is condemning others he is babbling ceaselessly.',
    who: 'Abba Poemen',
    when: 'Egypt, 5th century',
    where: 'Sayings of the Desert Fathers, Poemen 27',
    edition: 'translation not yet chosen — see README',
    themes: ['silence'],
    verified: false,
  },
  {
    id: 'clement-love',
    text: 'Love beareth all things, is long-suffering in all things.',
    who: 'Clement of Rome',
    when: 'Rome, c. 96',
    where: 'First Epistle to the Corinthians, 49',
    edition: 'tr. J. B. Lightfoot, 1885',
    themes: ['love'],
    verified: false,
  },
  /*
   * Added because validateCouncil() refused the build: the lexicon reached
   * `asking` and nothing carried it. That is the gate doing its only job —
   * a theme with no passage is a word that would have arrived at silence
   * without anybody deciding it should.
   */
  {
    id: 'julian-beseeching',
    text: 'Beseeching is a true, gracious, lasting will of the soul, oned and fastened into the will of our Lord by the sweet, inward work of the Holy Ghost.',
    who: 'Julian of Norwich',
    when: 'Norwich, c. 1395',
    where: 'Revelations of Divine Love, ch. 41',
    edition: 'tr. Grace Warrack, 1901',
    themes: ['asking'],
    verified: false,
  },
]

/**
 * Her word → a theme. The whole of the app's judgement, written down.
 *
 * This table is the feature's only inference, and it is deliberately the most
 * boring, most inspectable object it could possibly be: a fixed list somebody
 * typed, that a reader can argue with, that does not change between months and
 * does not know whose archive it is being run against.
 *
 * Two properties fall out of that, and both matter more than accuracy:
 *
 *   · IT IS THE SAME FOR EVERY USER. A model choosing per-person is
 *     characterising a person. A lookup table cannot characterise anybody —
 *     it does not know who you are.
 *   · IT IS THE SAME EVERY TIME. The same span always reaches the same
 *     passages. See README § "deterministic, and why that beats randomised".
 *
 * Keys are matched as whole words against her own text, case-folded. Nothing
 * is stemmed, because stemming is where "still" quietly becomes "stillness"
 * and the pin stops being a word she actually typed.
 */
export const LEXICON: Record<string, Theme> = {
  still: 'staying',
  stay: 'staying',
  stayed: 'staying',
  keep: 'staying',
  remain: 'staying',

  remember: 'memory',
  remembered: 'memory',
  forget: 'memory',
  forgot: 'memory',
  memory: 'memory',

  want: 'desire',
  wanted: 'desire',
  wish: 'desire',
  longing: 'desire',

  waiting: 'waiting',
  wait: 'waiting',
  waited: 'waiting',

  quiet: 'silence',
  silence: 'silence',
  silent: 'silence',

  small: 'littleness',
  smaller: 'littleness',
  little: 'littleness',

  love: 'love',
  loving: 'love',
  loved: 'love',

  ask: 'asking',
  asked: 'asking',
  asking: 'asking',
}

export type Pin = {
  /** Her word, verbatim and lower-cased. Always rendered. */
  word: string
  theme: Theme
  /** Entry ids the word appears in. The floor is two — see span.ts. */
  entryIds: string[]
  passages: Passage[]
}

/**
 * The join, and the one rule that makes it honest.
 *
 * A word with no theme, or a theme with no passage, RETURNS NOTHING AND SAYS
 * NOTHING. Principle 4 is called "grounded, or silent" and the second half is
 * the half everybody drops: the temptation is to reach one shelf over and put
 * *something* beside a word rather than leave the space empty.
 *
 * On this fixture `maybe` is the word that gets silence, and it is one of the
 * loudest words in her summer. Leaving it bare is the feature working.
 *
 * ── One passage, once ───────────────────────────────────────────────────────
 *
 * A reading may not use the same passage twice. The first build did, and it
 * was the ugliest thing on the screen: `keep` and `still` both reach `staying`,
 * so Abba Moses's cell appeared under both, four inches apart. Two of her words
 * answered by one sentence does not read as a coincidence — it reads as the
 * machine having a single trick, and it retroactively cheapens the pin that was
 * good.
 *
 * The claim is deliberately taken in the order her words first appear, and each
 * takes the first passage nobody has taken. Both halves are arithmetic: word
 * order is her chronology, passage order is this file's. Nothing weighs
 * anything, and a second run gives the same answer.
 */
export function pinsFor(words: { word: string; entryIds: string[] }[]): Pin[] {
  const out: Pin[] = []
  const taken = new Set<string>()
  for (const w of words) {
    const theme = LEXICON[w.word]
    if (!theme) continue
    const passages = PASSAGES.filter((p) => p.themes.includes(theme) && !taken.has(p.id))
    if (!passages.length) continue
    taken.add(passages[0].id)
    out.push({ word: w.word, theme, entryIds: w.entryIds, passages })
  }
  return out
}

/**
 * The fixture's own gate, matching validateMarkings() in corpus.ts.
 *
 * It cannot check a quote against a book — that is the human work this file
 * keeps insisting on. What it CAN check is that the corpus never quietly loses
 * the thing that makes it checkable: a citation, an edition, a theme that
 * reaches something. A row that has stopped being auditable is a row that has
 * started being model memory with extra steps.
 */
export function validateCouncil(): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  for (const p of PASSAGES) {
    if (seen.has(p.id)) problems.push(`${p.id}: duplicate id`)
    seen.add(p.id)
    if (!p.where.trim()) problems.push(`${p.id}: no citation — a passage you cannot check is model memory`)
    if (!p.edition.trim()) problems.push(`${p.id}: no edition — the translation is the part that is owned`)
    if (!p.themes.length) problems.push(`${p.id}: no theme, so nothing can ever reach it`)
    if (p.text !== p.text.trim()) problems.push(`${p.id}: padded whitespace, which breaks byte-identity`)
  }
  for (const [word, theme] of Object.entries(LEXICON)) {
    if (!PASSAGES.some((p) => p.themes.includes(theme))) {
      problems.push(`lexicon "${word}" → ${theme}, which no passage carries`)
    }
  }
  return problems
}

/** How many rows would refuse to render under the shipping rule. */
export function unverifiedCount(): number {
  return PASSAGES.filter((p) => !p.verified).length
}
