/**
 * iOS synthesizes a click ~300ms after the tap that opened an overlay.
 * The opening `touchstart` is already over, so a `setTimeout(0)` listener
 * still sees that click — and if the new sheet is shorter than the one that
 * was just closed, the click lands on the scrim and dismisses it. Scripture
 * with no surrounding text is a short search field; with text it grows. That
 * is why the second sheet sometimes stayed and sometimes vanished.
 */
export const GHOST_CLICK_MS = 400

export function isGhostClick(
  openedAt: number,
  now = Date.now(),
  windowMs = GHOST_CLICK_MS,
): boolean {
  return now - openedAt < windowMs
}

/**
 * A tap that dismisses an overlay should only dismiss it.
 *
 * Menus close on an outside `pointerdown`, which unmounts their backdrop
 * before the finger lifts. The `click` that follows is hit-tested on release
 * — against whatever the backdrop was covering — so tapping off a long-press
 * menu on the wall opened the very entry underneath it. Call this from the
 * dismissing `pointerdown` to eat that one click.
 *
 * The guard lets go on the next press or keystroke (a new gesture, never ours
 * to swallow), or shortly after release when no click came (the tap became a
 * drag). Returns the release, for callers that want it sooner.
 */
export function swallowClickThrough(windowMs = GHOST_CLICK_MS): () => void {
  let timer: number | undefined

  const onClick = (e: MouseEvent) => {
    e.preventDefault()
    e.stopImmediatePropagation()
    release()
  }
  const onLift = () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(release, windowMs)
  }
  function release() {
    window.clearTimeout(timer)
    window.removeEventListener('click', onClick, true)
    window.removeEventListener('pointerup', onLift, true)
    window.removeEventListener('pointercancel', onLift, true)
    window.removeEventListener('keydown', release, true)
    document.removeEventListener('pointerdown', release, true)
  }

  window.addEventListener('click', onClick, true)
  window.addEventListener('pointerup', onLift, true)
  window.addEventListener('pointercancel', onLift, true)
  window.addEventListener('keydown', release, true)
  // Added mid-dispatch of the dismissing press, so it won't see that press —
  // only the next one.
  document.addEventListener('pointerdown', release, true)
  return release
}
