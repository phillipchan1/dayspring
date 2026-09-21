/**
 * THE ASCENT — the single editable CONSTANTS block (copy + per-altitude config).
 *
 * Looking Back is not four reports; it is ELEVATION over one terrain. Week /
 * Month / Season / Year are four ALTITUDES, named by the calendar (the old
 * Valley / Hillside / Ridge / Summit were internal words and are gone from the UI).
 * The higher you climb, the LESS the app interprets: it arranges, then names
 * tentatively, then only asks, then goes nearly silent and returns your own
 * marks. All user-facing copy lives here so the voice stays in one place.
 *
 * Guardrails encoded by omission: no verdict copy, no countdown, no streak/score
 * framing, no resolution of tensions. Keep it that way when you edit.
 */

export type AltitudeKey = 'week' | 'month' | 'quarter' | 'year'

export interface AltitudeMeta {
  key: AltitudeKey
  /** Sidebar destination label. */
  label: string
  /** The altitude name (the terrain). */
  alt: string
  /** Header title for the altitude. */
  title: string
  /** One-line description of what this altitude is and who makes the meaning. */
  line: string
  /** Air gradient [top-sky, bottom-warm] — night at the Valley, gold toward the Summit. */
  air: [string, string]
  /** Light-theme (dawn) air ramp — pale daybreak warming to golden morning. */
  airLight: [string, string]
  /** The quiet app-voice footnote under the altitude's content. */
  voice: string
  /** Tone class for the voice line ('quiet' dims it; 'ask' tints it gold). */
  voiceTone?: 'quiet' | 'ask'
}

/** Ordered Valley → Summit. `idx` in the view maps to this array. */
export const ALTITUDES: AltitudeMeta[] = [
  {
    key: 'week',
    label: 'Week',
    alt: 'WEEK',
    title: 'Standing in the days.',
    line: 'Close to the ground — your own words and what you reached for, in the order you lived them. The app only arranges.',
    air: ['#0d1018', '#141a28'],
    airLight: ['#eef1f6', '#f7f1e8'],
    voice: 'in order, nothing interpreted yet — you’re close enough to feel them.',
    voiceTone: 'quiet',
  },
  {
    key: 'month',
    label: 'Month',
    alt: 'MONTH',
    title: 'What you kept returning to.',
    line: 'Step back and the same dimensions resolve at month scale — the lines you kept, the verse you returned to. Named only as a question.',
    air: ['#10131e', '#1d1f30'],
    airLight: ['#f0eef4', '#f8f0e3'],
    voice: '↑ the app names what seems to connect — tentatively. Each is yours to rename or wave off.',
  },
  {
    key: 'quarter',
    // 'Season' out loud, 'quarter' in the schema: the tier is a calendar quarter
    // and every Remember surface now names that span the same way (src/lib/period.ts).
    label: 'Season',
    alt: 'SEASON',
    title: 'The season, distilled.',
    line: 'Step back to the season: the phrases you circled, its anchor passage, the prayer and its first signs. The app holds them up and hands them back.',
    air: ['#15131f', '#2a2233'],
    airLight: ['#f3eef2', '#faeede'],
    voice: '↑ the app asks; it never answers. These go back to you, and to God — not to a verdict.',
    voiceTone: 'ask',
  },
  {
    key: 'year',
    label: 'Year',
    alt: 'YEAR',
    title: 'Looking back down the year.',
    line: 'The quietest ground. Your own words and the stones you set — looking back down the trail you climbed. The app nearly disappears.',
    air: ['#1b1620', '#4a352f'],
    airLight: ['#faf0e2', '#fbe4c6'],
    voice: '',
  },
]

/**
 * The climb, told back (alpha — the year's ledger). Each altitude has ONE job,
 * and each is named by the calendar, never by the app: "This week",
 * "September", "Fall 2026", "2026". Titles say what the altitude is for.
 */
