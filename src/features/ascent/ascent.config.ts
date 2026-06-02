/**
 * THE ASCENT — the single editable CONSTANTS block (copy + per-altitude config).
 *
 * Looking Back is not four reports; it is ELEVATION over one terrain. Week /
 * Month / Quarter / Year are four ALTITUDES — Valley, Hillside, Ridge, Summit.
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
    alt: 'VALLEY',
    title: 'Standing in the days.',
    line: 'Close to the ground — your own words, in the order you lived them. The app only arranges.',
    air: ['#0d1018', '#141a28'],
    airLight: ['#eef1f6', '#f7f1e8'],
    voice: 'in order, nothing interpreted yet — you’re close enough to feel them.',
    voiceTone: 'quiet',
  },
  {
    key: 'month',
    label: 'Month',
    alt: 'HILLSIDE',
    title: 'What you kept returning to.',
    line: 'Step back and the entries cluster. These are the threads that recurred — named, but only as a question.',
    air: ['#10131e', '#1d1f30'],
    airLight: ['#f0eef4', '#f8f0e3'],
    voice: '↑ the app names what seems to connect — tentatively. Each is yours to rename or wave off.',
  },
  {
    key: 'quarter',
    label: 'Quarter',
    alt: 'RIDGE',
    title: 'The tensions you’ve been living inside.',
    line: 'From the ridge, events fall away — what’s left are the questions you keep circling. The app holds them up and hands them back.',
    air: ['#15131f', '#2a2233'],
    airLight: ['#f3eef2', '#faeede'],
    voice: '↑ the app asks; it never answers. These go back to you, and to God — not to a verdict.',
    voiceTone: 'ask',
  },
  {
    key: 'year',
    label: 'Year',
    alt: 'SUMMIT',
    title: 'Still being written.',
    line: 'The summit can’t exist until you’ve climbed the year — so it forms in the open, from the stones you’ve set yourself.',
    air: ['#1b1620', '#4a352f'],
    airLight: ['#faf0e2', '#fbe4c6'],
    voice: '',
  },
]

/** Months in a year — the Summit's denominator (poetic height, not a progress ring). */
export const YEAR_MONTHS = 12

/** Per-altitude empty / insufficient copy (derivable client-side, no infra). */
export const EMPTY_COPY: Record<AltitudeKey, { empty: string; insufficient: string }> = {
  week: {
    empty: 'Nothing written here yet. The valley fills as you do — start with today.',
    insufficient: 'A day or two in. Keep writing — the week takes shape as you live it.',
  },
  month: {
    empty: 'No hillside yet. After a few weeks of writing, the recurring threads appear here.',
    insufficient: 'Your first hillside forms once a month of writing is behind you.',
  },
  quarter: {
    empty: 'No ridge yet. The tensions you circle surface after a season of entries.',
    insufficient: 'The ridge needs a few months below it before the long view appears.',
  },
  year: {
    empty: 'The summit forms as you climb. Each entry, prayer, and verse sets a stone on the trail.',
    insufficient: 'The summit is forming. Come back as the months fill in.',
  },
}

/** Climb-control captions (kept off the casino path — no countdowns, no scores). */
export const CONTROLS = {
  descend: '↓ descend',
  ascend: 'ascend ↑',
  atSummit: 'at the summit',
  toNext: (label: string) => `climb to see the ${label.toLowerCase()}`,
}

/** Valley labels. */
export const VALLEY_COPY = {
  open: '→ open entry',
}

/** Hillside (arc) edit labels. */
export const HILLSIDE_COPY = {
  drawnFrom: (n: number) => `drawn from ${n} ${n === 1 ? 'entry' : 'entries'}`,
  rename: 'rename',
  dismiss: 'wave off',
  merge: 'merge',
  renamePlaceholder: 'name this thread…',
  save: 'save',
  cancel: 'cancel',
  mergeHint: 'pick a thread to merge into',
}

/** Ridge (tension) labels. The action carries a tension to the Altar — never resolves it. */
export const RIDGE_COPY = {
  carry: 'carry into prayer →',
  carried: 'laid on the altar ✓',
  carrying: 'carrying…',
}

/** Summit labels — selecting + arranging the user's own marks, near-silent. */
export const SUMMIT_COPY = {
  monthsLine: (done: number, total: number) =>
    `${done} of ${total} months written · the summit forms as you climb`,
  prayersLabel: 'prayers He met you in',
  verseLabel: 'the verse you keep returning to',
  refrainLabel: 'A LINE FROM YOUR OWN WRITING, SURFACING ALL YEAR',
  refrainNote: '— you wrote this, and kept writing toward it. The app only noticed.',
  whole: 'the year stands whole · written',
}

/** "Your Year, Unfolding" — a growing gift, never a locked one. */
export const WRAPPED_COPY = {
  kickerForming: (pct: number) => `✦ YOUR YEAR, UNFOLDING · forming ${pct}%`,
  kickerComplete: '✦ YOUR YEAR, UNFOLDING',
  teaserForming:
    'The full look-back completes when the year does — not a locked gift, a growing one. You’ll have filled it yourself.',
  teaserComplete: 'The year is whole. Step through it, in your own words and marks.',
  open: 'open your year →',
  arrivesInDecember: 'arrives in December',
  throughlineLabel: 'THE THROUGHLINE',
  versePeek: 'most-returned verse',
  prayersPeek: 'prayers He met you in',
  seasonPeek: 'the season you wrote most',
  // Review card headers (shown only when the year is complete).
  cards: {
    versePeek: 'The verse you kept returning to',
    prayersPeek: 'Prayers He met you in',
    seasonPeek: 'You wrote most in',
    refrain: 'The line you kept writing toward',
  },
  next: 'next →',
  prev: '← back',
  done: 'close',
}

/** Season name for a month index (0–11) — for "the season you wrote most". */
export function seasonOf(monthIndex: number): string {
  if (monthIndex <= 1 || monthIndex === 11) return 'Winter'
  if (monthIndex <= 4) return 'Spring'
  if (monthIndex <= 7) return 'Summer'
  return 'Autumn'
}
