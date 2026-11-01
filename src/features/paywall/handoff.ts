import { isTauri } from '@/lib/platform'

/**
 * When a hand-off to Stripe is over, as far as the button that started it is
 * concerned.
 *
 * Both purchase screens set `loading` when a plan is pressed and only cleared it
 * on an error — so a Mac user who went to the browser, closed the checkout tab
 * and came back found "Redirecting…" on a dead button for good.
 *
 *  - In the app, `openExternal` resolves once the system browser has the URL.
 *    That is the hand-off done: the app is still here, so the button should be
 *    too.
 *  - On the web it navigates this very tab. The button should keep saying so
 *    while the page goes; if the person comes back to it — the Back button
 *    restoring the page from the back-forward cache, or focus returning after a
 *    navigation that never happened — that is the moment to let go.
 */
export function untilHandoffSettles(): Promise<void> {
  if (isTauri() || typeof window === 'undefined') return Promise.resolve()
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener('focus', done)
      window.removeEventListener('pageshow', done)
      resolve()
    }
    window.addEventListener('focus', done)
    window.addEventListener('pageshow', done)
  })
}
