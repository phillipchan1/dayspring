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
/**
 * Where a ritual ENTRY's last movement ends.
 *
 * Without it the last movement ends at its first blank line (nothing else
 * marks where it stops), so a second paragraph written into it read back as
 * the page's After. A ritual entry now closes its block with this; older
 * blocks without it keep the old rule. An HTML comment, so any renderer that
 * predates it simply shows nothing.
 */
export const RITUAL_END_TOKEN = '<!-- ritual:end -->'
export const PRACTICE_END_RE = /^<!-- (?:ritual|practice):end -->$/

/** True for any ritual token line — name, section or end (already trimmed). */
export function isPracticeTokenLine(line: string): boolean {
  return PRACTICE_NAME_RE.test(line) || PRACTICE_SECTION_RE.test(line) || PRACTICE_END_RE.test(line)
}

/** The practice name if `line` is a `practice:name` token, else null. */
export function practiceNameFromLine(line: string): string | null {
  const match = PRACTICE_NAME_RE.exec(line)
  return match ? (match[1] ?? '').trim() : null
}
