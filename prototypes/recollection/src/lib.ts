import { ENTRIES, allMarkings, type Entry, type MarkingKind, type PlacedMarking, type Subject } from './corpus'

/** Whole-word-ish literal matching. Code decides what matches, never a model. */
export function hits(text: string, terms: string[]): boolean {
  const hay = text.toLowerCase()
  return terms.some((t) => new RegExp(`\\b${t}\\b`, 'i').test(hay))
}

export function entriesFor(s: Subject): Entry[] {
  return ENTRIES.filter((e) => hits(e.paragraphs.join(' '), s.terms))
}

/** Every line naming them, oldest first. Every one — a subset would be a judgement. */
export function linesFor(s: Subject): { entryId: string; date: string; text: string }[] {
  const out: { entryId: string; date: string; text: string }[] = []
  for (const e of ENTRIES) {
    for (const p of e.paragraphs) {
      if (hits(p, s.terms)) out.push({ entryId: e.id, date: e.date, text: p })
    }
  }
  return out
}

/**
 * Markings made on a paragraph that names them.
 *
 * The paragraph and not the whole entry, because an entry that mentions Mom in
 * passage six is not a marking about Mom. And the paragraph rather than the
 * quote alone, because "She held my hand like I was the child" is plainly
 * about her and never says her name. Code decides, literally, either way.
 */
export function markingsFor(s: Subject): PlacedMarking[] {
  const out: PlacedMarking[] = []
  for (const e of ENTRIES) {
    for (const m of e.markings ?? []) {
      const para = e.paragraphs[m.para] ?? ''
      if (hits(para, s.terms)) out.push({ ...m, entryId: e.id, date: e.date })
    }
  }
  return out
}

export function spanOf(dates: string[]): { first: string; last: string } | null {
  if (!dates.length) return null
  const sorted = [...dates].sort()
  return { first: sorted[0]!, last: sorted[sorted.length - 1]! }
}

/** Which months carry it. A rhythm, not a chart — see the note in RegisterView. */
export function monthsWith(dates: string[]): Set<string> {
  return new Set(dates.map((d) => d.slice(0, 7)))
}

