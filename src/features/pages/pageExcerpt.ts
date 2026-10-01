// What a page shows at a glance.
//
// The wall's whole claim is that you are looking at your own writing, not at a
// description of it. So every line here is verbatim prose lifted out of the
// entry — scaffolding removed, nothing summarized, nothing generated. If this
// module ever starts producing a sentence the writer didn't type, the surface
// has stopped being a read surface (Principle 4).

import { entryContentLines } from '@/lib/entryLabels'
import { parseSpiritualBlocks } from '@/lib/spiritualBlocks'
import { isScriptureQuoteLine, SCRIPTURE_RITUALS, writerWords } from '@/lib/writerWords'
import { stripMarkdownMarkers } from '@/lib/inlineMarkers'
import { ATTACHMENT_REF_RE } from '@/lib/attachments'
import { ritualNamesIn } from '@/lib/ritualDisplay'
import { ritualEntryShape } from '@/editor/practices/ritualDocument'
import { EXCERPT_MAX_LINES } from './zoom'
import { passageKey, passagesForEntry } from '@/lib/remember'
import type { Entry } from '@/lib/types'

/** A line of the writer's prose, and whether they set it apart. */
export interface ExcerptLine {
  text: string
  /** Marked, quoted, or emphasised by the writer. Never inferred. */
  set: boolean
  /** Carries a lit subject — this is why the page lit up. */
  hit?: boolean
  /**
   * On a ritual page, the movement this line OPENS the answer to.
   *
   * The writer's own structure, not a summary — the practice's label, run in
   * ahead of the first line of each answer so a card of an Examen reads as an
   * Examen, not as four unmarked sentences. Only the first line of an answer
   * carries it.
   */
  label?: string
  /**
   * A phrase drawn from a scripture ritual's passage: the verse it came from,
   * "v. 4". The line is Scripture, not the writer's — shown as a quote with
   * its verse, and never as a line she set apart (Guardrail H3).
   */
  verse?: string
}

export interface PageExcerpt {
  /** A scripture ritual's passage, by reference — "John 15:4–5". */
  passage?: string
  /** At most `EXCERPT_MAX_LINES`. The card slices this to what it can show. */
  lines: ExcerptLine[]
  /** Prose characters in the WHOLE entry — drives how full the page reads. */
  chars: number
  /** Prose lines in the whole entry, so a card can tell whether it stopped short. */
  total: number
  /**
   * Rituals begun on this page, in document order.
   *
   * Not a summary — the writer chose the practice. Without this a card of an
   * Examen is four unmarked sentences, and you have to open it to see what
   * it was.
   */
  rituals: string[]
}

type ExcerptEntry = Pick<Entry, 'id' | 'created_at' | 'body_markdown'>

/**
 * Markers unwrapped rather than deleted.
 *
 * `**like this**` is how it was stored, not how it was meant. Emphasis still
 * shows on the page, but as a glow on the line, not as visible asterisks.
 *
 * This used to strip with its own local regexes, which predated `==highlight==`
 * and `++underline++` becoming real marks — a highlighted sentence rendered on a
 * card as literal `==like this==`. `stripMarkdownMarkers` is the pair-aware
 * version the rest of the app already shares, so a page card, a title, and a
 * search snippet now unwrap identically, and `C++` survives all three.
 */
const display = (line: string): string =>
  stripMarkdownMarkers(line).replace(/\s+/g, ' ').trim()

/**
 * Every key the writer set apart on this entry.
 *
 * Blockquotes and emphasis come from the body; marks come from their own table.
 * Declared `/pray` blocks are deliberately absent — `entryContentLines` strips
 * spiritual fences before we ever see them, so there is no line here to glow.
 */
function setApartKeys(entry: ExcerptEntry, markQuotes: string[]): string[] {
  const keys: string[] = []
  for (const p of passagesForEntry(entry)) {
    const k = passageKey(p.text)
    if (k) keys.push(k)
  }
  for (const q of markQuotes) {
    const k = passageKey(q)
    if (k) keys.push(k)
  }
  return keys
}

/**
 * Containment, not equality — a bolded clause sits INSIDE the line carrying it,
 * and a mark can span a sentence the line only partly covers. Same rule
 * `collectPassages` uses to dedupe.
 *
 * The length floor matters: passages are already filtered to MIN_WORDS upstream,
 * but a short key ("i was tired") would otherwise light up every line that
 * happens to contain it.
 */
function isSetApart(lineKey: string, keys: string[]): boolean {
  if (lineKey.length < 12) return false
  return keys.some((k) => k.length >= 12 && (k === lineKey || k.includes(lineKey) || lineKey.includes(k)))
}

/**
 * Build a page's excerpt.
 *
 * Built once at the largest budget any card can want, NOT at the current zoom
 * level. The zoom is continuous, so a budget-keyed cache would rebuild every
 * excerpt on every frame of a pinch; the card slices instead. The entry's real
 * length is still reported in `chars`, so a page showing three lines of a long
 * entry still reads as full.
 */
