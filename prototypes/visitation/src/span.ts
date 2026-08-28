import { ENTRIES, SUBJECTS, type Entry, type Marking, type MarkingKind } from './corpus'
import { pinsFor, type Pin } from './fathers'

/**
 * The arithmetic. Every number on the page is computed here, in code.
 *
 * Nothing in this file selects, ranks, weights, or decides what mattered. It
 * counts, it groups by date, and it gathers what she declared. D-016 is the
 * whole constraint — "recurrence is a count; significance is a verdict" — and
 * the way to keep on the right side of it is to make sure every figure the
 * page shows can be recomputed by hand from her entries.
 *
 * If a function in here ever needs a threshold that is not stated on screen,
 * it has stopped being arithmetic and started being an opinion.
 */

export type Span = {
  id: string
  /** What it is called on screen. Never a title we invented about her. */
  label: string
  from: string
  to: string
  /**
   * When the page goes.
   *
   * Not decoration — this is what makes the whole surface legal. RECALL.md
   * § Tenure: "no occasion may accrue. A weekly page that is gone on Monday is
   * a liturgy. The same page still there in March is a chore about someone's
   * prayer life, and no amount of gentle copy fixes it."
   */
  expires: string
}

export const SPANS: Span[] = [
  {
    id: 'summer-2026',
    label: 'Summer',
    from: '2026-06-01',
    to: '2026-08-31',
    expires: '2026-09-22',
  },
  {
    id: 'thin-2024',
    label: 'Spring and summer',
    from: '2024-03-01',
    to: '2024-08-31',
    expires: '2024-09-22',
  },
  {
    id: 'year-2026',
    label: 'The year so far',
    from: '2026-01-01',
    to: '2026-08-31',
    expires: '2026-12-31',
  },
]

export function spanById(id: string): Span {
  return SPANS.find((s) => s.id === id) ?? SPANS[0]
}

export function entriesIn(span: Span): Entry[] {
  return ENTRIES.filter((e) => e.date >= span.from && e.date <= span.to)
}

export type PlacedMarking = Marking & { entryId: string; date: string }

export function markingsIn(span: Span): PlacedMarking[] {
  const out: PlacedMarking[] = []
  for (const e of entriesIn(span)) {
    for (const m of e.markings ?? []) out.push({ ...m, entryId: e.id, date: e.date })
  }
  return out
}

export function markingsOfKind(span: Span, kind: MarkingKind): PlacedMarking[] {
  return markingsIn(span).filter((m) => m.kind === kind)
}

/**
 * Every line in the span that ends in a question mark.
 *
 * A fact about the text, and the cheapest true thing on the page. RECALL flags
 * the shape as the thing to argue about rather than the arithmetic: a question
 * asked four times and then never again has a visible last date, and a reader
 * supplies the word "answered". That is right when SHE supplies it and
 * forbidden when the app does (H2 — absence is not ours to interpret).
 *
 * So: never sorted, never grouped by whether they are still being asked, never
 * a word on screen suggesting any of them was resolved. Date order, all of
 * them, and the reader does what the reader does.
 */
export type Question = { entryId: string; date: string; text: string }

export function questionsIn(span: Span): Question[] {
  const out: Question[] = []
  for (const e of entriesIn(span)) {
    for (const p of e.paragraphs) {
      const t = p.trim()
      if (t.endsWith('?')) out.push({ entryId: e.id, date: e.date, text: t })
    }
  }
  return out
}

/**
 * Ordinary English, removed.
 *
 * `looking/subjects.ts` records the two rules that failed before this one, and
 * they are worth keeping in view: raw frequency returns *down, also, used,
 * already, going, without*, and restricting to words inside a marking is no
 * better, because a marking quote is a whole sentence and drags the same
 * ordinary English along with it.
 *
 * A stop list is not a clever fix. It is a fixed, visible, arguable list —
 * which is the same property that makes fathers.ts's LEXICON acceptable.
 *
 * THE RULE IT FOLLOWS, AND THE ONE IT MUST NOT: it removes CLOSED-CLASS words —
 * articles, pronouns, prepositions, conjunctions, auxiliaries — because those
 * are grammar rather than vocabulary. It must never remove a word for being
 * *unremarkable about her*, because deciding which of her words are remarkable
 * is exactly the verdict D-016 forbids.
 *
 * The first draft of this list failed that test and it is worth recording how,
 * because the mistake is the natural one: it held *still*, *want*, *keep* and
 * *time* — every one of them a content word, and *still* and *want* between
 * them carry most of what her summer is about. They got in because they look
 * like filler in the abstract. Nothing that carries meaning comes out, even
 * when it is common, and the cost is that the list below leaves some dull
 * words in. That is the correct direction to be wrong in.
 */