export function allMonths(): string[] {
  const first = ENTRIES[0]!.date.slice(0, 7)
  const last = ENTRIES[ENTRIES.length - 1]!.date.slice(0, 7)
  const out: string[] = []
  let [y, m] = first.split('-').map(Number) as [number, number]
  const [ly, lm] = last.split('-').map(Number) as [number, number]
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

export type Burst = {
  entries: Entry[]
  days: number
  quietDaysBefore: number
  /** The way in: a marking made on a paragraph that names this subject. */
  wayIn: { marking: PlacedMarking; entry: Entry } | null
}

/**
 * An episode is a burst of entries on one subject bounded by silence.
 *
 * This is arithmetic and nothing else — a gap of `quiet` days opens a new
 * burst, and a burst has to hold at least `min` entries to be one. The app
 * never says these are stories. It says how many entries, in how many days,
 * after how long a silence, and shows a sentence the writer typed.
 */
export function burstsFor(s: Subject, { quiet = 50, min = 3, maxGap = 14 } = {}): Burst[] {
  const es = entriesFor(s)
  const groups: Entry[][] = []
  let cur: Entry[] = []
  let prev: number | null = null

  for (const e of es) {
    const t = Date.parse(e.date)
    if (prev !== null && (t - prev) / 86400000 > quiet) {
      groups.push(cur)
      cur = []
    }
    cur.push(e)
    prev = t
  }
  if (cur.length) groups.push(cur)

  return groups
    .map((g, i) => {
      const firstT = Date.parse(g[0]!.date)
      const lastT = Date.parse(g[g.length - 1]!.date)
      const prevGroup = groups[i - 1]
      const prevEnd = prevGroup ? Date.parse(prevGroup[prevGroup.length - 1]!.date) : null

      /*
       * The way in has to be about the subject, not merely inside the same
       * entry. A marking about Mira shown under Leo is a false connection —
       * the exact failure this whole surface has to not commit.
       */
      let wayIn: Burst['wayIn'] = null
      for (const e of g) {
        for (const m of e.markings ?? []) {
          if (hits(e.paragraphs[m.para] ?? '', s.terms)) {
            wayIn = { marking: { ...m, entryId: e.id, date: e.date }, entry: e }
            break
          }
        }
        if (wayIn) break
      }

      return {
        entries: g,
        days: Math.round((lastT - firstT) / 86400000) + 1,
        quietDaysBefore: prevEnd === null ? 0 : Math.round((firstT - prevEnd) / 86400000),
        wayIn,
      }
    })
    /*
     * Dense, not merely consecutive. Five entries spread over three months is
     * a season, not an episode — and calling it one would be the app deciding
     * something happened.
     */
    .filter((b) => b.entries.length >= min && b.days <= b.entries.length * maxGap)
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/** "four quiet months" reads better than "127 days" and is the same fact. */
export function quietSpell(days: number): string {
  if (days < 45) return plural(days, 'quiet day', 'quiet days')
  const months = Math.round(days / 30.44)
  return plural(months, 'quiet month', 'quiet months')
}

// ── horizons ───────────────────────────────────────────────────────────────

export type HorizonId = 'week' | 'month' | 'season' | 'year'

export type Horizon = {
  id: HorizonId
  label: string
  /** Days back from the anchor. */
  days: number
}

/**
 * Four windows on the same material. The wider the window, the less is shown —
 * the Ascent's one genuinely good idea, kept: as the horizon widens the app
 * should say less, not more, because more is where interpretation creeps in.
 */
export const HORIZONS: Horizon[] = [
  { id: 'week', label: 'this week', days: 7 },
  { id: 'month', label: 'this month', days: 31 },
  { id: 'season', label: 'this season', days: 92 },
  { id: 'year', label: 'this year', days: 365 },
]

/** The corpus ends here; a fixed anchor keeps the prototype reproducible. */
export const TODAY = '2026-08-16'

export function windowFor(h: Horizon): { from: string; to: string } {
  const to = TODAY
  const d = new Date(Date.parse(TODAY) - h.days * 86400000)
  return { from: d.toISOString().slice(0, 10), to }
}

export function entriesIn(h: Horizon): Entry[] {
  const { from, to } = windowFor(h)
  return ENTRIES.filter((e) => e.date >= from && e.date <= to)
}

export function markingsIn(h: Horizon, kinds?: MarkingKind[]): PlacedMarking[] {
  const out: PlacedMarking[] = []
  for (const e of entriesIn(h)) {
    for (const m of e.markings ?? []) {
      if (!kinds || kinds.includes(m.kind)) out.push({ ...m, entryId: e.id, date: e.date })
    }
  }
  return out
}

/** Their own questions. Lines that end in one — a fact about the text. */
export function questionsIn(h: Horizon): { date: string; entryId: string; text: string }[] {
  const out: { date: string; entryId: string; text: string }[] = []
  for (const e of entriesIn(h)) {
    for (const p of e.paragraphs) {
      if (p.trim().endsWith('?')) out.push({ date: e.date, entryId: e.id, text: p })
    }
  }
  return out
}

/** Content words, for the plainest possible "you have said this before" check. */
const STOP = new Set(
  'the a an and or but i to of in it is was be been am are my me you he she they we not that this there here for on at with as if so do did does have has had what when how why who all just still keep been about from into out over under again more most some any than then them their her his our your no nor too very can will would could should about'.split(
    ' ',
  ),
)

function words(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  )
}

/**
 * Something written before, in the writer's own words.
 *
 * Deliberately dumb: shared uncommon words, above a floor, and the earliest one
 * wins. A cleverer match would be a model deciding two sentences are the same
 * thing, and it would be wrong invisibly. This is wrong visibly, which is the
 * only kind of wrong a surface like this can afford.
 */
export function earlierEcho(m: PlacedMarking, min = 2): PlacedMarking | null {
  const mine = words(m.quote)
  let best: PlacedMarking | null = null
  for (const other of allMarkings()) {
    if (other.date >= m.date) continue
    let shared = 0
    for (const w of words(other.quote)) if (mine.has(w)) shared += 1
    if (shared >= min && (!best || other.date < best.date)) best = other
  }
  return best
}

/** Anything written after it, on the same paragraph's subject. A fact of order. */
export function afterIt(m: PlacedMarking): PlacedMarking | null {
  const later = allMarkings()
    .filter((o) => o.date > m.date)
    .sort((a, b) => a.date.localeCompare(b.date))
  const mine = words(m.quote)
  for (const o of later) {
    let shared = 0
    for (const w of words(o.quote)) if (mine.has(w)) shared += 1
    if (shared >= 2) return o
  }
  return null
}

// ── moments ────────────────────────────────────────────────────────────────

export type Moment = {
  marks: PlacedMarking[]
  days: number
  kinds: MarkingKind[]
}

const DECLARED_KINDS: MarkingKind[] = ['gift', 'scripture', 'sense', 'prayer', 'desire', 'learned', 'story', 'absence']

/**
 * Marks of DIFFERENT kinds that landed close together.
 *
 * This is the one arrangement that makes typed marks pay off as relation rather
 * than as colour — and it is still only arithmetic: a window, a count, and a
 * count of distinct kinds. The app never says what the moment was.
 *
 * Judy named three kinds in one breath describing one experience: "he met me
 * there. He spoke right here. He gave me this verse right here." Grouping those
 * three into three different sections, which is what grouping by kind does, is
 * the least useful thing available.
 *
 * Declared kinds only. A highlight, an underline and a set-apart in one week is
 * a busy week, not a moment.
 */
export function moments({ span = 21, minKinds = 3 } = {}): Moment[] {
  const all = allMarkings()
    .filter((m) => DECLARED_KINDS.includes(m.kind))
    .sort((a, b) => a.date.localeCompare(b.date))

  const out: Moment[] = []
  let i = 0
  while (i < all.length) {
    const start = Date.parse(all[i]!.date)
    let j = i
    while (j + 1 < all.length && (Date.parse(all[j + 1]!.date) - start) / 86400000 <= span) j += 1

    const group = all.slice(i, j + 1)
    const kinds = [...new Set(group.map((m) => m.kind))]
    /*
     * More than one day. Three marks on a single page is a page, not a moment —
     * the margin already shows that, and calling it a convergence would be the
     * app finding something that is only the shape of one sitting.
     */
    const days = new Set(group.map((m) => m.date))
    if (kinds.length >= minKinds && days.size >= 2) {
      out.push({
        marks: group,
        days: Math.round((Date.parse(group[group.length - 1]!.date) - start) / 86400000) + 1,
        kinds,
      })
      i = j + 1
    } else {
      i += 1
    }
  }
  return out.reverse()
}

// ── returning ──────────────────────────────────────────────────────────────

export type Returning = {
  marks: PlacedMarking[]
  /** The writer's own words that every one of them shares. Shows its work. */
  shared: string[]
}

/**
 * The same thing said again, at several dates.
 *
 * Ordered by when it FIRST appeared, never by how often — a list sorted by
 * frequency is a list ranking what matters in someone's life. And it is never
 * rendered as a count or a trend: what is shown is one persistent sentence at
 * four dates, and the reader decides what that means.
 */
export function returning({ min = 3, share = 2 } = {}): Returning[] {
  const all = allMarkings()
    .filter((m) => DECLARED_KINDS.includes(m.kind))
    .sort((a, b) => a.date.localeCompare(b.date))

  const used = new Set<string>()
  const out: Returning[] = []

  for (const seed of all) {
    const key = seed.entryId + seed.quote
    if (used.has(key)) continue

    /*
     * Everything is measured against the SEED, not against a shrinking
     * intersection of the whole group. A want said three times rarely uses the
     * same three words every time — "praying about my marriage", "praying about
     * David", "bringing David" — and an intersection across all of them is
     * empty, which would hide exactly the recurrences worth seeing.
     *
     * The seed is the earliest one, so the group is anchored to when the thing
     * FIRST came up rather than to whichever phrasing happened to be richest.
     */
    const seedWords = words(seed.quote)
    const group = [seed]
    const matched = new Set<string>()

    for (const other of all) {
      if (other === seed) continue
      if (used.has(other.entryId + other.quote)) continue
      const ow = words(other.quote)
      const common = [...seedWords].filter((w) => ow.has(w))
      if (common.length >= share) {
        group.push(other)
        for (const w of common) matched.add(w)
      }
    }

    /*
     * One per page. A mark and a shorter mark inside it are the same sentence
     * twice, and showing both would make a returning look longer than it is.
     */
    const perEntry = new Map<string, PlacedMarking>()
    for (const m of group) {
      const held = perEntry.get(m.entryId)
      if (!held || m.quote.length > held.quote.length) perEntry.set(m.entryId, m)
    }
    const kept = [...perEntry.values()].sort((a, b) => a.date.localeCompare(b.date))

    if (kept.length >= min) {
      for (const m of group) used.add(m.entryId + m.quote)
      out.push({ marks: kept, shared: [...matched] })
    }
  }
  return out
}

// ── the words themselves ───────────────────────────────────────────────────

/**
 * A second, much wider list of words, used ONLY by the vocabulary diff.
 *
 * `STOP` above is tuned for matching, where two shared uncommon words is enough
 * signal and a stray "actually" costs nothing. A vocabulary diff is different:
 * a person READS the list, and a list whose first entries are `something`,
 * `because` and `doing` says nothing about anybody. Measured against the real
 * fixture, the narrow list left 42 of 42 "stopped" words as filler.
 *
 * Kept separate rather than widened in place, because widening `STOP` would
 * silently change what `returning()` and `earlierEcho()` group together.
 */
const COMMON = new Set(
  `the a an and or but i to of in it is was be been am are my me you he she they we not that this there here for on at with as if so do did does have has had what when how why who all just still keep about from into out over under again more most some any than then them their her his our your no nor too very can will would could should
  one two three four five six seven eight nine ten first last next same other another each every both few many much lot lots
  back down away off out up around along across before after until while during since between within without through
  say says said saying tell tells told telling ask asks asked asking think thinks thought know knows knew knowing
  go goes going gone went come comes coming came get gets got getting give gives gave given take takes took taken taking
  make makes made making put puts putting keep keeps kept let lets letting want wants wanted feel feels felt
  look looks looked looking see sees saw seen seeing hear hears heard hearing
  like likes liked need needs needed try tries tried trying turn turns turned
  thing things something anything nothing everything someone anyone everyone nobody
  time times day days week weeks month months year years today tonight tomorrow yesterday morning night evening
  good bad better best worse well fine okay real really actually maybe perhaps probably almost even ever never always sometimes
  long short small little big large whole half full empty easy hard
  because though although however instead else also only quite rather already yet soon
  being done doing didn wasn isn aren cannot
  which whom whose where whether
  work works worked working use uses used using`
    .split(/\s+/)
    .filter(Boolean),
)

/** Every content word in order, duplicates kept — the diff has to count. */
export function contentWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !COMMON.has(w))
}

