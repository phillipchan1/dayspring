/**
 * FIXTURES FOR THE LISTING SHOTS — dev-only, never bundled.
 *
 * Every consumer reaches this module through a dynamic `import()` sitting under a
 * literal `import.meta.env.DEV` guard, so Vite drops the whole file from a
 * production build. Do not import it statically from product code.
 *
 * The writing here is fictional but has to read like a real person: specific,
 * unresolved, plainly said. Nothing sermonizes, nothing scores, nothing resolves
 * too neatly — an entry that ends in doubt is more honest to the product than one
 * that ends in a lesson (PRINCIPLES.md #1, #2, #6). Names avoid Grace / Joy /
 * Faith: the declared-subject tagger treats those as people, and they read as
 * sermon words besides.
 */

import type { Entry } from '@/lib/types'
import type { LoadedAscent } from '@/features/ascent/data'
import type { AltitudeData, SummitView, WordsData, ScriptureData } from '@/features/ascent/data/types'
import type { CanonHeat, ScriptureCanonPage } from '@/lib/scripture/query'
import type { AltarSource } from '@/features/altar/data'
import type { RawMember, RawThread } from '@/features/threads/data/bands'

/** `AltarSource.meta`'s row shape — not exported from altar/data.ts. */
type AltarThreadMeta = AltarSource['meta'] extends Map<string, infer V> ? V : never

// ── the editor document ──────────────────────────────────────────────────────

const SCRIPTURE_ID = '5b1f4a20-9c33-4e71-8a02-6d4f0e1c7b95'
const PRAYER_ID = 'c07e2d41-3b88-4a5e-9f16-2e8b5a90d3c4'

/**
 * Shot 02. Prose either side of a scripture block and a prayer block, so both
 * widgets render — they are the clearest visual tell that this is not a generic
 * notes app. Ends unresolved, on purpose.
 *
 * No blank lines around the fences: `formatScriptureInsert` inserts a block with
 * one newline before and none after, so blank lines here stack the editor's own
 * block margins on top of an empty paragraph and open a gap the app never shows.
 */
export const MOCK_DOC = `Tuesday

Down to the water while it was still dark. Just the sound of it.
\`\`\`dayspring-scripture ${SCRIPTURE_ID}
And we know that all things work together for good to them that love God
Romans 8:28
\`\`\`
\`\`\`dayspring-pray ${PRAYER_ID}
For Dad, and for Thursday. That I'd stop rehearsing the worst version of it.
\`\`\``

// ── the archive ──────────────────────────────────────────────────────────────

/** `[monthsAgo, title line, body tail]` — turned into Entries below. */
const ENTRY_SEED: [number, string, string][] = [
  [0, 'Tuesday', "Woke before the alarm again with the same knot about Dad's scan on Thursday."],
  [0, 'The long way home', 'Took the long way home from Elena’s so I could keep thinking.'],
  [0, 'Still waiting on Thursday', 'Nothing to report. Which is its own kind of thing to sit with.'],
  [1, 'Rain all week', 'Third grey day. Wrote nothing worth keeping and that was fine.'],
  [1, 'Marcus called', 'He asked how I was and I gave the short answer, then called him back.'],
  [1, 'Early service', 'Sat at the back. Sang about half of it.'],
  [2, 'The Fairview house', 'We said out loud that we might sell it. First time either of us has.'],
  [2, 'Something Elena said', '"You keep apologising for being tired." She’s right.'],
  [3, 'A better week', 'Slept through four nights running. Small, but I noticed.'],
  [4, 'Dad’s birthday', 'Seventy-one. He told the crane story again and I let him.'],
  [5, 'Nothing much', 'Ordinary Wednesday. Writing it down anyway.'],
  [6, 'Halfway', 'Read back over January this morning. I sounded frightened.'],
  [8, 'The move', 'Boxes in the hall. Elena found the letters from 2018.'],
  [10, 'Late again', 'Missed the whole of last week. Not going to make a thing of it.'],
  [13, 'A year of this', 'Went back to the first entry. I barely recognise the handwriting of it.'],
  [16, 'Quiet stretch', 'Not much to say lately, and less need to say it.'],
  [20, 'Marcus moved out', 'Helped him load the van. Stood in the empty room afterwards.'],
  [26, 'Two winters', 'Same walk, same water, different person doing the walking.'],
  [33, 'The hospital car park', 'Sat in the car for twenty minutes before going in.'],
  [41, 'Good news, finally', 'Wrote it in capitals and then felt silly and left it in.'],
  [52, 'Four years', 'Elena asked what I’d tell the version of me who started this.'],
  [64, 'Autumn', 'Leaves down early. Walked the long loop for the first time since spring.'],
  [78, 'A hard month', 'Not writing much. Coming back to say that much at least.'],
  [91, 'Something loosening', 'Noticed I hadn’t rehearsed the worst version all week.'],
  [104, 'Nine years in', 'Read a whole year in one sitting. Had to stop twice.'],
  [113, 'The first walk', 'Started keeping this properly. Let’s see if it holds.'],
]

