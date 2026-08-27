/**
 * The noticing's grounding rules, kept out of `api/spiritual/` on purpose:
 * Vercel deploys every file under `api/` that isn't in an underscore directory
 * as its own function, so a test file colocated with the endpoint would become
 * a public URL. These live here so they can be pinned by tests.
 */

/**
 * What may be proposed. Two of the eight are deliberately missing.
 *
 * **Absence** — where He seemed far — is declared only. Inferring that God felt
 * absent to someone is a verdict on their interior life, and no amount of
 * pencil makes a machine the right author of that sentence.
 *
 * **Scripture** is excluded for a duller reason: references are already captured
 * verbatim at save time by a pipeline that resolves real ESV text, and a second
 * guesser would only disagree with it.
 */
export const PROPOSABLE = ['gift', 'prayer', 'desire', 'sense', 'learned', 'story'] as const
export type ProposableKind = (typeof PROPOSABLE)[number]

/** Never more than this in the margin at once. Pencil should never crowd ink. */
export const MAX_PROPOSALS = 3

/** Below this there isn't enough written to notice anything about. */
export const MIN_TEXT = 160

/** The shortest run of words worth pointing at. Below it, a "quote" is a phrase
 *  that appears in half the entries someone ever wrote. */
const MIN_QUOTE = 12

/**
 * Remove ```dayspring-*``` fences before the model sees the page.
 *
 * Two reasons, both load-bearing: it cannot propose something the writer has
 * already marked, and it never sees the fence syntax, so it cannot learn to
 * imitate it in a quote.
 */
export function stripFences(markdown: string): string {
  return markdown.replace(/^```dayspring-[a-z]+\s+[0-9a-f-]{36}[\s\S]*?^```[ \t]*$/gim, '')
}

/**
 * The guardrail. Structured output guarantees shape, never truthfulness — a
 * model that returns a beautifully-formed quote nobody wrote is exactly the
 * failure this whole surface exists to avoid.
 *
 * Exact substring, no normalisation. Trimming whitespace or collapsing quotes
 * before comparing would let a "close enough" quote through, and close enough is
 * how words the writer never wrote end up on their page.
 */
export function verbatimOnly(
  proposals: Array<{ quote: string; kind: string }>,
  text: string,
): Array<{ quote: string; kind: ProposableKind }> {
  const out: Array<{ quote: string; kind: ProposableKind }> = []
  const seenKinds = new Set<string>()
  for (const p of proposals) {
    const quote = p.quote
    if (!quote || quote.length < MIN_QUOTE) continue
    if (!text.includes(quote)) continue
    if (!(PROPOSABLE as readonly string[]).includes(p.kind)) continue
    // One of each at most: three pencil notes all saying "prayer" reads as the
    // machine having one idea, not as it having noticed three things.
    if (seenKinds.has(p.kind)) continue
    seenKinds.add(p.kind)
    out.push({ quote, kind: p.kind as ProposableKind })
    if (out.length >= MAX_PROPOSALS) break
  }
  return out
}
