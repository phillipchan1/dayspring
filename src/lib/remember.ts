// Remember — passages the writer already set apart.
//
// This module adds NO new primitive. Significance is already being declared
// through things the product has: markdown emphasis, blockquotes, and the
// `/pray` and `/scripture` slash commands (which write structured rows the
// Altar and the Lamp already read). Remember is a reader over all four.
//
// That means an imported archive is full on day one — the cold-start problem
// that kept the old Well surface flagged off solves itself — and a passage
// survives export as plain markdown, so nothing is held hostage.
//
// The tradeoff, accepted deliberately: emphasis carries no "noticed at". Bold
// in a 2019 entry is dated 2019 whether it was typed then or added last week.
// `entries.updated_at` detects re-reading at entry granularity; we don't build
// more than that for it.

import { parseSpiritualBlocks } from './spiritualBlocks'
import { asEntryMarkdown } from './entryLabels'
import type { Entry } from './types'

/**
 * Where a passage came from. Deliberately NOT here:
 *
 * - `scripture` — the Lamp already ships as "the verses you return to." On the
 *   real archive scripture refs were 284 of 563 passages, so including them
 *   would make Remember half a second Lamp.
 * - anything from the Altar's harvest (`spiritual_items.source = 'scanned'`).
 *   Those 6,257 rows are MODEL-inferred. Showing them as "what you set apart"
 *   would be the app asserting significance it decided on — Principle 1 and 4.
 *   Only writer-declared rows (source IS NULL) count as `pray`.
 */
export type PassageSource = 'mark' | 'quote' | 'emphasis' | 'pray'

export interface Passage {
  entryId: string
  /**
   * ISO. A `mark` carries the moment it was made; every derived source inherits
   * its entry's date, because bold in a 2019 entry is dated 2019 whether it was
   * typed then or added last week.
   */
  date: string
  source: PassageSource
  /** Verbatim. Never paraphrased, never repaired. */
  text: string
}

/**
 * Shortest span worth keeping. A one- or two-word bold is a name or a label,
 * not something you'd want handed back to you years later.
 *
 * Measured, not guessed: 54% of the 1,055 emphasis spans in the real 3,540-entry
 * archive are a single word. See scripts/emphasis-audit.ts.
 */
export const MIN_WORDS = 4

/** Longest span kept whole; beyond this it's a section, not a passage. */
const MAX_CHARS = 400

/**
 * An unpunctuated span this long reads as a thought even though the writer
 * bolded mid-sentence. Below it, we require an ending.
 *
 * Tuned against the archive, not chosen: at 6 the noise "made and designed us
 * to do" survives; at 7 it doesn't, while "I have been measuring the wrong
 * thing" still does. It errs toward dropping good short spans, which is the
 * right direction — Principle 5 prefers showing less to showing filler.
 */
const LONG_ENOUGH_WORDS = 7

// `[^\n]` rather than `[\s\S]`: an unclosed `**` used to run to the next one
// several paragraphs away and swallow everything between. Emphasis is an inline
// construct — it does not cross a line, let alone a blank one.
const STRONG_RE = /(\*\*|__)(\S(?:[^\n]*?\S)?)\1/g
// The leading group captures the preceding character instead of using a
// lookbehind — WKWebView on older iOS doesn't have them, and this file runs on
// device.
const EM_RE = /(^|[^\w*_])([*_])(\S(?:[^*_]*?\S)?)\2(?![\w*_])/g

const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length

/** Blank out a range, preserving length so every later offset stays valid. */
function blank(s: string, from: number, to: number): string {
  return s.slice(0, from) + ' '.repeat(to - from) + s.slice(to)
}

/** Drop inline code spans — backticked text is a value, not emphasis. */
function blankCodeSpans(md: string): string {
  let out = md
  const re = /`[^`\n]+`/g
  let m: RegExpExecArray | null
  while ((m = re.exec(md))) out = blank(out, m.index, m.index + m[0].length)
  return out
}

/** Blank every `/pray`, `/sense`, `/scripture` fence — those are their own sources. */
function blankSpiritualBlocks(md: string): string {
  let out = md
  for (const b of parseSpiritualBlocks(md)) out = blank(out, b.from, b.to)
  return out
}

/**
 * Is this markdown line one we should never read emphasis out of?
 *
 * Headings are already structural, and bold inside a heading is decoration on a
 * label. Task lines and fences are machinery.
 */
function isStructuralLine(line: string): boolean {
  const t = line.trim()
  return t.startsWith('#') || t.startsWith('```') || /^(?:[-*+]\s+)?\[(?:\s|[xX])?\]/.test(t)
}

