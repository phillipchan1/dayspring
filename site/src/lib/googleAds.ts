// Google tag (gtag.js) + Google Ads conversions for the marketing site.
//
// PUBLIC_GOOGLE_TAG_ID unset → this module is a no-op: no script tag, no
// dataLayer, no network. Same posture as metaPixel.ts / siteAnalytics.ts.
// See docs/GROWTH_PULSE.md and site/.env.example.
//
// The loader is Google's own gtag.js snippet (gtag.js?id=AW-…), not a
// reimplementation — Tag Assistant and Ads conversion diagnostics expect
// that shape when they view source.
//
// Config is stock gtag defaults for a US-only small test: one AW config,
// no consent-mode deny (the site already loads Meta / PostHog without a
// banner once those env vars are set), no Google Signals, no extra ads
// personalization flags.

const TAG_ID = import.meta.env.PUBLIC_GOOGLE_TAG_ID as string | undefined
const DOWNLOAD_SEND_TO = import.meta.env.PUBLIC_GADS_DOWNLOAD_SEND_TO as string | undefined
const START_TRIAL_SEND_TO = import.meta.env.PUBLIC_GADS_START_TRIAL_SEND_TO as
  | string
  | undefined

/** Max wait on /start if gtag never invokes event_callback. */
export const START_TRIAL_HANDOFF_FALLBACK_MS = 1200

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let loaded = false

function ensureLoaded(): void {
  if (loaded || !TAG_ID) return
  loaded = true

  const w = window
  w.dataLayer = w.dataLayer || []
  if (!w.gtag) {
    // gtag.js only processes Arguments objects on dataLayer. A rest-parameter
    // array (`...args` → push(args)) is ignored, so no page_view, no _gcl_au,
    // no conversion hits. This is Google's standard snippet.
    w.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params -- rest args become an Array; gtag.js ignores those
      w.dataLayer!.push(arguments)
    }
  }
  w.gtag('js', new Date())
  w.gtag('config', TAG_ID)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${TAG_ID}`
  const first = document.getElementsByTagName('script')[0]
  first?.parentNode?.insertBefore(script, first)
}

/** Init on every site page — including /start, which uses Base.astro. */
export function initGoogleTag(): void {
  ensureLoaded()
}

function sendConversion(
  sendTo: string | undefined,
  extra?: { event_callback?: () => void },
): boolean {
  if (!sendTo) return false
  ensureLoaded()
  if (!window.gtag) return false
  window.gtag('event', 'conversion', {
    send_to: sendTo,
    transport_type: 'beacon',
    ...(extra?.event_callback ? { event_callback: extra.event_callback } : {}),
  })
  return true
}

/** Mac DMG click. No-op when PUBLIC_GADS_DOWNLOAD_SEND_TO is unset. */
export function trackGoogleDownloadConversion(): void {
  sendConversion(DOWNLOAD_SEND_TO)
}

/**
 * /start handoff. No-op when PUBLIC_GADS_START_TRIAL_SEND_TO is unset.
 * Pass `onReady` to wait for gtag's event_callback (script may still be
 * loading). When the conversion is not configured, `onReady` runs immediately
 * so the visitor is not held for a hit that will never fire.
 */
export function trackGoogleStartTrialConversion(onReady?: () => void): void {
  const sent = sendConversion(
    START_TRIAL_SEND_TO,
    onReady ? { event_callback: onReady } : undefined,
  )
  if (!sent) onReady?.()
}

/**
 * Fire the start-trial conversion, then call `handoff` once — either when
 * gtag's event_callback runs, or after START_TRIAL_HANDOFF_FALLBACK_MS so
 * the visitor is never stuck on /start.
 */
export function handoffAfterStartTrialConversion(handoff: () => void): void {
  let done = false
  const go = () => {
    if (done) return
    done = true
    handoff()
  }
  trackGoogleStartTrialConversion(go)
  setTimeout(go, START_TRIAL_HANDOFF_FALLBACK_MS)
}