export function pageExcerpt(
  entry: ExcerptEntry,
  markQuotes: string[] = [],
  maxLines = EXCERPT_MAX_LINES,
  /**
   * The lit subjects, if any.
   *
   * When a page lights up, the lines it shows should be the lines that MADE it
   * light up — otherwise you are told a page is about Chicago and handed its
   * opening sentence about the weather, and have to open it to find out why.
   * Passed as a matcher rather than terms so the wall builds it once.
   */
  match: RegExp | null = null,
): PageExcerpt {
  const rituals = ritualNamesIn(entry.body_markdown)
  const prose: string[] = []
  /** Label per prose index — only on a ritual page, only on an answer's first line. */
  const labels = new Map<number, string>()
  /** Verse per prose index — only on a drawn quote (a scripture ritual's `>` line). */
  const verses = new Map<number, string>()
  /** A scripture ritual's passage, by reference. */
  let passage: string | null = null
  const shape = ritualEntryShape(entry.body_markdown)
  if (shape.kind === 'ritual') {
    // The answers in order, each opened by its movement's name, then the
    // After as ordinary prose. An unanswered movement says nothing: a card
    // never shows how much of a ritual was walked (Principle 2).
    const { labels: names, texts } = shape.contents
    // In a scripture ritual every `>` line is a verse quoted from its passage —
    // the Bible's words, not hers (Guardrail H3; see writerWords). Passed over,
    // so the card opens on the first line she wrote, never on the verse.
    const scripture = SCRIPTURE_RITUALS.includes(shape.contents.name)
    texts.forEach((answer, i) => {
      if (scripture && passage === null) {
        // The passage itself names the page; its words are not shown here.
        const fence = parseSpiritualBlocks(answer).find((b) => b.type === 'scripture')
        if (fence?.reference) passage = fence.reference.replace(/\s*·\s*[A-Za-z]{2,5}\s*$/, '').trim()
      }
      let first = true
      for (const line of entryContentLines(answer)) {
        if (isScriptureQuoteLine(line, scripture)) {
          // Shown as what it is: the words, and the verse they came from.
          const q = line.replace(/^\s*>\s?/, '').trim()
          const tail = q.match(/\s*\(\s*(vv?)\.?\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*\)\s*$/)
          const text = display(tail ? q.slice(0, tail.index) : q)
          if (!text) continue
          if (first) labels.set(prose.length, names[i] ?? '')
          first = false
          verses.set(prose.length, tail ? (tail[3] ? `vv. ${tail[2]}–${tail[3]}` : `v. ${tail[2]}`) : '')
          prose.push(text)
          continue
        }
        const text = display(line)
        if (!text) continue
        if (first) labels.set(prose.length, names[i] ?? '')
        first = false
        prose.push(text)
      }
    })
    for (const line of entryContentLines(shape.after)) {
      const text = display(line)
      if (text) prose.push(text)
    }
  } else {
    // writerWords: a ritual inside prose still quotes its verses (Guardrail H3).
    for (const line of entryContentLines(writerWords(entry.body_markdown))) {
      const text = display(line)
      if (text) prose.push(text)
    }
  }

  // The wall stays text-only, but a page containing a photo is not blank.
  // Prefer the writer's own caption; otherwise name the object without
  // inventing a description of it.
  if (prose.length === 0) {
    ATTACHMENT_REF_RE.lastIndex = 0
    const photo = ATTACHMENT_REF_RE.exec(entry.body_markdown ?? '')
    ATTACHMENT_REF_RE.lastIndex = 0
    if (photo) prose.push(photo[1]?.trim() || 'Photo')
  }

  const chars = prose.reduce((n, l) => n + l.length, 0)
  const keys = setApartKeys(entry, markQuotes)

  // Matching lines first, in their original order, then the rest. Stable on
  // both halves, so a page's excerpt never shuffles as you scroll past it.
  let ordered = prose.map((text, i) => ({ text, label: labels.get(i), verse: verses.get(i) }))
  if (match) {
    const hits: typeof ordered = []
    const rest: typeof ordered = []
    for (const p of ordered) {
      match.lastIndex = 0
      ;(match.test(p.text) ? hits : rest).push(p)
    }
    if (hits.length > 0) ordered = [...hits, ...rest]
  }

  const lines: ExcerptLine[] = ordered.slice(0, maxLines).map(({ text, label, verse }) => {
    if (match) match.lastIndex = 0
    const hit = match ? match.test(text) : false
    // A drawn quote is never "set apart" as hers: it is marked as Scripture instead.
    const line: ExcerptLine = { text, set: verse === undefined && isSetApart(passageKey(text), keys) }
    if (label) line.label = label
    if (verse !== undefined) line.verse = verse
    return hit ? { ...line, hit: true } : line
  })

  return { lines, chars, total: prose.length, rituals, ...(passage ? { passage } : {}) }
}

/**
 * Split a line into plain and matched runs, for painting the words themselves.
 *
 * Returns a flat alternating list rather than objects: the card renders it
 * directly, and a matched run is simply every odd index.
 */
export function splitOnMatch(text: string, match: RegExp | null): string[] {
  if (!match) return [text]
  match.lastIndex = 0
  const out: string[] = []
  let at = 0
  let m: RegExpExecArray | null
  while ((m = match.exec(text))) {
    out.push(text.slice(at, m.index), m[0])
    at = m.index + m[0].length
    if (m[0].length === 0) match.lastIndex++ // never spin on a zero-width match
  }
  out.push(text.slice(at))
  return out
}

/**
 * How full the page looks, 0–1.
 *
 * Length as shape: a three-line day and a six-page day have to differ before
 * you read a word, the way they do in a notebook. Deliberately a curve, not a
 * ratio — the difference between 40 and 400 characters is worth seeing, the
 * difference between 4,000 and 8,000 is not, and a linear scale would make
 * every long entry look identical.
 *
 * This is never rendered as a number. A printed word count next to a date is a
 * scoreboard; the shape of the page is just what the page looks like.
 */
export function pageFill(chars: number): number {
  if (chars <= 0) return 0
  return Math.min(1, Math.log10(1 + chars / 40) / Math.log10(1 + 3000 / 40))
}