const ORDINARY = new Set(
  `a an and are as at be been being but by can could did do does doing done for from had has have
   he her hers here him his how i if in into is it its itself me my myself no nor not of off on
   once one or our ours out over own she should so some such than that the their theirs them then
   there these they this those through to too under until up us very was we were what when where
   which while who whom why will with would you your yours
   about after again against all any because before between both during each either every few
   further more most much neither other same since though upon yet also even ever never always
   just only down back
   dont doesnt didnt isnt wasnt arent wasn't isn't aren't don't doesn't didn't i'm it's that's
   there's what's she's he's i'll i've`
    .split(/\s+/)
    .filter(Boolean),
)

/**
 * Names, removed — because a name is a subject, and subjects are a surface.
 *
 * The first build put *Mira*, *David* and *Mom* at the front of "the words you
 * kept saying", and they are of course the words she used most. But a name is
 * not vocabulary, it is a person, and the product already has a place people
 * are handled: `looking`'s subjects, with their own rules about what may and
 * may not be said about somebody who consented to nothing (GUARDRAILS §
 * Privacy in generated output).
 *
 * So this is not a taste cut. Leaving them in would quietly make this movement
 * a second, weaker person-view that skips those rules — a list of the people in
 * her life ordered by how often she mentioned them, which is a hair's breadth
 * from ranking them.
 *
 * The names come from the Concordance, which is exactly what it is for: it
 * learns names and spellings, never moods, never verdicts.
 */
const NAMES = new Set(SUBJECTS.filter((s) => s.kind === 'person').flatMap((s) => s.terms))

export type RepeatedWord = { word: string; entryIds: string[] }

/**
 * Words she used in more than one entry in this span.
 *
 * GUARDRAILS' own sanctioned example is literally *"'Angry' appears in 7
 * entries this month"* — her vocabulary is the legal form of everything a
 * sentiment score would try to do, and it lands harder, because every word in
 * it is hers.
 *
 * THE FLOOR IS TWO ENTRIES AND IT IS PRINTED ON SCREEN. That is the only
 * shortening this list is allowed. "The most significant thirty" would be
 * selection, and selection is significance, and significance is a verdict.
 * A word said once is a word she used; a word said in two separate sittings is
 * a word she uses — and that distinction is arithmetic, not taste.
 *
 * Order is FIRST APPEARANCE, never count. A list sorted by frequency is a list
 * ranking what is on someone's mind.
 *
 * Note what this does not do: `still` here covers "still here, still asking"
 * and "a love that only knows how to sit still", which are different words
 * wearing one spelling. Nothing collapses them and nothing should — the page
 * shows the word and every line it is in, and she reads the difference in a
 * second. An app that tried to tell them apart would be doing semantics on her
 * interior life.
 */
