/**
 * The writer's own words — a page with everything that is not theirs taken out.
 *
 * A page can hold words the writer did not write: a Scripture passage (a
 * `dayspring-scripture` fence), and, in a scripture ritual, the phrases they
 * quoted from it (`> Remain in me (v. 4)`). Anything that shows a line back as
 * "yours", or checks that a quote is "verbatim", must read THIS rather than the
 * raw page — or a verse comes back as the writer's own words, which Guardrail
 * H3 forbids outright ("never blur quotation").
 *
 * What goes:
 * - ritual tokens (`<!-- ritual:… -->`, the legacy `<!-- practice:… -->`);
 * - every scripture fence, whole;
 * - scripture quote lines, recognised by STRUCTURE, never by voice: any `>`
 *   line inside a scripture ritual (one whose name is in
 *   `SCRIPTURE_RITUALS`), and any `>` line anywhere that ends in a verse
 *   number — `(v. 4)`, `(vv. 4–5)`. Lectio's older caught word is a bare
 *   `> phrase`, which is why the ritual's name has to count too.
 *
 * What stays: everything the writer wrote, including their own prayer, sense
 * and other declared fences (their words, in a block), and a `>` quote in an
 * ordinary page (which may be anyone's, and has always been kept).
 *
 * Pure and dependency-free. `api/_lib/writerWords.ts` is the same function for
 * the server; `writerWords.test.ts` holds both to the same fixtures.
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
