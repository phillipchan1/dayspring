/**
 * A scripture ritual's passage — what it is, where it lives in the document,
 * and the small grammar the movements write around it.
 *
 * Nothing here changes the stored format. A ritual entry is still
 * `ritual:name` plus one `ritual:section` per movement, and each movement's
 * answer is text:
 *
 * - The `read` movement's answer IS the passage: an ordinary scripture fence,
 *   byte-for-byte what `/scripture` writes, so the save-time reconcile lights
 *   the Scripture surface with no new code. Read from your own Bible and the
 *   fence carries the reference with no verse text.
 * - The `mark` movement's answer opens with the word that caught you as a
 *   markdown quote line (`> Remain in me`), then a blank line, then what you
 *   wrote. Plain markdown: it reads as a quote everywhere, exports as one, and
 *   needs no positions kept against the entry.
 * - A verse brought into a `cite` answer is plain text: `“…” (v. 39)`. The
 *   passage is already captured once; quoting from it must not count it twice.
 *
 * Pure, so it is tested without a DOM — see passage.test.ts.
 */
import { BOOKS, type BibleBook } from '@/lib/bible/canon'
import { chapterFromCitation } from '@/lib/scripture/citation'
import { formatSpiritualBlock, parseSpiritualBlocks } from '@/lib/spiritualBlocks'

export interface PassageRef {
  /** Canon display name — "Psalms", "1 Corinthians". */
  book: string
  chapter: number
  /** Null for the whole chapter. */
  from: number | null
  to: number | null
}

export interface Passage {
  /** Null when the reference no longer parses (hand-edited, or a stray fence). */
  ref: PassageRef | null
  /** The fence's reference line without its translation — "John 15:4–5". */
  reference: string
  /** The verse text as written into the fence; empty when read from your own Bible. */
  text: string
  /** Read from the writer's own Bible: a reference, and no words shown. */
  own: boolean
}

export interface Verse {
  n: number
  text: string
}

/** "Psalms" reads in the singular once one chapter is in view. */
export function displayBook(book: string): string {
  return book === 'Psalms' ? 'Psalm' : book
}

/** "John 15:4–5", "John 15:5", "Psalm 23". */
export function passageLabel(ref: PassageRef): string {
  const head = `${displayBook(ref.book)} ${ref.chapter}`
  if (ref.from == null) return head
  const to = ref.to ?? ref.from
  return to === ref.from ? `${head}:${ref.from}` : `${head}:${ref.from}–${to}`
}

/** The verses of a chapter a passage covers. */
export function versesIn(ref: PassageRef, chapter: readonly Verse[]): Verse[] {
  if (ref.from == null) return chapter.slice()
  const to = ref.to ?? ref.from
  return chapter.filter((v) => v.n >= ref.from! && v.n <= to)
}

const TRANSLATION_TAIL = /\s*·\s*[A-Za-z]{2,5}\s*$/

/** The passage a `read` answer holds, or null when it holds none. */
export function readPassage(answer: string): Passage | null {
  const fence = parseSpiritualBlocks(answer).find((b) => b.type === 'scripture')
  if (!fence) return null
  const reference = (fence.reference ?? '').replace(TRANSLATION_TAIL, '').trim()
  const target = chapterFromCitation(reference)
  const ref: PassageRef | null = target
    ? {
        book: target.book,
        chapter: target.chapter,
        from: target.verse,
        to: target.verse == null ? null : (target.verseEnd ?? target.verse),
      }
    : null
  // A fence with only a reference parses as content = the reference line; a
  // one-line fence has no reference at all. Either way, no verse text.
  const text = fence.reference ? fence.content.trim() : ''
  return { ref, reference, text, own: text === '' }
}

/**
 * The passage as a `read` answer: the same fence `/scripture` writes.
 *
 * Verse text joined into one paragraph, the way a pasted or `/scripture`
 * passage reads. The numbers stay out of the stored text — the leaf re-reads
 * the chapter for them — so the fence is what any reader would expect.
 */
export function writePassage(ref: PassageRef, verses: readonly Verse[] | null, id: string): string {
  const label = passageLabel(ref)
  if (!verses || verses.length === 0) return formatSpiritualBlock('scripture', id, '', label)
  const text = verses.map((v) => v.text.trim()).join(' ')
  return formatSpiritualBlock('scripture', id, text, `${label} · ESV`)
}

/**
 * Whether a ritual can be walked with its passage.
 *
 * A scripture ritual begun before it had a finder carries a typed passage in
 * its first answer — prose, not a fence. Reopened, it keeps the plain
 * composer it was written in rather than being handed a finder that would
 * throw that prose away.
 */
