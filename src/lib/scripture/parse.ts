// Pure, isomorphic scripture-reference parser. Scans free prose and emits OSIS
// references. Zero Supabase / DOM / Node imports — the editor (live capture, P2)
// and the backfill script both call this with the same signature.
//
// We hand-roll against canon.ts rather than bundling a passage-reference library:
// it keeps the surface dependency-free and the bundle lean (the brand is
// restraint), and the recognized set is exactly the 66-book canon.
//
// Handles: "Phil 4:6", "Romans 8:28-30", "1 Cor 13", "Ps 23", "John 15:5,11",
// "Psalm 42 and 43". Verse lists and "and N" chapter continuations each expand
// into their own ParsedRef so the map counts every distinct landing place.

import { BOOKS, type BibleBook } from '../bible/canon'

export interface ParsedRef {
  osis_ref: string
  book_osis: string
  book_name: string
  book_order: number
  chapter: number
  verse_start: number | null
  verse_end: number | null
  /** Offset of the reference's first char in the source text. */
  char_start: number
  /** Offset one past the reference's last char. */
  char_end: number
  /** 1.0 for a clean in-range hit; lowered (not dropped) when clamped. */
  confidence: number
}

// ── book-name matcher ────────────────────────────────────────────────────────
// One alternation over every accepted form, longest-first so "1 corinthians"
// wins over "1 cor". Spaces in a form become \s* so "1 cor" also catches "1cor".

interface NameForm {
  book: BibleBook
  source: string
}

const NAME_FORMS: NameForm[] = BOOKS.flatMap((book) =>
  book.abbr.map((source) => ({ book, source })),
).sort((a, b) => b.source.length - a.source.length)

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const NAME_ALT = NAME_FORMS.map((f) => escapeRegex(f.source).replace(/\\?\s+/g, '\\s*')).join('|')

// Resolve a matched (lowercased, whitespace-collapsed) book token to its book.
const FORM_LOOKUP = new Map<string, BibleBook>()
for (const { book, source } of NAME_FORMS) {
  FORM_LOOKUP.set(source.replace(/\s+/g, ''), book)
}

// Book name, then a chapter, then an optional ref body of digits/separators.
// A trailing "." after the name (e.g. "Gen.") and an optional "ch"/"chapter"
// keyword are both tolerated. The body is parsed structurally below.
const REF_RE = new RegExp(
  String.raw`\b(${NAME_ALT})\.?\s*(?:ch(?:apter|apters|aps?)?\.?\s*)?` +
    String.raw`(\d{1,3})` +
    String.raw`((?:\s*[:.]\s*\d{1,3}|\s*[-–—]\s*\d{1,3}(?:\s*[:.]\s*\d{1,3})?|\s*,\s*\d{1,3}|\s*(?:and|&)\s+\d{1,3}|\s*v(?:erses?|v|s)?\.?\s*\d{1,3})*)`,
  'gi',
)

interface Span {
  /** A contiguous range that becomes one ParsedRef. */
  chapter: number
  verseStart: number | null
  verseEnd: number | null
}

