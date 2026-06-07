/**
 * Hidden HTML-comment tokens that scaffold a `/practice` entry. They live in the
 * persisted markdown (so structure survives save/sync) but should never surface
 * as human-facing text — titles, previews, search snippets all skip them.
 *
 *   <!-- practice:name:The Daily Examen -->
 *   <!-- practice:section:Gratitude -->
 */
// Tokens are written with the `ritual:` prefix; the legacy `practice:` prefix is
// still read so older entries keep rendering.
export const PRACTICE_NAME_RE = /^<!-- (?:ritual|practice):name:(.+) -->$/
export const PRACTICE_SECTION_RE = /^<!-- (?:ritual|practice):section:(.+) -->$/

/** True for a `practice:name` or `practice:section` token line (already trimmed). */
export function isPracticeTokenLine(line: string): boolean {
  return PRACTICE_NAME_RE.test(line) || PRACTICE_SECTION_RE.test(line)
}

/** The practice name if `line` is a `practice:name` token, else null. */
export function practiceNameFromLine(line: string): string | null {
  const match = PRACTICE_NAME_RE.exec(line)
  return match ? (match[1] ?? '').trim() : null
}
