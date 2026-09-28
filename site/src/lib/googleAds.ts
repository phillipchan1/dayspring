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
    w.gtag = function gtag(...args: unknown[]) {
      w.dataLayer!.push(args)
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

function sendConversion(sendTo: string | undefined): void {
  if (!sendTo) return
  ensureLoaded()
  window.gtag?.('event', 'conversion', {
    send_to: sendTo,
    transport_type: 'beacon',
  })
}

/** Mac DMG click. No-op when PUBLIC_GADS_DOWNLOAD_SEND_TO is unset. */
export function trackGoogleDownloadConversion(): void {
  sendConversion(DOWNLOAD_SEND_TO)
}

/** /start handoff. No-op when PUBLIC_GADS_START_TRIAL_SEND_TO is unset. */
export function trackGoogleStartTrialConversion(): void {
  sendConversion(START_TRIAL_SEND_TO)
}
