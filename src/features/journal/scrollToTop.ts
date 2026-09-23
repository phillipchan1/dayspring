/** The slice of an element this needs — kept narrow so it can be tested off the DOM. */
interface Scrollable {
  scrollTop: number
  scrollTo(options: ScrollToOptions): void
}

interface ScrollRoot {
  querySelectorAll(selectors: string): ArrayLike<unknown>
}

/**
 * Bring every scrolled region under `root` back to its top.
 *
 * What a second tap on the tab you are already on does on a phone. The surface
 * owns its own scroller (the wall, the shelf, a volume, a page), so rather than
 * each one exposing a handle, look for whatever is actually scrolled and send it
 * home. Returns whether anything moved.
 */
export function scrollToTop(root: ScrollRoot | null, smooth = true): boolean {
  if (!root) return false
  let moved = false
  const nodes = root.querySelectorAll('*')
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i] as Scrollable
    if (el.scrollTop > 0) {
      el.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
      moved = true
    }
  }
  return moved
}
