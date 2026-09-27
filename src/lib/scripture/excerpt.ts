import { stripMarkdownMarkers } from '../inlineMarkers'

/** How far either side of the reference the excerpt reaches, in raw characters. */
export const EXCERPT_RADIUS = 120

/**
 * The words around a Scripture reference, for Lamp's book drawer and the
 * Ascent's "Where you reached for…".
 *
 * `charStart` is an offset into the RAW markdown, so the window has to be cut
 * from the raw body — and then cleaned, because it used to be shown as cut.
 * A ritual page put `<!-- ritual:name:New Every Morning --> <!-- ritual:section:
 * Awake -->` in front of the writer's own sentence, and a fence, a heading or a
 * bold word showed its syntax the same way. Nothing here is the writer's:
 *
 *   - HTML comments (ritual/practice markers), including one the window cut in
 *     half at either end;
 *   - fence lines (```` ```dayspring-scripture … ```` / ```` ``` ````) — the
 *     words inside a block stay, the fence does not;
 *   - line and inline markdown markers (`#`, `>`, `-`, `**`, `==`, links).
 */
export function excerptAround(body: string, charStart: number | null): string {
  if (!body) return ''
  const at = charStart ?? 0
  const start = Math.max(0, at - EXCERPT_RADIUS)
  const end = Math.min(body.length, at + EXCERPT_RADIUS)

  let raw = body.slice(start, end)
  // A comment the window opened inside: drop through its close, but only when
  // no opener comes first (otherwise that `-->` closes a whole comment).
  const close = raw.indexOf('-->')
  const open = raw.indexOf('<!--')
  if (close !== -1 && (open === -1 || close < open)) raw = raw.slice(close + 3)
  raw = raw
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // …and one the window closed inside.
    .replace(/<!--[\s\S]*$/, ' ')

  const text = raw
    .split('\n')
    .filter((line) => !/^\s*(`{3,}|~{3,})/.test(line))
    .map((line) => stripMarkdownMarkers(line.trim()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return ''
  return `${start > 0 ? '…' : ''}${text}${end < body.length ? '…' : ''}`
}