export type Span = { id: string; label: string; from: string; to: string }

export type SpanPair = { id: string; now: Span; then: Span }

/**
 * Spans to set against each other.
 *
 * The default pair holds roughly comparable entry counts on purpose. Measured
 * against the fixture, "the last two years against the two before" returns 59
 * words started and 9 stopped — which is not a change in how she writes, it is
 * 36 entries against 11. An uneven comparison reads as a verdict on the thinner
 * side, so the entry count for each span is on the screen next to it, always.
 */
export const SPAN_PAIRS: SpanPair[] = [
  {
    id: 'year',
    now: { id: 'now', label: 'the last year', from: '2025-08-17', to: TODAY },
    then: { id: 'then', label: 'the year before that', from: '2024-08-17', to: '2025-08-16' },
  },
  {
    id: 'two',
    now: { id: 'now', label: 'the last two years', from: '2024-08-17', to: TODAY },
    then: { id: 'then', label: 'the two before that', from: '2022-08-17', to: '2024-08-16' },
  },
  {
    id: 'half',
    now: { id: 'now', label: 'since the autumn of 2024', from: '2024-10-01', to: TODAY },
    then: { id: 'then', label: 'everything before it', from: '2023-01-01', to: '2024-09-30' },
  },
]

export type SpanWords = {
  span: Span
  entries: number
  /** word → the date it first appears inside the span. */
  first: Map<string, string>
  count: Map<string, number>
}

