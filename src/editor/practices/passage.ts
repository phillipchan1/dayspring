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

/** The phrase a `mark` answer opens with, or null. */
export function caughtOf(answer: string): string | null {
  const first = answer.split('\n', 1)[0] ?? ''
  const m = first.match(CAUGHT_LINE)
  const phrase = m?.[1]?.trim()
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

/** A verse brought into an answer: its words, and its number. */
export function quoteVerse(text: string, n: number): string {
  // The verse's own quotation marks nest inside ours as single quotes.
  const inner = text.trim().replace(/“/g, '‘').replace(/”/g, '’')
  return `“${inner}” (v. ${n})`
}

/** The verse numbers an answer has quoted, so the leaf can show them. */
export function citedVerses(answer: string): number[] {
  return [...answer.matchAll(/\(v\. (\d+)\)/g)].map((m) => Number(m[1]))
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
