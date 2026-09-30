// Crossway's HTML passage format → numbered verses that remember their shape.
//
// The text endpoint flattens a chapter to indented plain text, and the one
// thing it cannot say is where a poem ends: the prose after a psalm quotation
// keeps the poem's indent (Jeremiah 2:4, Matthew 6:14). The HTML endpoint says
// it outright — `p.block-indent` is poetry, `span.line` / `span.indent` /
// `span.declares` are its lines, `begin-line-group` starts a stanza, and the
// psalm titles, acrostic letters and Song of Songs speakers arrive as `h4`s.
//
// Every verse keeps its words as one flat string — the thing that is caught,
// searched and written into a fence — and `parts` says how those words are
// set: where a line, a stanza or a paragraph begins. The parts' texts joined
// by single spaces are exactly `text`.
//
// Crossway's markup does not nest cleanly (words-of-Christ spans run across
// line breaks), so this reads it as a stream of tags and text, never a tree.
// Pure — see esvHtml.test.ts.

export type PartBreak = 'flow' | 'line' | 'stanza' | 'para'

export interface VersePart {
  text: string
  /**
   * What comes before these words: `flow` carries on in the same line or
   * paragraph, `line` starts a poetry line, `stanza` a poetry line after a
   * break, `para` a prose paragraph.
   */
  at: PartBreak
  /** Poetry only: 1 a line, 2 its indented half, 3 an aside set far in ("declares the LORD"). */
  indent?: number
  /** A prose paragraph that picks up again after a poem — no first-line indent. */
  resume?: boolean
  /** The part's last word is "Selah". */
  selah?: boolean
  /** Crossway's own label set above these words. */
  head?: { kind: 'title' | 'acrostic' | 'speaker'; text: string }
}

export interface ShapedVerse {
  n: number
  text: string
  parts: VersePart[]
}

const HEAD_KINDS: Record<string, 'title' | 'acrostic' | 'speaker'> = {
  'psalm-title': 'title',
  'psalm-acrostic-title': 'acrostic',
  speaker: 'speaker',
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function classOf(tag: string): string[] {
  const m = /\bclass="([^"]*)"/.exec(tag)
  return m ? m[1]!.split(/\s+/).filter(Boolean) : []
}

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Parse one chapter of Crossway HTML. Anything before the first verse number is dropped. */
export function parseChapterHtml(html: string): ShapedVerse[] {
  const verses: ShapedVerse[] = []
  let verse: ShapedVerse | null = null
  let part: VersePart | null = null

  // What the next words start with, and what they carry.
  let pending: PartBreak = 'para'
  let indent = 0
  let resume = false
  let head: VersePart['head'] | undefined
  let poetry = false

  // Where the stream is: inside a verse number, a label, a Selah.
  let inNumber = false
  let numberText = ''
  let inHead: 'title' | 'acrostic' | 'speaker' | null = null
  let headText = ''
  let inSelah = false

  const breakTo = (at: PartBreak) => {
    // A stanza or paragraph already pending is not weakened by a line.
    if (at === 'line' && (pending === 'stanza' || pending === 'para')) return
    pending = at
  }

  const words = (raw: string, selah: boolean) => {
    if (!verse) return
    const text = tidy(raw)
    if (!text) return
    if (part && pending === 'flow') {
      part.text = part.text ? `${part.text} ${text}` : text
      if (selah) part.selah = true
      return
    }
    part = { text, at: pending }
    if (poetry && pending !== 'para' && pending !== 'flow') part.indent = indent || 1
    if (resume && pending === 'para') part.resume = true
    if (selah) part.selah = true
    if (head) part.head = head
    verse.parts.push(part)
    pending = 'flow'
    resume = false
    head = undefined
  }

  for (const [token] of html.matchAll(/<[^>]*>|[^<]+/g)) {
    if (token[0] !== '<') {
      const text = decode(token)
      if (inNumber) numberText += text
      else if (inHead) headText += text
      else words(text, inSelah)
      continue
    }

    const close = token.startsWith('</')
    const name = /^<\/?\s*([a-z0-9]+)/i.exec(token)?.[1]?.toLowerCase() ?? ''
    const cls = close ? [] : classOf(token)

    if (name === 'b') {
      if (!close && cls.includes('verse-num')) {
        inNumber = true
        numberText = ''
      } else if (close && inNumber) {
        inNumber = false
        const n = Number.parseInt(numberText, 10)
        if (Number.isFinite(n) && n > 0) {
          verse = { n, text: '', parts: [] }
          verses.push(verse)
          part = null
        }
      }
      continue
    }

    if (name === 'h4' || name === 'h3') {
      if (!close) {
        inHead = cls.map((c) => HEAD_KINDS[c]).find(Boolean) ?? null
        headText = ''
      } else if (inHead) {
        const text = tidy(headText)
        if (text) head = { kind: inHead, text }
        inHead = null
        // A label always stands above a fresh line.
        breakTo(poetry ? 'stanza' : 'para')
      }
      continue
    }

    if (name === 'p') {
      if (!close) {
        poetry = cls.includes('block-indent')
        if (poetry) breakTo('stanza')
        else {
          pending = 'para'
          resume = cls.includes('same-paragraph') || cls.includes('virtual')
        }
      }
      inSelah = false
      continue
    }

    if (name === 'br') {
      if (poetry) breakTo('line')
      inSelah = false
      continue
    }

    if (name === 'span') {
      if (close) {
        inSelah = false
        continue
      }
      if (cls.includes('begin-line-group')) {
        breakTo('stanza')
        continue
      }
      if (cls.includes('selah')) {
        inSelah = true
        continue
      }
      if (cls.includes('line')) {
        indent = cls.includes('declares') ? 3 : cls.some((c) => c.startsWith('indent')) ? 2 : 1
        breakTo('line')
      }
    }
  }

  for (const v of verses) {
    v.parts = v.parts.filter((p) => p.text)
    v.text = v.parts.map((p) => p.text).join(' ')
  }
  return verses.filter((v) => v.text)
}