const THIS_YEAR = new Date().getUTCFullYear()

/**
 * Local-time constructor, deliberately — `groupEntries` reads years and months
 * back out with local getters. Building these in UTC puts a 1 January entry into
 * the previous year for every timezone behind UTC, which showed up as a phantom
 * "2015 · 1" row under a headline promising ten years.
 */
function isoAt(year: number, month: number, day: number): string {
  return new Date(year, month, day, 9, 30, 0).toISOString()
}

function isoMonthsAgo(months: number, day: number): string {
  const now = new Date()
  return isoAt(now.getFullYear(), now.getMonth() - months, day)
}

/**
 * A real archive is marked up; a fixture of clean prose exercises none of the
 * reading surface. Every seventh page or so carries something the writer did to
 * it — a highlight in one of the five colours, an underline, a quoted line, a
 * cited verse, a prayer — so the wall's filters have something to filter and the
 * capture shows a journal rather than a corpus.
 *
 * Deterministic by index, so a shot is the same shot every time.
 */
function marked(body: string, n: number): string {
  const [head, ...rest] = body.split('\n\n')
  const tail = rest.join('\n\n')
  switch (n % 14) {
    case 0:
      return `${head}\n\n${tail.replace(/^(\w[^.]{6,40}\.)/, '==$1==')}`
    case 3:
      return `${head}\n\n${tail.replace(/^(\w[^.]{6,40}\.)/, '=={rose}$1==')}`
    case 5:
      return `${head}\n\n${tail.replace(/^(\w[^.]{6,40}\.)/, '=={sage}$1==')}`
    case 7:
      return `${head}\n\n${tail.replace(/^(\w[^.]{6,40}\.)/, '++$1++')}`
    case 9:
      return `${head}\n\n> ${tail}`
    case 11:
      return `${head}\n\n${tail}\n\nReading Psalm 121 again this morning.`
    case 13:
      return [
        head,
        '',
        tail,
        '',
        '```dayspring-pray 3f2504e0-4f89-11d3-9a0c-0305e82c33' + String(n % 100).padStart(2, '0'),
        'For Thursday, and for the waiting part.',
        '```',
      ].join('\n')
    default:
      return body
  }
}

function entry(id: string, iso: string, body: string, source: Entry['source']): Entry {
  return {
    id,
    created_at: iso,
    updated_at: iso,
    body_markdown: body,
    title: null,
    mood: null,
    tags: [],
    word_count: body.split(/\s+/).length,
    source,
    external_id: null,
  }
}

// Only the last year or so is hand-written and native; HISTORY below owns
// everything older, so the two never disagree about which years exist.
const RECENT: Entry[] = ENTRY_SEED.filter(([monthsAgo]) => monthsAgo <= 13).map(
  ([monthsAgo, title, tail], i) =>
    entry(
      `mock-entry-${String(i).padStart(2, '0')}`,
      isoMonthsAgo(monthsAgo, 27 - ((i * 7) % 26)),
      marked(`${title}\n\n${tail}`, i),
      'native',
    ),
)

/**
 * Entries per year for the depth shot. Shot 05's headline is "ten years of
 * journaling", and the year list has to actually substantiate it — a decade of
 * year rows each carrying a real count, uneven the way a real practice is
 * (2020 heavy, 2016 just starting). Same grounding discipline as the product:
 * the claim in the caption is visible in the screenshot.
 */
const YEARS_BACK: [number, number][] = [
  [10, 62], [9, 148], [8, 203], [7, 187], [6, 246],
  [5, 198], [4, 171], [3, 214], [2, 189], [1, 232],
  // The current year to date, so it doesn't read as an anomalous drop-off next
  // to a full year beneath it.
  [0, 118],
]

const MONTHS_SO_FAR = new Date().getMonth() + 1