/** Character ranges of lines we refuse to read emphasis from. */
function structuralRanges(md: string): [number, number][] {
  const out: [number, number][] = []
  let at = 0
  for (const line of md.split('\n')) {
    if (isStructuralLine(line)) out.push([at, at + line.length])
    at += line.length + 1
  }
  return out
}

/**
 * Emphasised spans in a document, in order. Strong wins over em where they
 * overlap, so `**bold**` yields one passage rather than one per delimiter.
 */
export function extractEmphasis(markdown: string): string[] {
  const scrubbed = blankCodeSpans(blankSpiritualBlocks(markdown))
  const skip = structuralRanges(scrubbed)
  const inSkip = (at: number) => skip.some(([a, b]) => at >= a && at < b)

  const taken: [number, number][] = []
  const found: { at: number; text: string }[] = []

  let m: RegExpExecArray | null
  STRONG_RE.lastIndex = 0
  while ((m = STRONG_RE.exec(scrubbed))) {
    if (inSkip(m.index)) continue
    taken.push([m.index, m.index + m[0].length])
    found.push({ at: m.index, text: m[2]! })
  }

  EM_RE.lastIndex = 0
  while ((m = EM_RE.exec(scrubbed))) {
    const at = m.index + m[1]!.length
    if (inSkip(at)) continue
    if (taken.some(([a, b]) => at >= a && at < b)) continue
    found.push({ at, text: m[3]! })
  }

  return found.sort((a, b) => a.at - b.at).map((f) => f.text)
}

/**
 * Blockquotes, one passage per contiguous run. A quote is the strongest signal
 * of the four — in a journal, `>` is what you set apart on purpose, and unlike
 * bold it is never a header.
 */
export function extractQuotes(markdown: string): string[] {
  const scrubbed = blankSpiritualBlocks(markdown)
  const out: string[] = []
  let run: string[] = []

  const flush = () => {
    if (run.length) out.push(run.join(' ').trim())
    run = []
  }

  for (const line of scrubbed.split('\n')) {
    const m = line.match(/^\s{0,3}>\s?(.*)$/)
    if (m) {
      const body = m[1]!.trim()
      if (body) run.push(body)
      else flush()
    } else {
      flush()
    }
  }
  flush()
  return out.filter(Boolean)
}

/** Normalized for dedupe — a line emphasised inside a quote is one passage, not two. */
/**
 * Comparison key for a passage: letters and digits only, lowercased.
 *
 * Exported because anything that wants to ask "is this line one the writer set
 * apart?" — Remember's dedupe, the Pages wall's mark glow — has to normalize the
 * same way. A second copy of this function is a second answer to that question.
 */
export function passageKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const key = passageKey

/**
 * Drop the markup, keep the words. A passage is shown to the writer verbatim,
 * so it has to read as prose — `**like this**` is how it was stored, not how it
 * was meant. Same reasoning as `plain()` in api/ask.ts.
 */
