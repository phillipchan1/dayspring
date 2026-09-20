/**
 * Does a press on `target` close the open palette?
 *
 * Yes for anything that is not the palette itself — the line it was opened
 * from included, which is the case that needs saying. A palette opened from the
 * `+` is tied to no text, so nothing in the document ever tells it to go, and
 * CodeMirror sends no update at all for a click that lands on the caret it
 * already has. Without a press listener, clicking the very line you pressed the
 * `+` beside left the menu up until you clicked a different one.
 *
 * No on touch. The bottom sheet has a scrim that owns backing out, and its
 * `onCancel` takes the `/command` text with it; closing here first would leave
 * a stray `/` in the entry.
 */
export function pressClosesPalette(target: EventTarget | null, doc: Document = document): boolean {
  if (doc.querySelector('.slash-palette--sheet')) return false
  return !(target instanceof Element && target.closest('.slash-palette'))
}