const HISTORY: Entry[] = YEARS_BACK.flatMap(([back, count]) => {
  const year = THIS_YEAR - back
  const span = back === 0 ? MONTHS_SO_FAR : 12
  return Array.from({ length: count }, (_, n) => {
    const seed = ENTRY_SEED[n % ENTRY_SEED.length]!
    // Everything older than this year came in from another app.
    return entry(
      `mock-hist-${year}-${n}`,
      isoAt(year, n % span, 1 + ((n * 7) % 27)),
      marked(`${seed[1]}\n\n${seed[2]}`, n),
      back === 0 ? 'native' : 'diarly',
    )
  })
})

/**
 * Newest first. `groupYearsWithMonths` builds its year rows in first-encounter
 * order and never sorts — the app hands it entries already ordered by the repo.
 * Skipping the sort here puts the year list out of sequence (2019 landing after
 * 2016), which reads as a bug in the product rather than in the fixture.
 */
export const MOCK_ENTRIES: Entry[] = [...RECENT, ...HISTORY].sort((a, b) =>
  b.created_at.localeCompare(a.created_at),
)

/** The entry open in the editor for shots 02 and 03. */
export const MOCK_ACTIVE_ENTRY: Entry = {
  ...MOCK_ENTRIES[0]!,
  body_markdown: MOCK_DOC,
  word_count: MOCK_DOC.split(/\s+/).length,
}

// ── the Ascent ───────────────────────────────────────────────────────────────

function words(
  resolution: WordsData['resolution'],
  periodLabel: string,
  arcs: WordsData['arcs'],
  refrain: { text: string; dateLabel: string },
): WordsData {
  return {
    resolution,
    periodLabel,
    arcs,
    themes: [],
    moments: [{ entryId: MOCK_ENTRIES[0]!.id, dateLabel: refrain.dateLabel, text: refrain.text, isQuote: true }],
  }
}

function scripture(
  resolution: ScriptureData['resolution'],
  periodLabel: string,
  refs: ScriptureData['refs'],
  suggestedCount = 0,
): ScriptureData {
  return { resolution, periodLabel, refs, suggestedCount }
}

const YEAR_WORDS = words(
  'year',
  String(THIS_YEAR),
  [
    {
      name: 'Learning to wait',
      note: 'The word "still" turns up in March, in June, and again in October — each time about something you had stopped trying to hurry.',
    },
    {
      name: 'Carrying Dad',
      note: 'He is in thirty-one entries this year. Around June the asking quietly changed shape, from fixing to staying.',
    },
    {
      name: 'Letting go of the Fairview house',
      note: 'From "we should probably sell" in February to saying it out loud, to each other, in September.',
    },
  ],
  {
    text: 'I keep asking Him to change the situation, and He keeps changing me in it.',
    dateLabel: 'Mar 14',
  },
)

/**
 * Shot 01 renders `Summit` on its own, and one idea has to carry the frame: the
 * verbatim line of the year plus a single thread. Three threads and a verse list
 * is a screen you read; one is a screen you *get*.
 */
export const SUMMIT_WORDS: WordsData = {
  ...YEAR_WORDS,
  arcs: [YEAR_WORDS.arcs[0]!],
}

/**
 * Two verses, not four — and never zero: ScriptureDimension renders an explicit
 * "no scripture surfaced here yet" empty state, which is honest in the app and
 * fatal in a screenshot.
 */
export const SUMMIT_SCRIPTURE: ScriptureData = {
  resolution: 'year',
  periodLabel: String(THIS_YEAR),
  refs: [
    { osisRef: 'Rom.8.28', label: 'Romans 8:28', count: 9 },
    { osisRef: 'Ps.27.13', label: 'Psalm 27:13–14', count: 7 },
  ],
  suggestedCount: 0,
}

const YEAR_SCRIPTURE = scripture(
  'year',
  String(THIS_YEAR),
  [
    { osisRef: 'Rom.8.28', label: 'Romans 8:28', count: 9 },
    { osisRef: 'Ps.27.13', label: 'Psalm 27:13–14', count: 7 },
    { osisRef: 'Isa.43.2', label: 'Isaiah 43:2', count: 5 },
    { osisRef: 'Phil.4.6', label: 'Philippians 4:6', count: 4 },
  ],
  // No pending allusions: the confirm funnel is a good feature and a bad
  // screenshot — it needs a sentence of explanation, and it lands right on the
  // fold where it gets clipped mid-line.
  0,
)