function stripInlineMarks(s: string): string {
  return (
    s
      .replace(/(\*\*|__)(\S(?:[\s\S]*?\S)?)\1/g, '$2')
      .replace(/(^|[^\w*_])([*_])(\S(?:[^*_]*?\S)?)\2(?![\w*_])/g, '$1$3')
      .replace(/`([^`\n]+)`/g, '$1')
      // Real journals contain malformed emphasis — `***three***`, a stray
      // closing `* ` after a space. Those leave orphan delimiters at the edges
      // once the paired passes are done. Trim them rather than show markup.
      .replace(/^[*_\s]+/, '')
      .replace(/[*_\s]+$/, '')
  )
}

const clean = (s: string): string => stripInlineMarks(s).replace(/\s+/g, ' ').trim()

function keepable(text: string): boolean {
  return wordCount(text) >= MIN_WORDS && text.length <= MAX_CHARS
}

/**
 * Is this a finished thought, or a clipped phrase?
 *
 * 62% of surviving emphasis spans in the real archive were fragments — "do what
 * they do", "will not let them go", "how many time intervals". Handed back
 * years later they mean nothing, because the sentence they belonged to is gone.
 *
 * The test is STRUCTURAL on purpose. An earlier version filtered by whether the
 * span sounded like the writer's own voice, which drops "Did your life ever
 * benefit from the five fold ministry?" — their own question — while keeping a
 * bolded psalm. Deciding whose voice a sentence is in is exactly the judgment
 * this product doesn't get to make. Whether it ends is a fact.
 */
function complete(text: string): boolean {
  return /[.!?…]["')\]]?$/.test(text.trim()) || wordCount(text) >= LONG_ENOUGH_WORDS
}

/**
 * Every passage a single entry declares, deduped.
 *
 * Precedence runs strongest-signal-first — quote, then emphasis — so a bolded
 * sentence inside a blockquote is reported once, as a quote.
 */
export function passagesForEntry(entry: Pick<Entry, 'id' | 'created_at' | 'body_markdown'>): Passage[] {
  const md = asEntryMarkdown(entry.body_markdown)
  if (!md) return []

  const seen: string[] = []
  const out: Passage[] = []

  const add = (source: PassageSource, raw: string) => {
    const text = clean(raw)
    if (!keepable(text)) return
    // A `>` is unambiguous — the writer set the whole thing apart deliberately.
    // Bold is not: it's also how people transcribe, label, and shout. So only
    // emphasis has to prove it's a finished thought.
    if (source === 'emphasis' && !complete(text)) return
    const k = key(text)
    if (!k) return
    // Containment, not equality: a bolded clause sits INSIDE the quote that
    // carries it, so exact-match dedupe would report the same sentence twice.
    if (seen.some((s) => s === k || s.includes(k) || k.includes(s))) return
    seen.push(k)
    out.push({ entryId: entry.id, date: entry.created_at, source, text })
  }

  for (const q of extractQuotes(md)) add('quote', q)
  for (const e of extractEmphasis(md)) add('emphasis', e)

  return out
}

/** A `/pray` or `/sense` block the writer inserted, as stored by the editor. */
export interface DeclaredRow {
  entry_id: string
  created_at: string
  text: string
  /**
   * `spiritual_items.source`. NULL means the editor wrote it from a slash
   * command; 'scanned' means the Altar's model harvested it. Only the former
   * belongs here — see the PassageSource note.
   */
  source?: string | null
}

/** A passage the writer marked while re-reading. */
export interface MarkRow {
  entry_id: string
  quote: string
  noticed_at: string
}

/**
 * Every passage across the corpus, newest first.
 *
 * Marks come first in precedence: if someone went back and marked a sentence
 * they'd also bolded years ago, that's one passage, and the mark is the truer
 * record because it carries when they noticed it.
 */
export function collectPassages(
  entries: Pick<Entry, 'id' | 'created_at' | 'body_markdown'>[],
  marks: MarkRow[] = [],
  prayers: DeclaredRow[] = [],
): Passage[] {
  const out: Passage[] = []
  const marked = new Set<string>()

  for (const m of marks) {
    const text = clean(m.quote)
    if (!text) continue
    marked.add(key(text))
    out.push({ entryId: m.entry_id, date: m.noticed_at, source: 'mark', text })
  }

  // A marked sentence that is also bold shows once, as a mark.
  for (const e of entries) {
    for (const p of passagesForEntry(e)) {
      const k = key(p.text)
      if (marked.has(k) || [...marked].some((m) => m.includes(k) || k.includes(m))) continue
      out.push(p)
    }
  }

  for (const r of prayers) {
    if (r.source != null) continue // harvested, not declared — never shown here
    const text = clean(r.text)
    if (!text || !keepable(text)) continue
    out.push({ entryId: r.entry_id, date: r.created_at, source: 'pray', text })
  }

  return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}