export function wordsIn(span: Span): SpanWords {
  const first = new Map<string, string>()
  const count = new Map<string, number>()
  let entries = 0
  for (const e of ENTRIES) {
    if (e.date < span.from || e.date > span.to) continue
    entries += 1
    for (const w of contentWords(e.paragraphs.join(' '))) {
      count.set(w, (count.get(w) ?? 0) + 1)
      if (!first.has(w)) first.set(w, e.date)
    }
  }
  return { span, entries, first, count }
}

export type VocabularyDiff = {
  now: SpanWords
  then: SpanWords
  /** In the later span and not the earlier one. Ordered by first appearance. */
  started: string[]
  /** In the earlier span and not the later one. Ordered by first appearance. */
  stopped: string[]
}

/**
 * The words she uses now, against the words she used then.
 *
 * GUARDRAILS' own sanctioned construction is "'Angry' appears in 7 entries this
 * month" — a count of the writer's own vocabulary, which is a fact about the
 * text and not a read on the person. This is that, twice, with the two lists
 * set side by side and nothing said about either.
 *
 * Ordered by when the word first appears, never by how often. A frequency
 * ranking would put the word she used most at the top of a list titled with her
 * own life, and that is a ranking of what mattered.
 *
 * Archive-scoped only. The same two lists computed over the entries naming one
 * person would be a portrait of that relationship, and a bad month would put a
 * bad word at the top of it.
 */
