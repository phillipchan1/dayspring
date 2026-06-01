/**
 * Looking Back — the reflection content model.
 *
 * This is the typed seam between the UI and the two engines that will feed it:
 *
 *   • Insight Layer (output) — synthesizes what's already written into the
 *     retrospective prose. Each horizon reads the ROLLUP OF THE LEVEL BENEATH
 *     it, never raw entries (except weekly). That cascade is why each horizon
 *     has a different character — and it's a cost rule, not just a content one.
 *       week    → raw entries of that week (may cite specific days)
 *       month   → the 4 weekly summaries (speaks in arcs, not days)
 *       quarter → the 3 monthly summaries
 *       year    → the monthly / yearly summaries
 *
 *   • Reflective Prompting (input) — produces the QUESTION that seeds the next
 *     entry. The AI asks; it never answers. Questions are addressed to self or
 *     God, never analytical or quiz-like.
 *
 * Everything is lens-aware: the user's active lenses (Gain, gratitude,
 * spiritual/scripture, work, trading discipline, family) shape both the
 * synthesis and the questions. For this task the data is stubbed — see
 * getReflection() at the bottom — but the SHAPES and VOICE here are real.
 */

export type Horizon = 'week' | 'month' | 'quarter' | 'year'

/** Lenses that color synthesis + prompting. A default set is assumed for now. */
export type Lens = 'gain' | 'gratitude' | 'spiritual' | 'work' | 'trading' | 'family'

/**
 * A resurfaced excerpt in the user's OWN words. The hero unit of the whole
 * surface — always tappable to open the source entry in Read.
 */
export interface Excerpt {
  entryId: string
  /** YYYY-MM-DD. */
  date: string
  text: string
}

/**
 * Reflective-Prompting output. The AI asks, never answers; `addressee` shapes
 * tone (a question to God reads differently than one to yourself). Always
 * dismissible — an affordance, never an ambush.
 */
export interface Question {
  id: string
  text: string
  addressee: 'self' | 'God'
}

/**
 * One atomic win. Persisted as a structured_payload `win` record (see
 * recordWin). `suggested` = AI-prefilled candidate the user hasn't confirmed
 * or edited yet (shown quietly until they make it theirs).
 */
export interface Win {
  id: string
  text: string
  suggested: boolean
}

/** The verdict the USER assigns an Ebenezer pairing. AI never marks this. */
export type EbenezerMark = 'unmarked' | 'answered' | 'not_yet' | 'no'

/**
 * An Ebenezer pairing: an earlier ask set BESIDE a later entry that references
 * the same thing as changed. The AI only PAIRS, and only above a high textual-
 * confidence bar — below it, it stays silent (better to miss a connection than
 * fabricate one). It never asserts "God answered this"; it sets two stones side
 * by side and the user decides. A confirmed mark becomes a structured_payload
 * `answered` record the cockpit can route.
 */
export interface EbenezerStone {
  id: string
  ask: Excerpt
  later: Excerpt
  mark: EbenezerMark
}

/** A block of synthesized prose. Free-flowing — never bulleted in the UI. */
export interface Prose {
  paragraphs: string[]
}

// ── Per-horizon content models ─────────────────────────────────────────────

/** WEEKLY — "the Sabbath stop." Tactical; what's live right now. */
export interface WeeklyReflection {
  horizon: 'week'
  periodLabel: string
  /** Measured against last week (Gain lens, backward). May cite specific days. */
  synthesis: Prose
  citations: Excerpt[]
  /** Light "3 wins this week / 3 I want next week" block; user edits inline. */
  wins: { thisWeek: Win[]; nextWeek: Win[] }
  /** 2–3 invitational questions drawn from open threads. */
  jumpstart: Question[]
}

/** MONTHLY — "the letter." What changed in you; reads the weekly summaries. */
export interface MonthlyReflection {
  horizon: 'month'
  periodLabel: string
  /** Second person, your own words pulled forward. Not a report, not bullets. */
  letter: Prose
  /** Concretely how you've gained vs. the prior month, with evidence. */
  gain: Prose
  gainEvidence: Excerpt[]
  /** A chronic measure-against-the-ideal reflex to watch (the Gap pattern). */
  gapWatch?: string
  /** The 1–2 threads that recurred, named in prose. Singular beats exhaustive. */
  themes: Prose
}