export function canWalkWithPassage(firstAnswer: string): boolean {
  return firstAnswer.trim() === '' || readPassage(firstAnswer) !== null
}

// ── The word that caught you ────────────────────────────────────────────────

const CAUGHT_LINE = /^> ?(.*)$/

/** The phrase a `mark` answer opens with, or null. A verse tail is not part of it. */
export function caughtOf(answer: string): string | null {
  const first = answer.split('\n', 1)[0] ?? ''
  const m = first.match(CAUGHT_LINE)
  const phrase = m?.[1]?.replace(VERSE_TAIL, '').trim()
  return phrase ? phrase : null
}

/** What the writer wrote under the caught line — the answer's editable part. */
export function bodyOf(answer: string): string {
  if (caughtOf(answer) === null) return answer
  const nl = answer.indexOf('\n')
  return nl === -1 ? '' : answer.slice(nl + 1).replace(/^\n+/, '')
}

/** A `mark` answer from its two halves. */
export function withCaught(phrase: string | null, body: string): string {
  const p = phrase?.replace(/\s+/g, ' ').trim()
  if (!p) return body
  return body.trim() ? `> ${p}\n\n${body}` : `> ${p}`
}

/** Punctuation a tapped word should not carry into the quote. */
export function trimPhrase(words: string): string {
  return words
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[“”‘’"'(\[—–-]+/, '')
    .replace(/[“”‘’"',.;:)\]—–-]+$/, '')
}

const fold = (s: string) => s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ')

/**
 * Where a caught phrase sits in the passage, so it can stay lit — matched as
 * text, within one verse. Changing the passage then simply stops matching: the
 * phrase stays in the writer's words and goes dark in the text.
 */
export function findPhrase(
  verses: readonly Verse[],
  phrase: string | null,
): { n: number; start: number; end: number } | null {
  if (!phrase) return null
  const needle = fold(phrase)
  if (!needle) return null
  for (const v of verses) {
    const at = fold(v.text).indexOf(needle)
    if (at !== -1) return { n: v.n, start: at, end: at + needle.length }
  }
  return null
}

// ── Quotes drawn from the passage ───────────────────────────────────────────
//
// A phrase brought into an answer is a quote line of its own, carrying its
// verse: `> Remain in me, and I in you (v. 4)`, with a blank line after it so
// markdown cannot pull the writer's next sentence into the quote. The
// highlight in the passage and the line between them are DRAWN from this
// line — nothing else is stored, so moving, cutting or undoing a quote moves
// its highlight with it. `writerWords` keeps these lines out of anything that
// speaks of "your words" (Guardrail H3).

/** `(v. 4)`, `(vv. 4–5)` at the end of a quote line. */
const VERSE_TAIL = /\s*\(\s*vv?\.?\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*\)\s*$/

export interface DrawnQuote {
  /** The words, without the `>` or the verse. */
  text: string
  /** The verse it came from, when it says. */
  v: number | null
  /** The last verse, when it runs across more than one. */
  vEnd: number | null
  /** Which line of the answer holds it, 0-based. */
  line: number
}

/** Every quote line in an answer, in the order they were written. */
export function quotesIn(answer: string): DrawnQuote[] {
  const out: DrawnQuote[] = []
  answer.split('\n').forEach((raw, line) => {
    const m = raw.match(/^\s*>\s?(.*)$/)
    if (!m) return
    const tail = m[1]!.match(VERSE_TAIL)
    const text = m[1]!.replace(VERSE_TAIL, '').trim()
    if (text) {
      out.push({
        text,
        v: tail ? Number(tail[1]) : null,
        vEnd: tail?.[2] ? Number(tail[2]) : null,
        line,
      })
    }
  })
  return out
}

/** The quote line for a phrase: `(v. 4)`, or `(vv. 4–5)` across verses. */
export function formatQuote(text: string, v: number | null, vEnd: number | null = null): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (v == null) return `> ${t}`
  return vEnd != null && vEnd !== v ? `> ${t} (vv. ${v}–${vEnd})` : `> ${t} (v. ${v})`
}

/**
 * Where a quote goes in an answer: on its own line at the caret — after the
 * line the caret is on, or in place of an empty one — with a blank line on each
 * side. Returns the insertion and where the caret should land after it.
 */
export function placeQuote(doc: string, caret: number, quote: string): { at: number; text: string; caret: number } {
  const at0 = Math.max(0, Math.min(caret, doc.length))
  const lineStart = doc.lastIndexOf('\n', at0 - 1) + 1
  let lineEnd = doc.indexOf('\n', at0)
  if (lineEnd === -1) lineEnd = doc.length
  const lineIsEmpty = doc.slice(lineStart, lineEnd).trim() === ''
  const at = lineIsEmpty ? lineStart : lineEnd
  const before = doc.slice(0, at)
  const after = doc.slice(at)
  const lead = before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n'
  const trail = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n'
  const text = `${lead}${quote}${trail}`
  // At the end of the answer the caret waits on a fresh line below the quote;
  // otherwise it lands where the writing already continues.
  return { at, text, caret: at + text.length }
}

/**
 * Where a quote sits in the passage, so it stays lit — matched as text, in its
 * own verse when it says which. Change the passage and it simply stops
 * matching: the quote stays in the writer's page and goes dark in the text.
 */
export function findQuote(
  verses: readonly Verse[],
  text: string,
  v: number | null,
  vEnd: number | null = null,
): { n: number; start: number; end: number }[] | null {
  const needle = fold(text)
  if (!needle) return null
  const clean = verses.map((x) => ({ n: x.n, text: x.text.replace(/\s+/g, ' ').trim() }))
  // Search the verses as one run of text, so a quote that crosses a verse
  // break is found; then say back which part of which verse it covers.
  const tryRun = (run: typeof clean) => {
    let joined = ''
    const starts: number[] = []
    for (const x of run) {
      if (joined) joined += ' '
      starts.push(joined.length)
      joined += x.text
    }
    const at = fold(joined).indexOf(needle)
    if (at === -1) return null
    const end = at + needle.length
    const out: { n: number; start: number; end: number }[] = []
    run.forEach((x, k) => {
      const s0 = starts[k]!
      const s1 = s0 + x.text.length
      if (end > s0 && at < s1) out.push({ n: x.n, start: Math.max(0, at - s0), end: Math.min(x.text.length, end - s0) })
    })
    return out
  }
  if (v != null) {
    const last = vEnd ?? v
    const hit = tryRun(clean.filter((x) => x.n >= v && x.n <= last))
    if (hit) return hit
  }
  // No verse given, or one that no longer fits (a changed passage): the words
  // alone, anywhere in it.
  return tryRun(clean)
}

/** A whole verse, as a quote. */
export function quoteVerse(text: string, n: number): string {
  // A whole verse keeps its own quotation marks; only a closing stop goes.
  return formatQuote(text.trim().replace(/[.,;:]+$/, ''), n)
}

/** The verse numbers an answer has quoted, so the leaf can show them. */
export function citedVerses(answer: string): number[] {
  return quotesIn(answer).flatMap((q) => (q.v == null ? [] : [q.v]))
}

/**
 * The words a selection in the passage covers, snapped out to whole words and
 * read back as text: `from`/`to` are (verse, character) points, in order.
 */
export function spanText(
  verses: readonly Verse[],
  from: { n: number; offset: number },
  to: { n: number; offset: number },
): { text: string; v: number; vEnd: number } | null {
  const clean = verses.map((x) => ({ n: x.n, text: x.text.replace(/\s+/g, ' ').trim() }))
  const inRun = clean.filter((x) => x.n >= from.n && x.n <= to.n)
  if (inRun.length === 0) return null
  const parts: string[] = []
  inRun.forEach((x, k) => {
    let a = k === 0 ? from.offset : 0
    let b = k === inRun.length - 1 ? to.offset : x.text.length
    // Snap out to whole words: a drag that clips a word takes all of it.
    while (a > 0 && /\S/.test(x.text[a - 1]!)) a--
    while (b < x.text.length && /\S/.test(x.text[b]!)) b++
    if (b > a) parts.push(x.text.slice(a, b))
  })
  const text = trimPhrase(parts.join(' '))
  return text ? { text, v: inRun[0]!.n, vEnd: inRun[inRun.length - 1]!.n } : null
}

// ── Choosing a passage ──────────────────────────────────────────────────────

export type FinderQuery =
  | { type: 'empty' }
  | { type: 'book'; book: BibleBook; also: BibleBook[] }
  | { type: 'books'; books: BibleBook[]; word: string }
  | { type: 'ref'; book: BibleBook; chapter: number; from: number | null; to: number | null }
  | {
      type: 'typo'
      book: BibleBook
      chapter: number | null
      from: number | null
      to: number | null
      typed: string
    }
  | { type: 'nobook'; typed: string }
  | { type: 'topic'; word: string }

const squash = (s: string) => s.toLowerCase().replace(/[\s.]+/g, '')

/** Every form a book answers to, squashed: "1cor", "songofsongs", "jn". */
const FORMS: Map<string, BibleBook> = (() => {
  const m = new Map<string, BibleBook>()
  for (const b of BOOKS) {
    m.set(squash(b.name), b)
    for (const a of b.abbr) if (!m.has(squash(a))) m.set(squash(a), b)
  }
  return m
})()
const NAMES = new Set(BOOKS.map((b) => squash(b.name)))

/** Optimal-string-alignment distance: a swapped pair ("jhon") costs one. */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0]![j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2]![j - 2]! + 1)
      }
      d[i]![j] = v
    }
  }
  return d[a.length]![b.length]!
}

