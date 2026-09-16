// Meta Pixel — PageView (every page, fired from Base.astro) and StartTrial
// (the /start redirect page only, right before it hands off to the app).
// PUBLIC_META_PIXEL_ID unset → both are no-ops; nothing pixel-related loads
// or ships without it. See docs/product/GROWTH_PULSE.md.
//
// The loader below is Meta's own base-code snippet (Events Manager → Set up
// the Pixel → Install code manually), not a reimplementation — that's what
// Events Manager's test tool and any future Meta support conversation expect
// to find when they view source.

const PIXEL_ID = import.meta.env.PUBLIC_META_PIXEL_ID as string | undefined

interface FbqFn {
  (...args: unknown[]): void
  callMethod?: (...args: unknown[]) => void
  queue?: unknown[]
  push?: FbqFn
  loaded?: boolean
  version?: string
}

declare global {
  interface Window {
    fbq?: FbqFn
    _fbq?: FbqFn
  }
}

let loaded = false

function ensureLoaded(): void {
  if (loaded || !PIXEL_ID) return
  loaded = true

  const w = window
  const d = document
  if (w.fbq) return
  const n: FbqFn = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args)
    else n.queue?.push(args)
  }
  w.fbq = n
  if (!w._fbq) w._fbq = n
  n.push = n
  n.loaded = true
  n.version = '2.0'
  n.queue = []
  const script = d.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  const first = d.getElementsByTagName('script')[0]
  first?.parentNode?.insertBefore(script, first)

  w.fbq('init', PIXEL_ID)
}

export function trackPageView(): void {
  ensureLoaded()
  window.fbq?.('track', 'PageView')
}

export function trackStartTrial(): void {
  ensureLoaded()
  window.fbq?.('track', 'StartTrial')
}