/**
 * QUARTERLY — "the retreat." The arc you can't see from inside a week.
 * NOTE: quarter is NOT yet in the Insight Layer spec (weekly/monthly/yearly
 * only). We're adding it — quarter is the cadence of a personal retreat and the
 * natural resolution distance for prayer. Reads the 3 monthly summaries.
 */
export interface QuarterlyReflection {
  horizon: 'quarter'
  periodLabel: string
  /** The multi-month arc, recurring themes, the tension you keep circling. */
  synthesis: Prose
  /** The long-horizon questions a retreat is for — deeper than weekly. */
  jumpstart: Question[]
  /** Prayers/anxieties named earlier, shown beside where they stand now. */
  ebenezer: EbenezerStone[]
}

/** YEARLY — "the mirror." The payoff the whole architecture exists to produce. */
export interface YearlyReflection {
  horizon: 'year'
  periodLabel: string
  /** Who you were a year ago vs. who you are now — Gain lens, stated outright. */
  throughline: Prose
  /** Answered prayers marked across the quarters, laid out as a year of evidence. */
  stones: EbenezerStone[]
  /** Final synthesis of the dominant threads. Prose, restrained. */
  themes: Prose
}

export type Reflection =
  | WeeklyReflection
  | MonthlyReflection
  | QuarterlyReflection
  | YearlyReflection

// ── Engine seams (wired to OpenAI later — DO NOT call the API in this task) ──

/**
 * TODO(insight-layer): replace the stub below with a real synthesis call.
 *   synthesizeReflection(horizon, lowerRollups, lenses) → Prose / Excerpts
 * Reads the rollup of the level beneath `horizon` (never raw entries, except
 * weekly), grounded + lens-aware. Runs server-side with the service-role key.
 */

/**
 * TODO(reflective-prompting): replace stub questions with a real call.
 *   generateQuestions(horizon, openThreads, lenses) → Question[]
 * The AI asks, never answers; addressed to self/God; never analytical.
 */

/**
 * TODO(structured-payload): persist a `win` record to insights.structured_payload.
 * No-op stub so the inline editor has a real seam to call.
 */
export function recordWin(_win: Win): void {
  // intentionally empty — wired to Supabase later
}

/**
 * TODO(structured-payload): persist an `answered` record when the user marks an
 * Ebenezer stone. The cockpit routes confirmed marks. No-op stub for now.
 */
export function recordEbenezerMark(_stoneId: string, _mark: EbenezerMark): void {
  // intentionally empty — wired to Supabase later
}

// ── Stubbed content (on-voice; replace with Insight Layer output) ───────────
//
// Voice note: copy is written in the user's actual lens vocabulary (spiritual,
// trading discipline, family) so the shapes read true. Swap wholesale when the
// engines land — the UI binds only to the typed fields above.

function ex(entryId: string, date: string, text: string): Excerpt {
  return { entryId, date, text }
}

const WEEK: WeeklyReflection = {
  horizon: 'week',
  periodLabel: 'May 18 – 24',
  synthesis: {
    paragraphs: [
      'Measured against last week, you started quieter. Three mornings opened with prayer before the screens did — last week only one. The thread you kept pulling was the same one as always: trusting the plan you already wrote instead of the impulse in the moment.',
      'You’re not behind. You’re further along than the version of you who started the month.',
    ],
  },
  citations: [
    ex('stub-entry-1', '2026-05-18', 'I will not trust in myself but in you'),
    ex('stub-entry-2', '2026-05-20', 'My trading discipline needs to rise. Help me Jesus.'),
  ],
  wins: {
    thisWeek: [
      { id: 'w1', text: 'Prayed before opening the markets, 3 of 5 days', suggested: true },
      { id: 'w2', text: 'Closed the losing trade at my stop instead of hoping', suggested: true },
      { id: 'w3', text: 'Made both kids’ bedtimes this week', suggested: true },
    ],
    nextWeek: [
      { id: 'n1', text: 'Pre-write the trading plan the night before', suggested: true },
      { id: 'n2', text: 'One unhurried family dinner, phone in another room', suggested: true },
      { id: 'n3', text: 'Actually start the reading plan I keep asking about', suggested: true },
    ],
  },
  jumpstart: [
    { id: 'q1', text: 'What did you trust yourself with this week that you meant to hand over?', addressee: 'God' },
    { id: 'q2', text: 'Where did discipline feel like freedom rather than restriction?', addressee: 'self' },
  ],
}

