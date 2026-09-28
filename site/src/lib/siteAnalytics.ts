// Site-side PostHog — the Entrance funnel plus page analytics.
//
// Custom events: landing_viewed, intent_clicked, download_clicked,
// start_trial_clicked. Each carries UTM props and nothing else; that's a
// different privacy posture from the app's closed enum vocabulary in
// src/lib/analytics.ts on purpose — this is marketing attribution data from
// an anonymous, pre-signup visitor, not journal content from an account.
//
// On every page load (once PUBLIC_POSTHOG_KEY is set) this module also inits
// posthog-js with $pageview / $pageleave and session replay. $pageleave is
// what fills PostHog's scroll-depth props ($prev_pageview_max_scroll_percentage
// and siblings). Autocapture and rageclick stay off; replay masks every input
// (the /help/contact form collects emails and messages). No new free-text
// properties are attached to any of this.
//
// Init is a no-op when PUBLIC_POSTHOG_KEY is unset.
//
// Same PostHog PROJECT as the app and the server (docs/GROWTH_PULSE.md):
// PUBLIC_POSTHOG_KEY here must hold the identical project API key as the app's
// VITE_POSTHOG_KEY. site/ is a separate Vercel project, so the two env vars
// are set independently even though the value is the same — see
// site/.env.example.

import posthog from 'posthog-js'

const KEY = import.meta.env.PUBLIC_POSTHOG_KEY as string | undefined
const HOST = (import.meta.env.PUBLIC_POSTHOG_HOST as string | undefined) || 'https://us.i.posthog.com'

let initialized = false

function ensureInit(): void {
  if (initialized || !KEY) return
  initialized = true
  posthog.init(KEY, {
    api_host: HOST,
    autocapture: false,
    // Static MPA: no View Transitions / ClientRouter. Prefetch (astro.config
    // prefetchAll) only fetches HTML — it never runs this module — so one
    // $pageview per real navigation and no extras. If ClientRouter is added
    // later, switch this to 'history_change' so soft navigations aren't missed.
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: false,
    rageclick: false,
    session_recording: {
      maskAllInputs: true,
    },
  })
}

/**
 * Init on every site page — not only when a custom Entrance event fires.
 * Safe to call more than once; a no-op without PUBLIC_POSTHOG_KEY.
 */
export function initSiteAnalytics(): void {
  ensureInit()
}

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const

/** UTM params on the current URL — the only free text this module ever sends. */
function utmProps(): Record<string, string> {
  const params = new URLSearchParams(window.location.search)
  const out: Record<string, string> = {}
  for (const key of UTM_KEYS) {
    const v = params.get(key)
    if (v) out[key] = v
  }
  return out
}

export type SiteEvent =
  | 'landing_viewed'
  | 'intent_clicked'
  | 'start_trial_clicked'
  /** A Mac .dmg click. The primary CTA since the site stopped selling the web app. */
  | 'download_clicked'

export function trackSite(event: SiteEvent): void {
  ensureInit()
  if (!KEY) return
  posthog.capture(event, utmProps())
}

/**
 * Progressively enhances every on-page link to /start: carries this page's
 * full query string onward (UTMs, but also fbclid/gclid — whatever arrived,
 * not just the five utm_* keys) and fires `intent_clicked` on the way out.
 *
 * Astro's `prefetch` integration (astro.config.mjs) never triggers this: it
 * only fetches a hovered/visible link's HTML in the background, it doesn't
 * execute the target page's scripts until the browser actually navigates
 * there — so a link merely scrolling into view can't fire a false click.
 *
 * Deliberately does not intercept the click or delay navigation: this button
 * is the whole point of the page it's on, and racing a capture() call against
 * it is the wrong trade. /start's own start_trial_clicked (fired with a
 * deliberate flush delay before its redirect) is the reliable signal; this is
 * the earlier, best-effort one.
 */
export function wireCtaLinks(): void {
  const search = window.location.search
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href="/start"]')
  links.forEach((a) => {
    if (search) a.href = `/start${search}`
    a.addEventListener('click', () => trackSite('intent_clicked'), { once: true })
  })
}
