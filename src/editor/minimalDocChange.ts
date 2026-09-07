/**
 * The smallest single-range edit that turns `current` into `next`, found by
 * stripping the common prefix and suffix.
 *
 * This exists so a remote update can land in an open editor without disturbing
 * the person in front of it. Replacing the whole document (`{from: 0, to: len}`)
 * would be simpler, but CodeMirror maps the caret, the selection and the scroll
 * position through the change — so a full-document replace collapses the cursor
 * and jumps the view, even when the actual difference is one word three
 * paragraphs away. Narrowing the range to what genuinely differs means an edit
 * arriving from another device is, in the common case, invisible.
 *
 * Returns null when the documents are identical.
 */
export interface DocChange {
  from: number
  to: number
  insert: string
}

const isHighSurrogate = (c: number): boolean => c >= 0xd800 && c <= 0xdbff
const isLowSurrogate = (c: number): boolean => c >= 0xdc00 && c <= 0xdfff

export function minimalDocChange(current: string, next: string): DocChange | null {
  if (current === next) return null

  let start = 0
  const maxStart = Math.min(current.length, next.length)
  while (start < maxStart && current.charCodeAt(start) === next.charCodeAt(start)) start++

  let end = 0
  const maxEnd = Math.min(current.length - start, next.length - start)
  while (
    end < maxEnd &&
    current.charCodeAt(current.length - 1 - end) === next.charCodeAt(next.length - 1 - end)
  ) {
    end++
  }

  // Emoji and other astral characters are two UTF-16 units. A boundary that
  // lands between the halves would hand CodeMirror a range splitting one
  // character; nudge it outward so whole characters are replaced.
  if (start > 0 && isLowSurrogate(next.charCodeAt(start)) && isHighSurrogate(next.charCodeAt(start - 1))) {
    start--
  }
  if (end > 0 && isLowSurrogate(current.charCodeAt(current.length - end))) end--

  return {
    from: start,
    to: current.length - end,
    insert: next.slice(start, next.length - end),
  }
}
