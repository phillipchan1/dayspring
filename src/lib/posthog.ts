// PostHog wiring for the anonymous usage events defined in ./analytics.ts.
//
// This file is only a vendor adapter — it must never widen what can be sent.
// autocapture/pageview/session-recording/rageclick are all off: PostHog only
// ever receives the closed, enum-only event vocabulary from analytics.ts,
// routed through setAnalyticsTransport below. Nothing here should start
// capturing DOM text, clicks, or URLs, since that's exactly the free-text
// leak analytics.ts's design is structured to make impossible.

import posthog from 'posthog-js'
import { env } from './env'
import { settingsStore } from './settings'
import { setAnalyticsTransport } from './analytics'

let initialized = false

function applyOptState() {
  if (settingsStore.get().shareUsage) posthog.opt_in_capturing()
  else posthog.opt_out_capturing()
}

/** Call once at startup. No-ops if VITE_POSTHOG_KEY isn't set (e.g. local dev). */
export function initPostHog(): void {
  if (initialized || !env.posthogKey) return
  initialized = true

  posthog.init(env.posthogKey, {
    api_host: env.posthogHost,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    rageclick: false,
    opt_out_capturing_by_default: !settingsStore.get().shareUsage,
  })

  setAnalyticsTransport((event, props) => posthog.capture(event, props))
  settingsStore.subscribe(applyOptState)
}