const WEEK: AltitudeData = {
  resolution: 'week',
  words: words('week', 'Jul 25 – Jul 31', [], {
    text: 'Nothing happened, just the sound of it, and the sky going from grey to that pale gold.',
    dateLabel: 'Jul 29',
  }),
  scripture: scripture('week', 'Jul 25 – Jul 31', [
    { osisRef: 'Rom.8.28', label: 'Romans 8:28', count: 2 },
  ]),
  prayer: null,
  learning: null,
}

const MONTH: AltitudeData = {
  resolution: 'month',
  words: words(
    'month',
    'July',
    [{ name: 'Waiting on Thursday', note: 'Four entries circle the same appointment without ever naming what you are afraid of.' }],
    { text: 'I mostly pray not to be alone in it now, rather than for it to be fixed.', dateLabel: 'Jul 29' },
  ),
  scripture: scripture('month', 'July', [
    { osisRef: 'Rom.8.28', label: 'Romans 8:28', count: 3 },
    { osisRef: 'Ps.27.13', label: 'Psalm 27:13–14', count: 2 },
  ]),
  prayer: null,
  learning: null,
}

const QUARTER: AltitudeData = {
  resolution: 'quarter',
  words: words(
    'quarter',
    'May – July',
    [
      { name: 'The asking changed shape', note: 'In May you were asking for outcomes. By July you are mostly asking for company.' },
      { name: 'Sleeping again', note: 'Three separate entries mention rest without you making anything of it.' },
    ],
    { text: 'Same walk, same water, different person doing the walking.', dateLabel: 'Jun 02' },
  ),
  scripture: scripture('quarter', 'May – July', [
    { osisRef: 'Rom.8.28', label: 'Romans 8:28', count: 5 },
    { osisRef: 'Isa.43.2', label: 'Isaiah 43:2', count: 3 },
  ]),
  prayer: null,
  learning: null,
}

const YEAR: SummitView = {
  resolution: 'year',
  words: YEAR_WORDS,
  scripture: YEAR_SCRIPTURE,
  prayer: null,
  learning: null,
  year: THIS_YEAR,
  stones: [],
}

function yearWindow(offsetMonths: number, span: number) {
  const now = new Date()
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offsetMonths, 1))
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offsetMonths + span, 0, 23, 59, 59))
  return { from, to }
}

export const MOCK_ASCENT: LoadedAscent = {
  week: WEEK,
  month: MONTH,
  quarter: QUARTER,
  year: YEAR,
  windows: {
    week: yearWindow(0, 1),
    month: yearWindow(0, 1),
    quarter: yearWindow(2, 3),
    year: { from: new Date(Date.UTC(THIS_YEAR, 0, 1)), to: new Date(Date.UTC(THIS_YEAR, 11, 31, 23, 59, 59)) },
  },
}

// ── the Lamp ─────────────────────────────────────────────────────────────────

/**
 * Chapter-level heat, `[osis, chapter, distinct entries]`. Weighted like an
 * actual decade of writing rather than an even wash: warm through Psalms, John,
 * Romans and Philippians, a few narrative places in Genesis / Exodus / 1 Samuel,
 * and long unlit stretches everywhere else.
 *
 * The unlit cells are the point. "Warmth where you've lived; quiet, never guilt,
 * where you haven't" — never a coverage score (PRINCIPLES.md #1).
 */