/** Parse the body (everything after the first chapter number) into spans. */
function parseBody(firstChapter: number, body: string): Span[] {
  const spans: Span[] = []
  let chapter = firstChapter
  let verseStart: number | null = null
  let verseEnd: number | null = null
  let sawVerse = false

  // Tokenize into separators + numbers in document order.
  const tokens = body.match(/[:.]|[-–—]|,|&|and|v(?:erses?|v|s)?\.?|\d{1,3}/gi) ?? []
  let pendingSep: string | null = null

  const flush = () => {
    spans.push({ chapter, verseStart, verseEnd })
    verseStart = null
    verseEnd = null
  }

  for (const raw of tokens) {
    const tok = raw.toLowerCase()
    if (/^\d/.test(tok)) {
      const n = parseInt(tok, 10)
      if (pendingSep === ':' || pendingSep === '.') {
        // chapter:verse
        verseStart = n
        verseEnd = null
        sawVerse = true
      } else if (pendingSep === '-') {
        // range end — verse if we're mid-verse, else a chapter range we ignore
        if (verseStart != null) verseEnd = n
      } else if (pendingSep === ',') {
        // additional verse in the same chapter → its own span
        flush()
        verseStart = n
        verseEnd = null
      } else if (pendingSep === 'and') {
        // "Psalm 42 and 43" — only continue as a new chapter when verseless
        flush()
        if (!sawVerse) {
          chapter = n
          verseStart = null
          verseEnd = null
        } else {
          // "15:5 and 11" → another verse of the same chapter
          verseStart = n
          verseEnd = null
        }
      } else if (pendingSep === 'v') {
        verseStart = n
        verseEnd = null
        sawVerse = true
      }
      pendingSep = null
    } else if (tok === ':' || tok === '.') {
      pendingSep = ':'
    } else if (tok === '-' || tok === '–' || tok === '—') {
      pendingSep = '-'
    } else if (tok === ',') {
      pendingSep = ','
    } else if (tok === 'and' || tok === '&') {
      pendingSep = 'and'
    } else {
      // a "v"/"verse" marker
      pendingSep = 'v'
    }
  }
  flush()
  return spans
}

function clampSpan(book: BibleBook, span: Span): { span: Span; confidence: number } {
  let confidence = 1
  let chapter = span.chapter
  if (chapter < 1) {
    chapter = 1
    confidence = 0.5
  } else if (chapter > book.chapters) {
    chapter = book.chapters
    confidence = 0.5
  }
  let verseStart = span.verseStart
  let verseEnd = span.verseEnd
  if (verseStart != null && verseStart < 1) {
    verseStart = 1
    confidence = Math.min(confidence, 0.5)
  }
  if (verseEnd != null && verseStart != null && verseEnd < verseStart) {
    // garbled range — keep the start, drop the end
    verseEnd = null
    confidence = Math.min(confidence, 0.6)
  }
  return { span: { chapter, verseStart, verseEnd }, confidence }
}

function osisFor(book: BibleBook, span: Span): string {
  if (span.verseStart == null) return `${book.osis}.${span.chapter}`
  const start = `${book.osis}.${span.chapter}.${span.verseStart}`
  if (span.verseEnd == null) return start
  return `${start}-${book.osis}.${span.chapter}.${span.verseEnd}`
}

/**
 * Find every scripture reference in `text`. Refs that don't resolve to a canon
 * book are dropped; out-of-range chapters/verses are clamped with lowered
 * confidence (so review can catch them) rather than discarded.
 */
export function parseReferences(text: string): ParsedRef[] {
  const out: ParsedRef[] = []
  if (!text) return out

  REF_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = REF_RE.exec(text)) !== null) {
    // References are proper nouns — require the book token to be capitalized.
    // This is what keeps short forms ("am", "is", "so", "re") from matching
    // ordinary prose; real refs read "Ps 23", "Rom 8", "1 Cor 13".
    const firstLetter = m[1]!.match(/[a-zA-Z]/)?.[0]
    if (!firstLetter || firstLetter !== firstLetter.toUpperCase()) continue

    const nameToken = m[1]!.toLowerCase().replace(/\s+/g, '')
    const book = FORM_LOOKUP.get(nameToken)
    if (!book) continue

    const firstChapter = parseInt(m[2]!, 10)
    const body = (m[2]! + (m[3] ?? '')).trim()
    const char_start = m.index
    const char_end = m.index + m[0]!.length

    const spans = parseBody(firstChapter, body)
    for (const rawSpan of spans) {
      const { span, confidence } = clampSpan(book, rawSpan)
      out.push({
        osis_ref: osisFor(book, span),
        book_osis: book.osis,
        book_name: book.name,
        book_order: book.order,
        chapter: span.chapter,
        verse_start: span.verseStart,
        verse_end: span.verseEnd,
        char_start,
        char_end,
        confidence,
      })
    }
  }
  return out
}
