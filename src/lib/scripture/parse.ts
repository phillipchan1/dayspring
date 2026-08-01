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

// The name part of a numbered book, with its leading digit stripped: "cor" from
// "1 cor", "john" from "2 john". Used to spot the start of the NEXT reference in
// a list like "Ps 62:5, 2 Cor 5:17" so the "2" isn't eaten as a verse of Psalm
// 62 — which used to invent Ps.62.2 and lose 2 Corinthians entirely. Single-char
// tails ("1s" for 1 Samuel) are dropped: too short to be evidence of anything.
const NUMBERED_TAILS = [
  ...new Set(
    NAME_FORMS
      // Skip ordinal forms: "1st corinthians" would otherwise yield the tail
      // "st corinthians", which is nobody's book name.
      .filter((f) => !/^\d+(?:st|nd|rd|th)\b/.test(f.source))
      .map((f) => /^\d+\s*(.+)$/.exec(f.source)?.[1])
      .filter((t): t is string => !!t && t.length >= 2),
  ),
].sort((a, b) => b.length - a.length)

const TAIL_ALT = NUMBERED_TAILS.map((t) => escapeRegex(t).replace(/\\?\s+/g, '\\s*')).join('|')

// "…, 2 Cor" / "…and 1 John" — the digit belongs to the next book, not this ref.
const NOT_NEXT_BOOK = String.raw`(?!\s*(?:${TAIL_ALT})\b)`

// A chapter:verse separator. A colon may be spaced ("John 3 : 16"); a period may
// NOT ("John 3.16" is a reference, "John 3. 16 people came" is a sentence end
// followed by a headcount, and treating those alike fabricated John 3:16).
const SEP_V = String.raw`(?:\s*:\s*|\.)`

// ── admission ────────────────────────────────────────────────────────────────
// A book name plus a number is not enough to be a reference. "Met Mark 5 minutes
// late" and "read john 3 today" have the same shape and only one is scripture.
//
// This used to be settled by one blunt rule — the matched name had to be
// capitalized — which cost every lowercase journal its entire scripture history
// while still admitting "Met Mark 5". The rule below splits the two questions it
// was conflating: is this FORM ambiguous, and is there enough signal around it?

/**
 * Canon forms that are also ordinary English words. For these, a bare
 * "<form> <number>" is genuinely ambiguous, and the honest default is silence —
 * a verse, an explicit "chapter", or a reading verb nearby is what turns one
 * into a reference.
 *
 * Proper names (john, luke, hosea, esther…) are deliberately NOT here: a person
 * is written "John", and the lowercase "john 3" that a journal actually contains
 * is unambiguous. Capitalized "John 3" stays admitted because refusing it would
 * cost far more than the rare "Met John 3 times".
 */
const AMBIGUOUS_FORMS = new Set([
  'is', 'am', 're', 'so', 'no', 'la', 'na', 'ho', 'pm', 'pp', 'mr',
  'act', 'acts', 'job', 'mark', 'song', 'num', 'numbers', 'kings', 'judges',
  'proverbs', 'revelation', 'revelations',
])

/**
 * Should this match become a reference? `form` is the canon abbr (lowercased),
 * `raw` the text as the writer typed it.
 */
function admits(
  raw: string,
  form: string,
  signal: { hasVerse: boolean; hasChapterKeyword: boolean },
): boolean {
  const firstLetter = /[a-zA-Z]/.exec(raw)?.[0]
  if (!firstLetter) return false

  if (AMBIGUOUS_FORMS.has(form)) {
    // An ordinary English word becomes a book only when there is a verse or an
    // explicit "chapter". Nothing softer holds:
    //   - case is no help — "Is 2 weeks enough?" capitalizes for the sentence
    //   - a nearby reading verb is not enough either. That was tried, and it
    //     admitted "reading Mark 5 emails", "the job 2 applications" and "Read
    //     the chapter on Mark 5 times" — fabricated references, which is the
    //     exact failure this rule exists to prevent.
    //
    // The price is real and is measured, not waved away: "Taught on Acts 2"
    // now yields nothing (corpus scr-boundary-02, defect
    // 'ambiguous-word-needs-verse'). Recall on a handful of famous chapters,
    // traded for never inventing a reading. Grounded, or silent.
    return signal.hasVerse || signal.hasChapterKeyword
  }

  // A leading number is strong evidence on its own ("1 cor 13" is nobody's
  // ordinary prose), so numbered books skip the length rule.
  if (/\d/.test(form)) return true

  // Short abbreviations carry too little signal to admit in lowercase: "ps",
  // "gen", "rom" read as scripture only when written as scripture. This is the
  // old guard, kept exactly where it earns its keep.
  if (form.length < 4) return firstLetter === firstLetter.toUpperCase()

  // A full or near-full book name, in any case. "read john 3 today" lands.
  return true
}