export function repeatedWords(span: Span): RepeatedWord[] {
  const first = new Map<string, { order: number; ids: string[] }>()
  let order = 0
  for (const e of entriesIn(span)) {
    const seenHere = new Set<string>()
    for (const p of e.paragraphs) {
      for (const raw of p.toLowerCase().match(/[a-z']+/g) ?? []) {
        const w = raw.replace(/^'+|'+$/g, '')
        if (w.length < 3 || ORDINARY.has(w) || NAMES.has(w)) continue
        if (seenHere.has(w)) continue
        seenHere.add(w)
        const rec = first.get(w)
        if (rec) rec.ids.push(e.id)
        else first.set(w, { order: order++, ids: [e.id] })
      }
    }
  }
  return [...first.entries()]
    .filter(([, v]) => v.ids.length >= 2)
    .sort((a, b) => a[1].order - b[1].order)
    .map(([word, v]) => ({ word, entryIds: v.ids }))
}

/** Her repeated words, joined to the council. Pure lookup — see fathers.ts. */
export function councilFor(span: Span): Pin[] {
  return pinsFor(repeatedWords(span))
}

/** Repeated words that reached nothing. Rendered as themselves, with silence beside them. */
export function unreachedWords(span: Span): RepeatedWord[] {
  const reached = new Set(councilFor(span).map((p) => p.word))
  return repeatedWords(span).filter((w) => !reached.has(w.word))
}

export type ScriptureRef = { ref: string; entryId: string; date: string; quote: string }

export function scriptureIn(span: Span): ScriptureRef[] {
  return markingsOfKind(span, 'scripture')
    .filter((m): m is PlacedMarking & { ref: string } => Boolean(m.ref))
    .map((m) => ({ ref: m.ref, entryId: m.entryId, date: m.date, quote: m.quote }))
}

/**
 * The declared kinds, in span, with counts.
 *
 * This is the entire content of the heart. Not a mood, not a tone, not
 * anything derived: the six acts she named with her own hand while writing.
 */
export const CHAMBER_KINDS: MarkingKind[] = ['prayer', 'desire', 'sense', 'story', 'learned', 'scripture']

export type Chamber = { kind: MarkingKind; markings: PlacedMarking[] }

export function chambers(span: Span): Chamber[] {
  return CHAMBER_KINDS.map((kind) => ({ kind, markings: markingsOfKind(span, kind) }))
}

/**
 * Days since the last entry carrying this kind, as of the span's end.
 *
 * The Covenant sky's own encoding, and the only reason it is legal: BRIGHTNESS
 * IS RECENCY. Principle 1, verbatim — "a star's brightness is recency, its halo
 * is span. There is deliberately no vertical axis, because a vertical axis
 * would imply better and worse."
 *
 * So a dim chamber means *a while ago*, and it means nothing else. It does not
 * mean neglected, cooled, lapsed, or any of the words a reader might bring —
 * and the page never supplies one of those words, because absence is not ours
 * to interpret (H2).
 */
export function daysSince(span: Span, kind: MarkingKind): number | null {
  const ms = markingsOfKind(span, kind)
  if (!ms.length) return null
  const last = ms[ms.length - 1].date
  return dayGap(last, span.to)
}

function dayGap(a: string, b: string): number {
  const d = (s: string) => {
    const [y, m, dd] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, dd)
  }
  return Math.round((d(b) - d(a)) / 86400000)
}

/**
 * Everything the page shows, in one object, so a scene cannot invent a figure.
 *
 * The pattern is on purpose: a scene that wants a number has to find it here,
 * and anything here can be traced to a loop over her entries. It is the same
 * discipline as the rollup pipeline — facts computed in code, the render layer
 * given nothing to be creative with.
 */
export type Reading = {
  span: Span
  entries: Entry[]
  chambers: Chamber[]
  questions: Question[]
  words: RepeatedWord[]
  unreached: RepeatedWord[]
  council: Pin[]
  scripture: ScriptureRef[]
  prayers: PlacedMarking[]
  /**
   * Too little to say anything, and the page says that instead of padding.
   *
   * Principle 5 has the states already — EMPTY / INSUFFICIENT / READY — and
   * the corollary is the one that costs: "we would rather show an empty state
   * that tells the truth than a manufactured insight that impresses."
   *
   * The threshold is stated on screen wherever it fires. What the page must
   * never do here is compare this span's count to the last one: a volume delta
   * between two spans is a streak counter in a robe, whatever the copy says.
   */
  thin: boolean
}

/** Below this, the page reports the span and stops. Stated on screen when it fires. */
export const THIN_FLOOR = 5

export function read(span: Span): Reading {
  const entries = entriesIn(span)
  return {
    span,
    entries,
    chambers: chambers(span),
    questions: questionsIn(span),
    words: repeatedWords(span),
    unreached: unreachedWords(span),
    council: councilFor(span),
    scripture: scriptureIn(span),
    prayers: markingsOfKind(span, 'prayer'),
    thin: entries.length < THIN_FLOOR,
  }
}

/**
 * The dates on the page are HER dates, not the calendar's.
 *
 * The span runs June 1 – August 31; the line reads "June 3 – August 16",
 * because those are the days she wrote. Printing the calendar bounds would
 * frame the season as a container she partly filled, and a container you
 * partly filled is a container you partly failed to fill.
 *
 * (This function therefore takes no span at all — which is the tell that the
 * distinction is real rather than cosmetic.)
 */
export function formatRange(entries: Entry[]): string {
  if (!entries.length) return ''
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    })
  }
  return `${fmt(entries[0].date)} – ${fmt(entries[entries.length - 1].date)}`
}

export function formatExpiry(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