const MONTH: MonthlyReflection = {
  horizon: 'month',
  periodLabel: 'May 2026',
  letter: {
    paragraphs: [
      'A month ago you were white-knuckling the discipline, treating every slip as proof you’d never change. Read back, the entries tell a gentler story: you kept returning. Not perfectly — daily.',
      'You started saying Jesus’ name in the mornings without making it a performance. The fear that you were drifting from your family quieted as the weeks filled with ordinary, present evenings.',
      'You are being formed, slowly, in the direction you keep praying toward.',
    ],
  },
  gain: {
    paragraphs: [
      'Against last month you gained ground you can name: morning prayer went from occasional to most days, and the panic-exits in your trading dropped from a weekly habit to twice in the whole month.',
    ],
  },
  gainEvidence: [ex('stub-entry-2', '2026-05-20', 'My trading discipline needs to rise. Help me Jesus.')],
  gapWatch:
    'Watch the reflex to measure yourself against the trader you imagine you should be — that’s the Gap talking. The honest comparison is backward, against where you started.',
  themes: {
    paragraphs: [
      'Two threads ran through the weeks: a plainer, steadier prayer life, and the slow re-ordering of work to sit beneath family rather than over it.',
    ],
  },
}

const QUARTER: QuarterlyReflection = {
  horizon: 'quarter',
  periodLabel: 'Spring · Mar – May 2026',
  synthesis: {
    paragraphs: [
      'Three months in, the arc is clearer than any single week let you see. The discipline you kept framing as a trading problem looks more like a trust problem wearing a trading costume — the same surrender you pray for at dawn is the one the market asks of you by afternoon.',
      'The tension you keep circling: whether provision is something you secure, or something you receive.',
    ],
  },
  jumpstart: [
    { id: 'qq1', text: 'If the next ninety days asked one thing of you, what do you already suspect it is?', addressee: 'self' },
    { id: 'qq2', text: 'What have you been asking God to fix that he may be asking you to release?', addressee: 'God' },
  ],
  ebenezer: [
    {
      id: 's1',
      ask: ex('stub-entry-3', '2026-03-04', 'Help me Jesus, my trading discipline needs to rise.'),
      later: ex('stub-entry-7', '2026-05-21', 'Held my stop today without flinching. Felt like obedience, not loss.'),
      mark: 'unmarked',
    },
    {
      id: 's2',
      ask: ex('stub-entry-4', '2026-02-19', 'I’m scared I’m becoming a stranger to my kids.'),
      later: ex('stub-entry-8', '2026-05-22', 'Lily asked me to do bedtime again tonight. I’ve been here all week.'),
      mark: 'unmarked',
    },
  ],
}

const YEAR: YearlyReflection = {
  horizon: 'year',
  periodLabel: '2026',
  throughline: {
    paragraphs: [
      'A year ago you were trying to white-knuckle yourself into a better man and calling the exhaustion devotion. The person writing now is quieter.',
      'You trust a plan more than an impulse. You pray plainer. You measure forward less, and look backward with more honesty. You did not arrive — but you turned, and you kept turning.',
    ],
  },
  stones: [
    {
      id: 'y1',
      ask: ex('stub-entry-3', '2026-03-04', 'My trading discipline needs to rise.'),
      later: ex('stub-entry-7', '2026-05-21', 'Held my stop without flinching.'),
      mark: 'answered',
    },
    {
      id: 'y2',
      ask: ex('stub-entry-4', '2026-02-19', 'Scared I’m becoming a stranger to my kids.'),
      later: ex('stub-entry-8', '2026-05-22', 'I’ve been here all week.'),
      mark: 'answered',
    },
    {
      id: 'y3',
      ask: ex('stub-entry-5', '2026-01-11', 'Lord, what should we do for the reading plan?'),
      later: ex('stub-entry-9', '2026-04-30', 'We finished the gospels together as a family.'),
      mark: 'answered',
    },
  ],
  themes: {
    paragraphs: [
      'The year’s dominant thread was surrender — the same lesson taught in three languages: the markets, the mornings, and the dinner table.',
    ],
  },
}

const STUBS: Record<Horizon, Reflection> = {
  week: WEEK,
  month: MONTH,
  quarter: QUARTER,
  year: YEAR,
}

/**
 * The single data entry point. Returns typed, on-voice placeholder content
 * today; swap the body for Insight-Layer / Reflective-Prompting output later
 * (likely async — callers should be ready to await). Shapes won't change.
 */
export function getReflection(horizon: Horizon): Reflection {
  return STUBS[horizon]
}
