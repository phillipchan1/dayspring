// PostHog wiring for the anonymous usage events defined in ./analytics.ts.
//
// This file is only a vendor adapter — it must never widen what can be sent.
// autocapture/pageview/session-recording/rageclick are all off: PostHog only
// ever receives the closed, enum-only event vocabulary from analytics.ts,
// routed through setAnalyticsTransport below, plus identify/reset of the
// Supabase user id (so Use events join Exit). Nothing here should start
// capturing DOM text, clicks, or URLs, since that's exactly the free-text
// leak analytics.ts's design is structured to make impossible.

import posthog from 'posthog-js'
import { env } from './env'
import { settingsStore } from './settings'
import {
  flushAnalyticsIdentity,
  setAnalyticsTransport,
  setIdentityTransport,
} from './analytics'

let initialized = false
let lastShareUsage = settingsStore.get().shareUsage

function applyOptState() {
  const allowed = settingsStore.get().shareUsage
  if (allowed) {
    posthog.opt_in_capturing()
    // Only on the off → on edge: a theme change must not re-identify.
    if (!lastShareUsage) flushAnalyticsIdentity()
  } else {
    posthog.opt_out_capturing()
  }
  lastShareUsage = allowed
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
  setIdentityTransport({
    identify: (userId) => posthog.identify(userId),
    reset: () => posthog.reset(),
  })
  settingsStore.subscribe(applyOptState)
}
