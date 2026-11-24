/**
 * Is someone actually here?
 *
 * Background pulls (the entries poll, the sync heartbeat, the jobs poll) run
 * only while the window is visible AND someone has used it within
 * IDLE_AFTER_MS. Every pull is a database query on the server, and the
 * database (Neon) suspends only after ~5 minutes with none — so a Mac app left
 * open overnight, or a tab on a second screen, must go quiet, or it keeps the
 * database awake around the clock.
 *
 * Going quiet loses nothing: focus and return-to-visible already pull what
 * changed (and reconcile deletes), and the first input after an idle stretch
 * fires onPresenceResume so a visible-but-idle window catches up at once.
 */

/** How long after the last input a visible window keeps pulling in the background. */
export const IDLE_AFTER_MS = 5 * 60_000

const INPUT_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

let lastInputAt = Date.now()
let installed = false
const resumeListeners = new Set<() => void>()

function visible(): boolean {
  return typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

function install(): void {
  if (installed || typeof window === 'undefined') return
  installed = true
  const onInput = () => {
    const now = Date.now()
    const wasIdle = now - lastInputAt >= IDLE_AFTER_MS
    lastInputAt = now
    // Visible and idle → present: catch up now rather than at the next interval.
    // (Focus / return-to-visible have their own catch-up pulls, so they only
    // reset the clock.)
    if (wasIdle && visible()) for (const fn of [...resumeListeners]) fn()
  }
  const onAttention = () => {
    lastInputAt = Date.now()
  }
  for (const type of INPUT_EVENTS) window.addEventListener(type, onInput, { capture: true, passive: true })
  window.addEventListener('focus', onAttention)
  document.addEventListener('visibilitychange', () => {
    if (visible()) onAttention()
  })
}

/** Visible and used recently: background pulls may run. */
export function isPresent(now = Date.now()): boolean {
  install()
  return visible() && now - lastInputAt < IDLE_AFTER_MS
}

/** Called on the first input after an idle stretch. Returns an unsubscribe. */
export function onPresenceResume(fn: () => void): () => void {
  install()
  resumeListeners.add(fn)
  return () => {
    resumeListeners.delete(fn)
  }
}

/** Test hook: pretend the last input happened at `at`. */
export function setLastInputAtForTest(at: number): void {
  lastInputAt = at
}
