/** Every word the year's ledger says. Near-silent, like the rest of the Summit:
 *  no counts, no scores, no verdicts — it arranges the writer's own lines and
 *  names the arrangement plainly. */

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTH_LONG = [
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

/** A marking, said as the thing the writer did. */
export const KIND_COPY = {
  prayer: 'prayed',
  sense: 'sensed',
  learned: 'learned',
  desire: 'wanted',
  story: 'wrote',
  ask: 'asked',
  answered: 'answered',
} as const

export const LEDGER_COPY = {
  eyebrow: 'WHAT THIS YEAR KEPT RETURNING TO',
  caption:
    'A dot for each month you wrote about it. Dotted where you went quiet and came back. Tap one to walk it through the year.',
  // What sort of thread it is — said plainly, because a prayer you've been
  // carrying and a name that keeps appearing are different things side by side.
  kind: { matter: 'from your Altar', name: 'a name in your pages', verse: 'scripture' },
  more: 'more of the year',
  fewer: 'fewer',
  close: 'close',
  cameBack: 'went quiet, and came back to it',
  moved: 'HOW IT MOVED',
  onlyWritten: 'Written about — no prayers or markings on it yet.',
  markings: 'YOUR MARKINGS ON IT',
  scripture: 'SCRIPTURE THAT TRAVELLED WITH IT',
  noScripture: 'No verses written beside it.',
  crossed: 'SHARED A PAGE WITH',
  noCrossed: 'It kept its own pages.',
  quietIn: (month: string) => `quiet in ${month}`,
  quietSpan: (from: string, to: string) => `quiet ${from} – ${to}, then you came back to it`,
  quietSince: (month: string) => `quiet since ${month}`,
  setApart: 'you set one apart',
  turned: 'turned',
  moreThatMonth: 'and more that month',
  stonesEyebrow: 'THE STONES OF THE YEAR',

  // ── told back (passages) ───────────────────────────────────────────────
  stillGoing: 'still going',
  lastWritten: (month: string) => `last written in ${month}`,
  openPage: 'open page →',
  stillBeingWritten: (day: string) => `…still being written. Last on ${day}.`,
  writeAbout: 'Write about this →',
  wholeThread: 'the whole thread, across your volumes →',
  writeHint: 'a new page, with these lines above it',

  // ── the write sheet ────────────────────────────────────────────────────
  newPage: 'a new page · private, in your journal',
  ordinaryEntry: 'An ordinary entry. The lines above stay exactly as you wrote them.',
  startWriting: 'Start writing →',

  // ── the climb ──────────────────────────────────────────────────────────
  alive: 'WHAT’S ALIVE THIS MONTH',
  aliveNone: 'Only your pages this month — nothing you’ve been carrying came up.',
  newInPages: 'NEW IN YOUR PAGES',
  newNone: 'No one new came into your pages.',
  photos: 'PHOTOS',
  photosNone: 'No photos on these pages.',
  since: (day: string) => `since ${day}`,
  newThisMonth: 'new this month',
  stillBeingWrittenShort: 'still being written',
  writeAboutSpan: (label: string) => `Write about ${label} →`,
  spanSoFar: (label: string) => `${label}, so far`,
  spanWriteHint: 'A new page with these lines above it, and a question you choose.',
  movedSeason: (season: string) => `WHAT MOVED THIS ${season.toUpperCase()}`,
  began: 'Began',
  cameBackPile: 'Came back',
  carried: 'Carried through',
  quietPile: 'Went quiet',
  notYet: (season: string) => `Not yet this ${season}`,
  beganWhat: (season: string) => `First written about this ${season}.`,
  cameBackWhat: (prev: string) => `Here after going quiet through ${prev}.`,
  carriedWhat: (prev: string) => `Here in ${prev}, and still here.`,
  quietWhat: (prev: string) => `Here in ${prev} — quiet since.`,
  notYetWhat: (prev: string, season: string) => `Here in ${prev} — not yet this ${season}.`,
  beganNone: 'Nothing new began.',
  cameBackNone: 'Nothing came back after a quiet stretch.',
  carriedNone: (prev: string) => `Nothing carried over from ${prev}.`,
  quietNone: 'Nothing went quiet.',
  pileOpen: 'see the whole thread →',
  notYetNone: (prev: string) => `Everything from ${prev} has come up.`,
  seasonYoung: 'The season is still young — what’s “not yet” here may simply not have come up.',
  hemisphere: 'northern hemisphere',
  yearTold: 'WHAT THE YEAR KEPT RETURNING TO',
  yearNew: 'NEW IN YOUR PAGES THIS YEAR',
  yearWrite: 'The year so far, in one page',
  yearWriteSealed: (year: number) => `${year}, in one page`,
  yearWriteHint: 'A new page with a line from each of these above it, and a question you choose.',
  yearWriteCta: 'Write about the year so far →',
  yearWriteCtaSealed: (year: number) => `Write about ${year} →`,
  nowNote: (month: string, year: number) => `It’s ${month}. ${year} is still being written — it closes Dec 31.`,
  moreThreads: 'more of the year ↓',

  youAsked: 'you asked',
  later: 'later, this',
}