const QUERY =
  /^([1-3]?\s*[a-z][a-z .]*?)\.?\s*(\d+)?(?:\s*[:.]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/i

/**
 * What someone typed into the finder: a reference, a bare book (which
 * `/scripture` refuses by design — the parser ignores book names in prose), a
 * near-miss of a book, or a word to search on.
 */
export function parseFinderQuery(q: string): FinderQuery {
  const raw = q.trim()
  if (!raw) return { type: 'empty' }
  const m = raw.match(QUERY)
  if (!m) return { type: 'topic', word: raw }
  const name = m[1]!.trim().toLowerCase().replace(/\s+/g, ' ')
  const key = squash(name)
  const chapter = m[2] ? Number(m[2]) : null
  const from = m[3] ? Number(m[3]) : null
  const to = m[4] ? Number(m[4]) : from

  const prefix = BOOKS.filter((b) => {
    const n = b.name.toLowerCase()
    return n.startsWith(name) || n.replace(/^\d /, '').startsWith(name)
  })
  let book = FORMS.get(key)
  if (!book && prefix.length === 1 && key.length >= 3) book = prefix[0]
  if (!book && chapter != null && prefix.length > 0) book = prefix[0]

  if (book) {
    if (chapter == null) return { type: 'book', book, also: prefix.filter((b) => b !== book).slice(0, 5) }
    const clamped = Math.max(1, Math.min(chapter, book.chapters))
    return { type: 'ref', book, chapter: clamped, from, to }
  }
  if (prefix.length > 0 && chapter == null) return { type: 'books', books: prefix.slice(0, 7), word: raw }

  if (key.length >= 3) {
    // Ties go to a full name of the same length — "jhon" is one swap from both
    // John and the abbreviation "jon", and nobody typing it meant Jonah.
    let best: BibleBook | null = null
    let bestScore = Infinity
    for (const [form, b] of FORMS) {
      const lenGap = Math.abs(form.length - key.length)
      if (lenGap > 2) continue
      const dd = distance(key, form)
      if (dd > 2) continue
      const score = dd * 10 + (NAMES.has(form) ? 0 : 3) + lenGap
      if (score < bestScore) {
        bestScore = score
        best = b
      }
    }
    if (best) return { type: 'typo', book: best, chapter, from, to, typed: m[1]!.trim() }
  }
  if (chapter != null) return { type: 'nobook', typed: m[1]!.trim() }
  return { type: 'topic', word: raw }
}

/**
 * The one soft line about length — said, never enforced. Their practice
 * (Principle 6): we describe how it is usually done and keep what they chose.
 */
export function sizeNote(size: 'few' | 'story', count: number, practiceName: string): string | null {
  if (size === 'few' && count > 8) {
    return `${practiceName} usually stays with a few verses. You can keep all ${count}.`
  }
  if (size === 'story' && count === 1) {
    return `${practiceName} reads a whole story. Choose the verses around this one.`
  }
  return null
}

/** Book, chapter and verse span of an OSIS ref: "Rom.8.28-Rom.8.30". */
export function refFromOsis(osisRef: string): PassageRef | null {
  const [start, end] = osisRef.split('-')
  const s = start?.split('.') ?? []
  const book = BOOKS.find((b) => b.osis === s[0])
  const chapter = Number(s[1])
  if (!book || !chapter) return null
  const from = s[2] ? Number(s[2]) : null
  const e = end?.split('.') ?? []
  // A span that crosses chapters keeps to the chapter it starts in: the leaf
  // shows one chapter, the licence shape the chapter pane already uses.
  const sameChapter = e[0] === s[0] && Number(e[1]) === chapter
  const to = from == null ? null : sameChapter && e[2] ? Number(e[2]) : from
  return { book: book.name, chapter, from, to }
}
