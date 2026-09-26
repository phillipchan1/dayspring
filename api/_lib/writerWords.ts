/**
 * SERVER COPY of `src/lib/writerWords.ts` — api/ never imports from src/, so the
 * one function that keeps a verse from coming back as "the writer's own words"
 * lives twice. `src/lib/writerWords.test.ts` runs both against the same
 * fixtures; change them together.
 *
 * See the app copy for the full reasoning (Guardrail H3).
 */
/** Scripture rituals: every `>` line inside one is a quote from its passage. */
export const SCRIPTURE_RITUALS: readonly string[] = [
  'Lectio Divina',
  'SOAP',
  'Discovery Bible Study',
  'Open Reading',
]

const TOKEN = /^\s*<!--\s*(?:ritual|practice):[^>]*-->\s*$/
const RITUAL_NAME = /^\s*<!--\s*(?:ritual|practice):name:(.+?)\s*-->\s*$/
const RITUAL_END = /^\s*<!--\s*(?:ritual|practice):end\s*-->\s*$/
const FENCE_OPEN = /^\s*```\s*dayspring-scripture\b/
const FENCE_CLOSE = /^\s*```\s*$/
const QUOTE = /^\s*>/
/** A quote that carries its verse: `(v. 4)`, `(vv. 4–5)`, `(v 4)`. */
const VERSE_TAIL = /\(\s*vv?\.?\s*\d+(?:\s*[-–]\s*\d+)?\s*\)\s*$/

const INLINE_VERSE = /“[^”]*”\s*\(\s*vv?\.?\s*\d+(?:\s*[-–]\s*\d+)?\s*\)/g

/** Whether a `>` line is a verse quoted into an answer (see the header). */
export function isScriptureQuoteLine(line: string, inScriptureRitual: boolean): boolean {
  if (!QUOTE.test(line)) return false
  return inScriptureRitual || VERSE_TAIL.test(line)
}

/**
 * The page's lines with everything not the writer's removed. Blank lines are
 * kept (collapsed), so paragraph structure survives for anything that splits
 * on it.
 */
export function writerWords(markdown: string | null | undefined): string {
  if (!markdown) return ''
  const out: string[] = []
  let inFence = false
  let ritual: string | null = null
  for (const line of markdown.split('\n')) {
    if (inFence) {
      if (FENCE_CLOSE.test(line)) inFence = false
      continue
    }
    if (FENCE_OPEN.test(line)) {
      inFence = true
      continue
    }
    const name = line.match(RITUAL_NAME)
    if (name) {
      ritual = name[1]!.trim()
      continue
    }
    if (RITUAL_END.test(line)) {
      ritual = null
      continue
    }
    if (TOKEN.test(line)) continue
    const inScripture = ritual !== null && SCRIPTURE_RITUALS.includes(ritual)
    if (isScriptureQuoteLine(line, inScripture)) continue
    // A verse quoted inline — “…” (v. 39) — as a verse number wrote it for a
    // short while before quotes became lines of their own.
    const stripped = line.replace(INLINE_VERSE, '')
    const kept = stripped === line ? line : stripped.replace(/ {2,}/g, ' ')
    if (line.trim() && !kept.trim()) continue
    out.push(kept)
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
