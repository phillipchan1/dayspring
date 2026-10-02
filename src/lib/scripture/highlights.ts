// The verses a writer drew out of a passage, read back as scripture references.
//
// A scripture ritual page holds the passage once, as an ordinary scripture
// fence ("John 15 · ESV"), and the phrases the writer highlighted in it as
// quote lines carrying their verse: `> Remain in me, and I in you (v. 4)`. The
// fence lights the CHAPTER on the Scripture map — where they have been. These
// quotes light the VERSES — what caught them. Neither is stored anywhere else:
// the quote line has no book name, so the prose parser can't see it, and
// without this a highlight on John 15:4–5 left no trace at all.
//
// Structure, not voice (the rule writerWords.ts already follows): a quote is
// only placed when it sits inside a scripture ritual, and its book and chapter
// come from that ritual's own passage. Outside one, a `(v. 4)` has no book to
// hang on and is ignored — it is never guessed.
//
// PURE and dependency-light on purpose: the editor's reconcile (capture.ts)
// and the server's gather engine (api/_lib/derive.ts) both reach it through
// refRows.ts, so a page imported from a backup is read exactly as one typed.

import { parseSpiritualBlocks } from '../spiritualBlocks.js'
import { SCRIPTURE_RITUALS } from '../writerWords.js'
import { parseReferences, verseRef, type ParsedRef } from './parse.js'

/** `(v. 4)`, `(vv. 4–5)` at the end of a quote line. Captures the two numbers. */
export const VERSE_TAIL = /\s*\(\s*vv?\.?\s*(\d+)(?:\s*[-–]\s*(\d+))?\s*\)\s*$/

const RITUAL_NAME = /^\s*<!--\s*(?:ritual|practice):name:(.+?)\s*-->\s*$/
const RITUAL_END = /^\s*<!--\s*(?:ritual|practice):end\s*-->\s*$/
const QUOTE = /^(\s*>\s?)(.*)$/
const FENCE_EDGE = /^\s*```/
/** A passage's reference line ends in its translation: "John 15 · ESV". */
const TRANSLATION_TAIL = /\s*·\s*[A-Za-z]{2,5}\s*$/

/** The reference a scripture fence names, or null when it names none. */
function fenceReference(block: { content: string; reference?: string | null }): string | null {
  // A fence with only a reference parses as content = the reference line (a
  // passage read from the writer's own Bible); one with verse text puts the
  // reference on its own last line.
  const line = (block.reference ?? block.content).trim()
  if (!line || line.includes('\n')) return null
  return line.replace(TRANSLATION_TAIL, '').trim()
}

/**
 * What every scripture fence's own reference line names — read STRICTLY.
 *
 * The prose parser refuses a bare chapter for any book whose name is also a
 * word ("Mark 4", "Acts 2", "Job 38", "Revelation 21") so that "Met Mark 5
 * minutes late" stays off the map. A fence's reference line is not prose: we
 * wrote it, it is known to be a reference, and reading it with the prose
 * parser silently left a whole-chapter ritual on Mark with no mark on Lamp.
 */
export function fenceReferences(markdown: string): ParsedRef[] {
  const out: ParsedRef[] = []
  for (const b of parseSpiritualBlocks(markdown)) {
    if (b.type !== 'scripture') continue
    const ref = fenceReference(b)
    if (!ref) continue
    // Offsets stay relative to the whole page, like every other ref, so an
    // excerpt can be cut around the right place.
    const at = markdown.lastIndexOf(ref, b.to)
    const base = at >= b.from ? at : b.from
    for (const r of parseReferences(ref, { trusted: true })) {
      out.push({ ...r, char_start: base + r.char_start, char_end: base + r.char_end })
    }
  }
  return out
}

/** The ritual spans of a page whose name is a scripture ritual: [from, to). */
function scriptureRitualSpans(markdown: string): { from: number; to: number }[] {
  const spans: { from: number; to: number }[] = []
  let open: number | null = null
  let offset = 0
  for (const line of markdown.split('\n')) {
    const name = line.match(RITUAL_NAME)
    if (name) {
      // A new ritual closes any ritual left open.
      if (open !== null) spans.push({ from: open, to: offset })
      open = SCRIPTURE_RITUALS.includes(name[1]!.trim()) ? offset : null
    } else if (RITUAL_END.test(line) && open !== null) {
      spans.push({ from: open, to: offset })
      open = null
    }
    offset += line.length + 1
  }
  if (open !== null) spans.push({ from: open, to: markdown.length })
  return spans
}

/**
 * The verses highlighted in a page's scripture rituals, as references.
 *
 * "One ritual, one passage": the passage is the first scripture fence inside
 * the ritual. A fence added later (a `/scripture` cross-reference in an answer)
 * counts in its own right through its own reference line, and is never the
 * book a highlight belongs to.
 *
 * A quote with no verse number — Lectio's older caught word is a bare
 * `> phrase` — cannot be placed, and is skipped rather than guessed; the
 * passage fence has already lit its chapter.
 */
export function highlightRefs(markdown: string): ParsedRef[] {
  const spans = scriptureRitualSpans(markdown)
  if (spans.length === 0) return []

  const blocks = parseSpiritualBlocks(markdown).filter((b) => b.type === 'scripture')
  const out: ParsedRef[] = []

  for (const span of spans) {
    const passage = blocks.find((b) => b.from >= span.from && b.from < span.to)
    const reference = passage ? fenceReference(passage) : null
    if (!passage || !reference) continue
    const where = parseReferences(reference, { trusted: true })[0]
    // A passage that crosses a chapter has no single chapter its verse numbers
    // belong to. The finder never writes one; a hand-edited fence might.
    if (!where || (where.verse_end == null && where.osis_ref.includes('-'))) continue

    let offset = span.from
    let inFence = false
    for (const line of markdown.slice(span.from, span.to).split('\n')) {
      const lineStart = offset
      offset += line.length + 1
      if (FENCE_EDGE.test(line)) {
        inFence = !inFence
        continue
      }
      if (inFence) continue
      const q = line.match(QUOTE)
      if (!q) continue
      const tail = q[2]!.match(VERSE_TAIL)
      if (!tail) continue
      // An empty quote ("> (v. 4)") highlights nothing.
      if (!q[2]!.replace(VERSE_TAIL, '').trim()) continue
      const v = Number(tail[1])
      const vEnd = tail[2] ? Number(tail[2]) : null
      const ref = verseRef(
        where.book_osis,
        where.chapter,
        v,
        vEnd,
        lineStart + q[1]!.length,
        lineStart + line.length,
      )
      if (ref) out.push(ref)
    }
  }
  return out
}
