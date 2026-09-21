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
  kind: { matter: 'from the Altar', name: 'a name', verse: 'scripture' },
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
  youAsked: 'you asked',
  later: 'later, this',
}
