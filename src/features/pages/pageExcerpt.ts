// What a page shows at a glance.
//
// The wall's whole claim is that you are looking at your own writing, not at a
// description of it. So every line here is verbatim prose lifted out of the
// entry — scaffolding removed, nothing summarized, nothing generated. If this
// module ever starts producing a sentence the writer didn't type, the surface
// has stopped being a read surface (Principle 4).

import { entryContentLines } from '@/lib/entryLabels'
import { stripMarkdownMarkers } from '@/lib/inlineMarkers'
import { passageKey, passagesForEntry } from '@/lib/remember'
import type { Entry } from '@/lib/types'

/** A line of the writer's prose, and whether they set it apart. */
export interface ExcerptLine {
  text: string
  /** Marked, quoted, or emphasised by the writer. Never inferred. */
  set: boolean
}

export interface PageExcerpt {
  lines: ExcerptLine[]
  /** Prose characters in the WHOLE entry — drives how full the page reads. */
  chars: number
  /** The excerpt stops short of the end, so the page fades out. */
  truncated: boolean
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
 * @param maxLines  How many lines this density step can show. The entry's real
 *                  length is still reported in `chars`, so a page that shows
 *                  three lines of a long entry still reads as full.
 */
export function pageExcerpt(
  entry: ExcerptEntry,
  markQuotes: string[] = [],
  maxLines = 12,
): PageExcerpt {
  const raw = entryContentLines(entry.body_markdown)
  const prose: string[] = []
  for (const line of raw) {
    const text = display(line)
    if (text) prose.push(text)
  }

  const chars = prose.reduce((n, l) => n + l.length, 0)
  const keys = setApartKeys(entry, markQuotes)

  const lines: ExcerptLine[] = prose.slice(0, maxLines).map((text) => ({
    text,
    set: isSetApart(passageKey(text), keys),
  }))

  return { lines, chars, truncated: prose.length > maxLines }
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