export function vocabularyDiff(pair: SpanPair, floor = 2): VocabularyDiff {
  const now = wordsIn(pair.now)
  const then = wordsIn(pair.then)
  const byFirst = (side: SpanWords, other: SpanWords) =>
    [...side.count]
      .filter(([w, n]) => n >= floor && !other.count.has(w))
      .map(([w]) => w)
      .sort((a, b) => (side.first.get(a) ?? '').localeCompare(side.first.get(b) ?? '') || a.localeCompare(b))
  return { now, then, started: byFirst(now, then), stopped: byFirst(then, now) }
}

// ── what she asked ─────────────────────────────────────────────────────────

export type Question = { date: string; entryId: string; text: string }

/** Every line that ends in a question mark. Every one — a subset would select. */
export function questionsAll(): Question[] {
  const out: Question[] = []
  for (const e of ENTRIES) {
    for (const p of e.paragraphs) {
      if (p.trim().endsWith('?')) out.push({ date: e.date, entryId: e.id, text: p })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export type Asked = { questions: Question[]; shared: string[] }

/**
 * Her questions, and the ones she asked more than once.
 *
 * Same anchoring as `returning()` — everything is measured against the earliest
 * one, so a group belongs to when the question FIRST came up rather than to
 * whichever phrasing happened to share the most words.
 *
 * What this deliberately does not do: say that a question stopped. A question
 * asked eleven times in one year and not since is arithmetic, and the last date
 * is right there to be read. Writing the word `answered`, `resolved` or `no
 * longer` above it would be the app interpreting a silence, which is the thing
 * H2 says is not ours to interpret. The dates are the whole statement.
 */
export function askedGroups({ share = 2 } = {}): Asked[] {
  const all = questionsAll()
  const used = new Set<string>()
  const out: Asked[] = []

  for (const seed of all) {
    if (used.has(seed.text)) continue
    const seedWords = words(seed.text)
    const group = [seed]
    const matched = new Set<string>()

    for (const other of all) {
      if (other === seed || used.has(other.text)) continue
      const ow = words(other.text)
      const common = [...seedWords].filter((w) => ow.has(w))
      if (common.length >= share) {
        group.push(other)
        for (const w of common) matched.add(w)
      }
    }

    for (const q of group) used.add(q.text)
    out.push({ questions: group, shared: [...matched] })
  }
  return out
}

// ── gift, and where He seemed far ──────────────────────────────────────────

export function markingsOfKind(kind: MarkingKind): PlacedMarking[] {
  return allMarkings()
    .filter((m) => m.kind === kind)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * The nearest thing she called a gift, before the day she said He was far.
 *
 * Ignatius's own instruction to the person in desolation is to remember that
 * consolation was real and will be again — and it is addressed to the one
 * person who cannot carry it out, because from inside a dry season you cannot
 * find where the gifts were. Paging back to look for them is exactly the reread
 * both interviews refuse. Code can do it in no time at all.
 *
 * Both ends are declared. She marked the absence; she marked the gift. Nothing
 * here is inferred, and the app writes nothing between them.
 *
 * DELIBERATELY ONE-WAY. Rule 10 does the reverse as well — the consoled should
 * store up against the dark that is coming — and we are not building that. A
 * director raising a shadow while you are glad and an app doing it are not the
 * same act, and only one of them knows you.
 *
 * Returns null when there is no earlier gift, and the scene must show that as
 * nothing rather than as a fallback. The June 2024 absence sits in the thin
 * stretch and has none, which is the honest case and the one worth showing.
 */
export function giftBefore(absence: PlacedMarking): PlacedMarking | null {
  const gifts = markingsOfKind('gift').filter((g) => g.date < absence.date)
  return gifts.length ? gifts[gifts.length - 1]! : null
}

export type Consolation = { absence: PlacedMarking; gift: PlacedMarking | null }

export function consolations(): Consolation[] {
  return markingsOfKind('absence').map((absence) => ({ absence, gift: giftBefore(absence) }))
}

// ── one line, and the same line again ──────────────────────────────────────

export type Pick = { entry: Entry; marking: PlacedMarking; back: PlacedMarking }

/**
 * What would come to her on a given day.
 *
 * The rule `#comesto` runs, written down so it can be run at another date: the
 * most recent entry on or before the anchor that carries a marking with
 * something earlier in her own words behind it.
 */
export function comesToPick(anchor: string = TODAY): Pick | null {
  const candidates = ENTRIES.filter((e) => e.date <= anchor).reverse()
  for (const entry of candidates) {
    for (const m of entry.markings ?? []) {
      const marking = { ...m, entryId: entry.id, date: entry.date }
      const back = earlierEcho(marking)
      if (back) return { entry, marking, back }
    }
  }
  return null
}

/** Days between two ISO dates. A fact of the calendar. */
export function daysBetween(a: string, b: string): number {
  return Math.abs(Math.round((Date.parse(b) - Date.parse(a)) / 86400000))
}

export function shiftDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86400000).toISOString().slice(0, 10)
}

// ── around now ─────────────────────────────────────────────────────────────

export type AroundVariant = 'date' | 'season' | 'derived'

/**
 * Movable feasts, as a table rather than as an algorithm.
 *
 * Computus in a prototype is a lot of code to get subtly wrong, and a season
 * that starts on the wrong Sunday would be the app being confidently incorrect
 * about somebody's tradition. Dates are the real ones for these four years.
 */
const EASTER: Record<number, string> = {
  2023: '2023-04-09',
  2024: '2024-03-31',
  2025: '2025-04-20',
  2026: '2026-04-05',
}
const ADVENT_1: Record<number, string> = {
  2023: '2023-12-03',
  2024: '2024-12-01',
  2025: '2025-11-30',
  2026: '2026-11-29',
}

export type Season = { id: 'advent' | 'lent' | 'eastertide'; label: string }

export const SEASONS: Season[] = [
  { id: 'advent', label: 'Advent' },
  { id: 'lent', label: 'Lent' },
  { id: 'eastertide', label: 'Eastertide' },
]

function seasonWindow(id: Season['id'], year: number): { from: string; to: string } | null {
  const easter = EASTER[year]
  const advent = ADVENT_1[year]
  if (id === 'lent') return easter ? { from: shiftDays(easter, -46), to: shiftDays(easter, -1) } : null
  if (id === 'eastertide') return easter ? { from: easter, to: shiftDays(easter, 49) } : null
  return advent ? { from: advent, to: `${year}-12-24` } : null
}

export function seasonOn(iso: string): Season | null {
  const year = Number(iso.slice(0, 4))
  for (const s of SEASONS) {
    const w = seasonWindow(s.id, year)
    if (w && iso >= w.from && iso <= w.to) return s
  }
  return null
}

export type Around = {
  variant: AroundVariant
  /** What makes this an occasion at all. Null means it is not one today. */
  occasion: string | null
  /** Prior years only. This year is where she is standing. */
  years: { year: number; entries: Entry[] }[]
  /** For the derived variant: how many prior years carry it. A count. */
  priorYears: number
}

/**
 * An occasion, and what she wrote the last time it came around.
 *
 * All three of these are OCCASIONAL: the page exists because of a date, and it
 * is gone when the date passes. It never accumulates, it is never counted, and
 * there is no state where she is behind on it. That is the whole difference
 * between a liturgy and an inbox, and it is why this can be time-based at all
 * when `#moment` and `#returning` deliberately are not.
 */
export function around(anchor: string, variant: AroundVariant, { pad = 7, minYears = 2 } = {}): Around {
  const year = Number(anchor.slice(0, 4))
  const priorYearsList = [...new Set(ENTRIES.map((e) => Number(e.date.slice(0, 4))))].filter((y) => y < year).sort()

  if (variant === 'season') {
    const season = seasonOn(anchor)
    if (!season) return { variant, occasion: null, years: [], priorYears: 0 }
    const years = priorYearsList
      .map((y) => {
        const w = seasonWindow(season.id, y)
        return { year: y, entries: w ? ENTRIES.filter((e) => e.date >= w.from && e.date <= w.to) : [] }
      })
      .filter((r) => r.entries.length)
    return { variant, occasion: season.label, years, priorYears: years.length }
  }

  // Both remaining variants are the same arithmetic: a week either side of this
  // day, in the years before this one.
  const md = anchor.slice(5)
  const years = priorYearsList
    .map((y) => {
      const centre = `${y}-${md}`
      const from = shiftDays(centre, -pad)
      const to = shiftDays(centre, pad)
      return { year: y, entries: ENTRIES.filter((e) => e.date >= from && e.date <= to) }
    })
    .filter((r) => r.entries.length)

  if (variant === 'derived') {
    // She has been here before, more than once. Below the floor it is a
    // coincidence, and the app says nothing rather than making one date mean
    // something.
    if (years.length < minYears) return { variant, occasion: null, years: [], priorYears: years.length }
    return { variant, occasion: null, years, priorYears: years.length }
  }

  return { variant, occasion: null, years, priorYears: years.length }
}
