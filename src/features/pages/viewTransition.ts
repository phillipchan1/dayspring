// Opening a page as a movement, not a cut.
//
// The wall and the Spread are the two ends of one gesture — you are standing
// further away or closer in. A hard swap says "different screen"; a shared
// element that grows from the card you clicked says "this page, nearer".

/**
 * `Document.startViewTransition` is optional in practice and non-optional in
 * lib.dom, so it is read through a narrowing view rather than re-declared —
 * re-declaring it collides with the built-in signature.
 */
type MaybeTransitional = {
  startViewTransition?: (cb: () => void) => unknown
}

/** The name both the card and the leaf claim, so the browser pairs them. */
export const SPREAD_TRANSITION_NAME = 'pg-page'

function reducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Run a state change as a shared-element transition where the browser can.
 *
 * Falls back to calling `update` directly — a missing API or a reduced-motion
 * preference must never mean a missing navigation. The callback has to be
 * synchronous: the browser snapshots the DOM the moment it returns, so anything
 * awaited inside would be captured half-done.
 */
export function withPageTransition(update: () => void): void {
  const doc = typeof document === 'undefined' ? null : (document as unknown as MaybeTransitional)
  const start = doc?.startViewTransition
  if (!doc || typeof start !== 'function' || reducedMotion()) {
    update()
    return
  }
  try {
    start.call(doc, update)
  } catch {
    // A transition already running, or a browser that exposes the API and then
    // objects — the navigation still has to happen.
    update()
  }
}

/**
 * Claim the shared name for one element, for the duration of one transition.
 *
 * Exactly one element on the page may carry a given `view-transition-name` at a
 * time; two claimants and the browser silently drops the animation. So the name
 * is stamped on the specific card being opened rather than declared in CSS for
 * every card on the wall, and cleared as soon as the transition settles.
 */
export function claimTransitionName(el: HTMLElement | null | undefined): () => void {
  if (!el) return () => {}
  el.style.viewTransitionName = SPREAD_TRANSITION_NAME
  return () => {
    el.style.viewTransitionName = ''
  }
}