const HEAT_SEED: [string, number, number][] = [
  ['Gen', 1, 4], ['Gen', 3, 2], ['Gen', 22, 3], ['Gen', 28, 2], ['Gen', 32, 5], ['Gen', 50, 3],
  ['Exod', 3, 4], ['Exod', 14, 3], ['Exod', 16, 2], ['Exod', 33, 5],
  ['Deut', 6, 2], ['Deut', 31, 3],
  ['Josh', 1, 4], ['Josh', 4, 3],
  ['1Sam', 3, 4], ['1Sam', 7, 5], ['1Sam', 16, 2], ['1Sam', 17, 2],
  ['2Sam', 7, 2],
  ['1Kgs', 19, 6],
  ['Job', 1, 2], ['Job', 38, 3], ['Job', 42, 2],
  ['Ps', 1, 3], ['Ps', 13, 6], ['Ps', 16, 4], ['Ps', 22, 3], ['Ps', 23, 8], ['Ps', 27, 11],
  ['Ps', 34, 5], ['Ps', 40, 4], ['Ps', 42, 7], ['Ps', 46, 6], ['Ps', 51, 4], ['Ps', 62, 5],
  ['Ps', 63, 4], ['Ps', 73, 3], ['Ps', 84, 5], ['Ps', 90, 3], ['Ps', 91, 4], ['Ps', 103, 7],
  ['Ps', 116, 3], ['Ps', 119, 5], ['Ps', 121, 6], ['Ps', 130, 4], ['Ps', 131, 5], ['Ps', 139, 9],
  ['Ps', 145, 3],
  ['Prov', 3, 5], ['Prov', 4, 2],
  ['Eccl', 3, 4],
  ['Isa', 6, 3], ['Isa', 30, 4], ['Isa', 40, 8], ['Isa', 41, 3], ['Isa', 43, 7], ['Isa', 53, 4],
  ['Isa', 55, 3], ['Isa', 61, 2],
  ['Jer', 29, 3], ['Jer', 31, 2],
  ['Lam', 3, 6],
  ['Hos', 6, 2],
  ['Mic', 6, 3],
  ['Hab', 3, 4],
  ['Zeph', 3, 3],
  ['Matt', 5, 5], ['Matt', 6, 7], ['Matt', 11, 6], ['Matt', 14, 3], ['Matt', 26, 4],
  ['Mark', 4, 3], ['Mark', 5, 2], ['Mark', 9, 5],
  ['Luke', 1, 5], ['Luke', 10, 4], ['Luke', 15, 6], ['Luke', 22, 3], ['Luke', 24, 4],
  ['John', 1, 6], ['John', 4, 5], ['John', 6, 4], ['John', 10, 5], ['John', 11, 7],
  ['John', 14, 8], ['John', 15, 9], ['John', 17, 4], ['John', 20, 5], ['John', 21, 6],
  ['Acts', 2, 3], ['Acts', 16, 2],
  ['Rom', 5, 5], ['Rom', 6, 3], ['Rom', 8, 12], ['Rom', 12, 6], ['Rom', 15, 3],
  ['1Cor', 13, 6], ['1Cor', 15, 3],
  ['2Cor', 1, 5], ['2Cor', 4, 7], ['2Cor', 12, 6],
  ['Gal', 2, 3], ['Gal', 5, 4],
  ['Eph', 1, 4], ['Eph', 2, 5], ['Eph', 3, 6],
  ['Phil', 1, 5], ['Phil', 2, 6], ['Phil', 3, 4], ['Phil', 4, 10],
  ['Col', 3, 5],
  ['1Thess', 5, 3],
  ['2Tim', 1, 4],
  ['Heb', 4, 5], ['Heb', 11, 6], ['Heb', 12, 7],
  ['Jas', 1, 5],
  ['1Pet', 5, 6],
  ['1John', 3, 3], ['1John', 4, 5],
  ['Rev', 21, 4], ['Rev', 22, 3],
]

function buildCanonHeat(): CanonHeat {
  const chapters = new Map<string, number>()
  const books = new Map<string, number>()
  let max = 0
  for (const [osis, chapter, count] of HEAT_SEED) {
    chapters.set(`${osis}:${chapter}`, count)
    books.set(osis, (books.get(osis) ?? 0) + count)
    if (count > max) max = count
  }
  return { chapters, books, max }
}

// ── the Altar ────────────────────────────────────────────────────────────────

/**
 * Declared subjects, `[label, kind, type, lines]` — `lines` is how many prayers
 * or senses were laid down for it over the trailing year.
 *
 * `buildAltarStrands` drops anything under `heft >= 2`: a subject brought to God
 * once isn't a strand yet. Counts are uneven on purpose — a real altar has a few
 * things you return to constantly and a long tail you don't.
 *
 * Names avoid Grace / Joy / Faith: `api/_lib/declared.ts` keeps a stop-list split
 * by kind precisely because those read as virtues, not people.
 */