// Book name, then a chapter, then an optional ref body of digits/separators.
// A trailing "." after the name (e.g. "Gen.") and an optional "ch"/"chapter"
// keyword are both tolerated. The body is parsed structurally below.
const REF_RE = new RegExp(
  String.raw`\b(${NAME_ALT})\.?\s*(ch(?:apter|apters|aps?)?\.?\s*)?` +
    String.raw`(\d{1,3})` +
    String.raw`((?:${SEP_V}\d{1,3}` +
    String.raw`|\s*[-–—]\s*\d{1,3}(?:${SEP_V}\d{1,3})?` +
    String.raw`|\s*,\s*\d{1,3}${NOT_NEXT_BOOK}` +
    String.raw`|\s*(?:and|&)\s+\d{1,3}${NOT_NEXT_BOOK}` +
    String.raw`|\s*v(?:erses?|v|s)?\.?\s*\d{1,3})*)`,
  'gi',
)

interface Span {
  /** A contiguous range that becomes one ParsedRef. */
  chapter: number
  verseStart: number | null
  verseEnd: number | null
  /**
   * Set only when the span crosses a chapter boundary ("Romans 8:28-9:2").
   * Absent for the ordinary same-chapter case, which is nearly all of them.
   */
  endChapter?: number
}

/** Parse the body (everything after the first chapter number) into spans. */
function parseBody(firstChapter: number, body: string): Span[] {
  const spans: Span[] = []
  let chapter = firstChapter
  let verseStart: number | null = null
  let verseEnd: number | null = null
  let endChapter: number | null = null
  let sawVerse = false

  // Tokenize into separators + numbers in document order.
  const tokens = body.match(/[:.]|[-–—]|,|&|and|v(?:erses?|v|s)?\.?|\d{1,3}/gi) ?? []
  let pendingSep: string | null = null

  const flush = () => {
    spans.push({
      chapter,
      verseStart,
      verseEnd,
      ...(endChapter != null ? { endChapter } : {}),
    })
    verseStart = null
    verseEnd = null
    endChapter = null
  }

  for (const raw of tokens) {
    const tok = raw.toLowerCase()
    if (/^\d/.test(tok)) {
      const n = parseInt(tok, 10)
      if (pendingSep === ':' || pendingSep === '.') {
        if (sawVerse && verseEnd != null) {
          // "8:28-9:2" — what we took for a range END was really a CHAPTER, and
          // this number is its verse. Before, the verse overwrote verseStart and
          // the ref resolved to Rom.8.2 at full confidence: a verse the writer
          // never read, indistinguishable downstream from a correct parse.
          endChapter = verseEnd
          verseEnd = n
        } else {
          // chapter:verse
          verseStart = n
          verseEnd = null
          sawVerse = true
        }
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

  let endChapter = span.endChapter
  if (endChapter != null) {
    if (endChapter > book.chapters) {
      endChapter = book.chapters
      confidence = Math.min(confidence, 0.5)
    }
    // An end chapter at or before the start isn't a cross-chapter span at all;
    // fall back to the same-chapter reading and let the garbled check below
    // decide what to do with it.
    if (endChapter <= chapter) endChapter = undefined
  }

  if (endChapter == null && verseEnd != null && verseStart != null && verseEnd < verseStart) {
    // garbled range — keep the start, drop the end
    verseEnd = null
    confidence = Math.min(confidence, 0.6)
  }
  return {
    span: { chapter, verseStart, verseEnd, ...(endChapter != null ? { endChapter } : {}) },
    confidence,
  }
}

function osisFor(book: BibleBook, span: Span): string {
  if (span.verseStart == null) return `${book.osis}.${span.chapter}`
  const start = `${book.osis}.${span.chapter}.${span.verseStart}`
  if (span.verseEnd == null) return start
  // endChapter is set only for a cross-chapter span ("Romans 8:28-9:2").
  return `${start}-${book.osis}.${span.endChapter ?? span.chapter}.${span.verseEnd}`
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
    const rawName = m[1]!
    const nameToken = rawName.toLowerCase().replace(/\s+/g, '')
    const book = FORM_LOOKUP.get(nameToken)
    if (!book) continue

    const firstChapter = parseInt(m[3]!, 10)
    const body = (m[3]! + (m[4] ?? '')).trim()
    const char_start = m.index
    const char_end = m.index + m[0]!.length

    const spans = parseBody(firstChapter, body)

    // Admission runs on the parsed spans, because "is there a verse" is the
    // strongest single signal that an ambiguous word is a book. See admits().
    const canonical = rawName.toLowerCase().replace(/\s+/g, ' ').trim()
    if (
      !admits(rawName, canonical, {
        hasVerse: spans.some((s) => s.verseStart != null),
        hasChapterKeyword: m[2] != null,
      })
    ) {
      continue
    }

    for (const rawSpan of spans) {
      const { span, confidence } = clampSpan(book, rawSpan)
      out.push({
        osis_ref: osisFor(book, span),
        book_osis: book.osis,
        book_name: book.name,
        book_order: book.order,
        chapter: span.chapter,
        verse_start: span.verseStart,
        // A cross-chapter span ("Romans 8:28-9:2") can't be expressed in these
        // flat columns — verse_end would read as a verse of `chapter`, and
        // InlineScripturePopover would render "Romans 8:28-2". osis_ref carries
        // the full span and is what the map, dedupe and formatOsisRef all use,
        // so leave verse_end null rather than say something untrue. Restoring it
        // needs an end_chapter column on scripture_refs; deliberately deferred.
        verse_end: span.endChapter != null ? null : span.verseEnd,
        char_start,
        char_end,
        confidence,
      })
    }
  }
  return out
}
