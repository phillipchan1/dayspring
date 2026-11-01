import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss'

/**
 * The back-swipe for a pushed view, taken from the leading edge only.
 *
 * Every pushed view on a phone (the reader, a volume, a practice's thread)
 * leaves the way it came: dragged back out to the right. The physics are all
 * `useSwipeToDismiss`; this decides where the gesture may START.
 *
 * It used to be the whole surface, and on a page of prose that cost the one
 * thing a page of prose is for: a touch on running text had to be taken out of
 * hit-testing so WebKit's text recogniser could not swallow the drag, and with
 * it went selecting and copying your own words. UIKit answers the same conflict
 * with `UIScreenEdgePanGestureRecognizer`: the back gesture lives in a strip at
 * the leading edge, and the rest of the view keeps its own touches. So does
 * this. The strip is about the reader's side margin, which means a touch in it
 * almost always lands on the page's gutter rather than on a word.
 *
 * If one does land on the first letter of a line, the failure is benign: WebKit
 * keeps the touch, no move ever reaches the hook, and nothing slides. The view
 * never freezes half-way, because it never started.
 */

/** Width of the leading-edge strip, in CSS px — UIKit's edge pan is about this. */
export const EDGE_PX = 24

/**
 * One navigation push or pop, in ms.
 *
 * The twin of `--dur-push` in themes.css (a test keeps them equal). A swipe
 * that commits hands the rest of the journey to CSS, and the view has to stay
 * mounted for exactly as long as that transition runs.
 */
export const PUSH_MS = 300

/**
 * Did this touch start in the leading-edge strip?
 *
 * `x` is the touch's position measured from the surface's own left edge, so a
 * panel narrower than the screen measures from where it actually starts.
 */
export function fromLeadingEdge(x: number, edge = EDGE_PX): boolean {
  return x >= 0 && x <= edge
}

/**
 * `useSwipeToDismiss`, limited to touches that start at the leading edge, with
 * the exit timed to a navigation pop.
 *
 * Spread `handlers` on the pushed layer itself (not on a strip element): the
 * hook reads the surface's width from the element the touch started on, and
 * that width is what its point of no return is a fraction of.
 */
export function useEdgeSwipeBack({
  onBack,
  enabled = true,
  guard,
  threshold = 72,
}: {
  onBack: () => void
  enabled?: boolean
  guard?: () => boolean
  threshold?: number
}) {
  const swipe = useSwipeToDismiss({
    onDismiss: onBack,
    enabled,
    threshold,
    exit: true,
    exitMs: PUSH_MS,
    ...(guard ? { guard } : {}),
  })
  const start = swipe.handlers.onTouchStart
  return {
    ...swipe,
    handlers: start
      ? {
          onTouchStart: (e: React.TouchEvent) => {
            const t = e.touches[0]
            if (!t) return
            const left = e.currentTarget.getBoundingClientRect().left
            if (fromLeadingEdge(t.clientX - left)) start(e)
          },
        }
      : {},
    /**
     * How far out of the way the view has been pulled, 0 to 1 — what the view
     * underneath is drawn from (its veil, and its parallax). 1 while leaving,
     * so the view underneath finishes arriving with the one on top.
     */
    out: swipe.leaving ? 1 : Math.min(1, Math.max(0, swipe.dragX / 320)),
  }
}
