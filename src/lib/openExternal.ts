import { isTauri } from './platform'

/**
 * Open an external web flow (Stripe Checkout, billing portal) correctly on
 * every platform.
 *
 * DESKTOP/iOS (Tauri): hand the URL to the system browser via the opener
 * plugin. This is critical — using `window.location.href` there navigates the
 * app's OWN embedded webview away to the web origin. The desktop session lives
 * in the origin-independent Tauri store (auth.json), NOT in that origin's
 * localStorage, so the webview lands session-less, renders <SignIn />, and the
 * in-webview Google OAuth that follows is exactly what Google refuses inside an
 * embedded webview — stranding the user on a broken sign-in. Opening the system
 * browser instead keeps the app's webview on the app; the user completes
 * payment in their real browser and returns to tap "Already subscribed?
 * Refresh".
 *
 * WEB: `sameTab` redirects in place (so Stripe's `?checkout=success` return
 * lands back in the running app and the post-checkout poll picks it up);
 * otherwise open a new tab.
 */
export async function openExternal(url: string, opts?: { sameTab?: boolean }): Promise<void> {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url) // system browser — never the app's own webview
    return
  }
  if (opts?.sameTab) {
    window.location.href = url
  } else {
    window.open(url, '_blank', 'noopener')
  }
}