const ALTAR_SEED: [
  label: string,
  kind: 'person' | 'place' | 'theme',
  type: 'prayer' | 'sense',
  lines: number,
  /** Days the subject has been carried — varied so no two strands read alike. */
  spanDays: number,
  /** Days since the most recent line; a subject can have gone quiet. */
  restDays: number,
][] = [
  ['Dad', 'person', 'prayer', 17, 330, 2],
  ['Elena', 'person', 'prayer', 13, 300, 6],
  ['Marcus', 'person', 'prayer', 9, 205, 41],
  ['Nate and Priya', 'person', 'prayer', 5, 120, 18],
  ['The Fairview house', 'place', 'prayer', 8, 250, 9],
  ['The Tuesday group', 'place', 'prayer', 6, 180, 27],
  ['The new team at work', 'place', 'prayer', 4, 95, 4],
  ['Learning to wait', 'theme', 'sense', 12, 320, 11],
  ['Money, and the fear under it', 'theme', 'prayer', 7, 240, 63],
  ['Wanting to be known', 'theme', 'sense', 5, 150, 22],
  ['Impatience with Sundays', 'theme', 'sense', 3, 80, 15],
]

/**
 * Deterministic pseudo-random in [0,1). Not `Math.random`: a fixture that shifts
 * between captures makes every re-run a diff, and two shots of the same subject
 * would disagree.
 */
function jitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/** Verbatim-looking lines. Plain, unresolved, never a devotional flourish. */
const ALTAR_LINES = [
  'For Dad, and for Thursday. That I would stop rehearsing the worst version of it.',
  'That I would want the thing itself and not the relief of being done with it.',
  'Asked again, and noticed I was asking for company rather than an outcome.',
  'Still here. Still asking. Less frantic about it than in the spring.',
  'A sense that I am not being hurried, and that this is not the same as being ignored.',
  'That I would stop keeping score of who reaches out first.',
  'Said it out loud for the first time instead of only writing it down.',
  'Nothing new to add. Bringing it anyway.',
]

function buildAltarSource(): AltarSource {
  const rawThreads: RawThread[] = []
  const rawMembers: RawMember[] = []
  const meta = new Map<string, AltarThreadMeta>()
  const now = Date.now()
  const DAY = 86_400_000

  ALTAR_SEED.forEach(([label, kind, type, lines, spanDays, restDays], i) => {
    const id = `mock-altar-${i}`
    // `loadAltarSource` maps the declared model onto the band builder this way:
    // the subject's own label drives hue, domain/rope stay null.
    rawThreads.push({
      id,
      lens: label,
      domain: null,
      rope_id: null,
      label,
      label_ai: null,
      label_user: null,
      private: false,
      dismissed: false,
    })
    meta.set(id, { id, label, label_ai: null, label_user: null, type, subject_kind: kind })

    for (let n = 0; n < lines; n++) {
      // Scatter, don't space evenly. `buildBands` buckets a strand's span into 12
      // and sets each pool to `count / peak`, so a perfectly even spread makes
      // every bucket 1.0 and the warmth bar renders as a solid amber slab. Real
      // prayer comes in bursts with quiet stretches between, which is what gives
      // the strand its texture — so jitter the placement and let gaps happen.
      const ageDays = restDays + Math.floor(jitter(i * 97 + n) * spanDays)
      rawMembers.push({
        thread_id: id,
        entry_id: `mock-altar-item-${i}-${n}`,
        created_at: new Date(now - ageDays * DAY).toISOString(),
        body: ALTAR_LINES[(i * 3 + n) % ALTAR_LINES.length]!,
      })
    }
  })

  return { rawThreads, rawMembers, meta }
}

export const MOCK_ALTAR: AltarSource = buildAltarSource()

// ── the Lamp ─────────────────────────────────────────────────────────────────

export const MOCK_CANON: ScriptureCanonPage = {
  heat: buildCanonHeat(),
  summary: {
    totalRefs: 512,
    distinctVerses: 268,
    topBooks: [
      { osis: 'Ps', name: 'Psalms', count: 122 },
      { osis: 'John', name: 'John', count: 59 },
      { osis: 'Rom', name: 'Romans', count: 29 },
    ],
    topVerse: { osis_ref: 'Rom.8.28', count: 12 },
  },
  returning: [
    { osis_ref: 'Rom.8.28', book_osis: 'Rom', count: 12 },
    { osis_ref: 'Ps.27.13', book_osis: 'Ps', count: 11 },
    { osis_ref: 'Phil.4.6', book_osis: 'Phil', count: 10 },
    { osis_ref: 'John.15.5', book_osis: 'John', count: 9 },
    { osis_ref: 'Ps.139.23', book_osis: 'Ps', count: 9 },
    { osis_ref: 'Isa.43.2', book_osis: 'Isa', count: 7 },
  ],
}