export const LEDGER_ALTITUDES: Record<AltitudeKey, { title: string; line: string }> = {
  week: {
    title: 'Standing in the days.',
    line: 'Just your pages, in the order you lived them. Nothing is told back at this height.',
  },
  month: {
    title: 'What’s alive right now.',
    line: 'Step back a month: what you’ve been carrying, who was new, the photos. Your own lines — nothing named for you.',
  },
  quarter: {
    title: 'What moved this season.',
    line: 'Step back to the season: what began, what came back, what carried through, what went quiet. Dates, not meanings.',
  },
  year: {
    title: 'Looking back down the year.',
    line: 'The threads you kept returning to, in your own words — and then a page of your own about them.',
  },
}

/** Per-altitude empty / insufficient copy (derivable client-side, no infra). */
export const EMPTY_COPY: Record<AltitudeKey, { empty: string; insufficient: string }> = {
  week: {
    empty: 'Nothing written here yet. The week fills as you do — start with today.',
    insufficient: 'A day or two in. Keep writing — the week takes shape as you live it.',
  },
  month: {
    empty: 'Nothing here yet. After a few weeks of writing, the recurring threads appear here.',
    insufficient: 'The month takes shape once a few weeks of writing are behind you.',
  },
  quarter: {
    empty: 'Nothing here yet. What you circle surfaces after a season of entries.',
    insufficient: 'The season needs a few months of writing before the long view appears.',
  },
  year: {
    empty: 'The trail is the year. It fills as you walk it — each month you write adds to what the year can show you.',
    insufficient: 'The year is forming. Come back as the months fill in.',
  },
}

/** Climb-control captions (kept off the casino path — no countdowns, no scores). */
export const CONTROLS = {
  descend: '↓ descend',
  ascend: 'ascend ↑',
  atSummit: 'the whole year',
  toNext: (label: string) => `climb to see the ${label.toLowerCase()}`,
}

/** Summit labels — near-silent. The Summit returns the user's own marks; the app
 *  arranges and points, and otherwise goes quiet (no progress, no counts).
 *
 *  Note what is NOT here: nothing names how far through the year you are, how
 *  many entries it holds, or how long since you last wrote. The trail shows the
 *  calendar and the stones show your life; neither is ever put into words as a
 *  measure. */
export const SUMMIT_COPY = {
  lookingBack: 'looking back down the year — the trail so far, and the stones set along it',
  /** The closing question — a question, never a verdict. Yours to name. */
  taught: 'Looking back down the trail — what did He teach you this year?',

  // ── the years behind you ──────────────────────────────────────────────────
  // A sealed year is not a worse version of the open one: it is the whole thing,
  // walked. So it says so plainly and drops everything provisional — no "since
  // your last climb", no invitation to write. Those belong to the year that is
  // still running.
  yearRailLabel: 'The years behind you',
  lookingBackSealed: (year: number) => `${year}, all the way up — and the stones set along it`,
  sealedReading: (year: number) => `Reading ${year}…`,
  sealedEmpty: (year: number) =>
    `${year} can’t be read yet. It needs its months built before the year can be read.`,

  // ── stones ────────────────────────────────────────────────────────────────
  stonesEyebrow: 'THE STONES OF THE YEAR',
  stoneLabel: (dateLabel: string) => `A stone set ${dateLabel} — open it`,
  stoneAsk: 'you asked',
  stoneLater: 'later, this',
  stoneClose: 'close',
  stonesEmpty: 'No stones yet. One is set when something you asked for is met by something you later wrote.',
  stonesHint: 'tap a stone on the trail',

  // ── the long look (folded: the app is quiet here unless asked) ────────────
  longLookOpen: 'the long look →',
  longLookClose: 'the long look ↓',
  longLookWaiting: 'the long look needs a few months under it',
  longLookFooter: 'drawn from the months of this year · what it means is yours to name',

  // ── the year's naming (the one edge that runs back into the journal) ──────
  namingEyebrow: 'WHAT HE TAUGHT YOU THIS YEAR',
  namingWrite: 'write it →',
  namingOpen: 'open it →',
  namingStarted: 'A page is waiting for this.',
  namingBy: (dateLabel: string) => `you wrote this, ${dateLabel}`,
  namingHeading: (year: number) => `What He taught me in ${year}`,

  // ── since your last climb (content that arrived, never behaviour) ─────────
  sinceStone: (month: string) => `since your last climb · a stone set in ${month.toLowerCase()}`,
  sinceStones: (n: number) => `since your last climb · ${n} stones set`,
  sinceRefrain: 'since your last climb · a line rose to the top',
}

