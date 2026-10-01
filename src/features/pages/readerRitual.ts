/**
 * Which movement of a ritual page was clicked in the reader.
 *
 * The reader renders a ritual page through `revealRitualsForDisplay`: the
 * practice's name, then each ANSWERED movement as a `.read-ritual-label`
 * paragraph followed by its writing. Clicking an answer should open the rail
 * on that movement with the caret in it — so walk back from the clicked block
 * to the label that introduces it.
 *
 * One subtlety, from the parser: the LAST movement's writing ends at its
 * first blank line, and anything after that is the page's After. So past the
 * first paragraph under the last label, a click belongs to After
 * (`labels.length`), not to the movement.
 *
 * That rule predates `<!-- ritual:end -->`. A block that closes with the end
 * token keeps every paragraph of its last movement, up to the token (the
 * parser bounds it there like any other movement), and the display leaves a
 * hidden `.read-ritual-end` where the token was. So: past that marker is After;
 * before it, the last movement is whole.
 *
 * `undefined` when the click was not on an answer (the name, the date) — the
 * rail then opens where it always does, on the first movement still waiting.
 */
export function ritualMovementAt(
  target: Element | null,
  body: Element,
  labels: readonly string[],
): number | undefined {
  let block: Element | null = target
  while (block && block.parentElement !== body) block = block.parentElement
  if (!block) return undefined

  let paragraphs = 0
  for (let el: Element | null = block; el; el = el.previousElementSibling) {
    if (el.classList.contains('read-ritual-name')) return undefined
    // Walked back past the block's end: this is the page's After.
    if (el.classList.contains(END) && el !== block) return labels.length
    if (el.classList.contains('read-ritual-label')) {
      const n = labels.indexOf(el.textContent?.trim() ?? '')
      if (n < 0) return undefined
      if (el === block) return n
      if (n === labels.length - 1 && paragraphs > 1 && !closedBelow(el)) return labels.length
      return n
    }
    paragraphs++
  }
  return undefined
}

const END = 'read-ritual-end'

/** Whether an end marker follows this label before any other ritual begins. */
function closedBelow(label: Element): boolean {
  for (let el = label.nextElementSibling; el; el = el.nextElementSibling) {
    if (el.classList.contains(END)) return true
    if (el.classList.contains('read-ritual-name')) return false
  }
  return false
}