// ── DIMENSIONS — the stable four, across every altitude ──────────────────────
// The redesign's spine: the SAME dimensions persist as you climb and only change
// RESOLUTION. The eyebrow over each block names its resolution. Higher = quieter.

/** Per-dimension, per-altitude eyebrow labels (the only words the app supplies). */
export const DIMENSION_COPY = {
  words: {
    week: 'YOUR WORDS · IN ORDER',
    month: 'THE LINES YOU KEPT',
    quarter: 'THE PHRASES YOU CIRCLED',
    year: 'THE ONE LINE OF THE YEAR',
    empty: 'nothing here yet — the page is the soul of it.',
    // Eyebrow when the grounded themes layer leads (the highlights).
    themes: {
      week: 'WHAT SURFACED THIS WEEK',
      month: 'THE THREADS THIS MONTH',
      quarter: 'WHAT HELD THIS SEASON',
      year: 'THE THREAD OF THE YEAR',
    },
    inOrder: 'the week, in order',
    lines: (n: number) => `${n} ${n === 1 ? 'line' : 'lines'}`,
  },
  scripture: {
    week: 'WHAT YOU REACHED FOR',
    month: 'THE MONTH’S RECURRING VERSE',
    quarter: 'THE SEASON’S ANCHOR PASSAGE',
    year: 'THE VERSE OF THE YEAR',
    empty: 'no scripture surfaced here yet.',
    inEntries: (n: number) => `in ${n} ${n === 1 ? 'entry' : 'entries'}`,
    suggested: (n: number) => `${n} quieter ${n === 1 ? 'allusion' : 'allusions'} waiting →`,
    open: 'follow it →',
  },
  prayer: {
    month: 'WHAT YOU KEPT ASKING',
    quarter: 'THE PRAYER, AND FIRST SIGNS',
    year: 'THE PRAYER, AND THE EBENEZER',
    pattern: 'pattern only — the prayers themselves rest on the Wall.',
    open: 'follow the asks →',
    ebenezerArrow: '→',
  },
  learning: {
    month: 'YOU STARTED TO SEE…',
    quarter: 'WHAT YOU NOW HOLD',
    year: 'WHAT HE TAUGHT YOU THIS YEAR',
    open: 'see how it was woven →',
    note: 'a question, not a verdict — yours to name.',
  },
} as const

/** The "watching this season" lens row — attention, not a filter bar. */
export const LENS_COPY = {
  label: 'WATCHING THIS SEASON',
  add: '+ lens',
  addPlaceholder: 'name a lens…',
  edit: 'edit',
  done: 'done',
  remove: 'remove',
}

/** Drill-in shells — quiet, dismissible. */
export const DRILL_COPY = {
  close: 'close',
  scriptureTitle: (verse: string) => `Where you reached for ${verse}`,
  scriptureRise: 'its rise as you climbed',
  scriptureConfirm: 'I was reaching for this',
  scriptureConfirmed: 'confirmed ✓',
  scriptureSuggested: 'a quieter echo — was this here?',
  learningFooter: 'the app gathers the threads · what they mean is yours to name',
  learningCarry: 'carry into prayer →',
  learningTop: 'WHAT YOU’RE COMING TO SEE',
  prayerTitle: 'What you kept asking',
  prayerConfirm: 'set this as a stone',
  prayerConfirmed: 'a stone is set ✓',
  prayerEvidence: 'later, this —',
  earlier: 'EARLIER IN THE SEASON',
  themeFooter: 'these are your own words, gathered · what they mean is yours',
}
