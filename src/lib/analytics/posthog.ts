// The PostHog adapter behind lib/analytics.ts's vendor seam.
//
// This file is the only thing in the app that knows a vendor exists. It must
// never widen what can be sent: the vocabulary in lib/analytics.ts is closed by
// the type system, and everything below exists to stop the SDK from adding to
// it behind our backs. Read the flag block before changing any of it — several
// of those defaults leak user content, and posthog-js turns them ON by default.
//
// ─── Why the import is dynamic ──────────────────────────────────────────────
//
// Principle 3: the writing surface is sacred. posthog-js is ~200KB of vendor
// code, and a static import puts it in the main bundle — parsed and executed
// before the editor paints, on every cold start, for every user, forever. So it
// is imported lazily, after first paint, at idle. Nothing here may ever end up
// on the CodeMirror input path.
//
// ─── Why initialisation itself is gated ─────────────────────────────────────
//
// `shareUsage` gates `track()` already, so gating the SDK's *existence* looks
// redundant. It isn't. An initialised posthog-js writes localStorage and a
// cookie, mints a device id, and requests remote config on its own schedule —
// none of which route through track(). A user who turned the toggle off would
// still be issued an identifier and still phone home. `opt_out_capturing_by_
// default` is not the same promise: it suppresses the sending, after the SDK
// has already decided who they are. So: no consent, no SDK, no network.
//
// The corollary is that boot is LATE and CONDITIONAL. useSettingsSync pulls
// remote settings after sign-in, and remote wins — so a user who opted out on
// their laptop arrives here with the local default (`true`) and flips to false
// a second later, and vice versa. Everything below is therefore driven off a
// settingsStore subscription rather than a one-shot read at startup, and boot
// is idempotent.
//
// ─── Why the api_host is our own domain ─────────────────────────────────────
//
// Two reasons, and the second is the one that bites. Ad blockers filter
// posthog.com by domain, which would silently cost us the measurement. And the
// desktop/iOS shells serve the bundle from `*.localhost` via Tauri, so a
// relative URL never reaches Vercel at all — apiUrl() resolves to the absolute
// production origin there and to same-origin on web. See lib/api.ts.
//
// Note what this implies for the proxy: posthog-js computes its region from the
// api_host, and an unrecognised host means "custom", which routes EVERYTHING —
// capture, remote config, and lazily-loaded assets — at api_host + path rather
// than at the region's asset CDN. (See `endpointFor` in posthog-js: the
// `region === custom` branch returns `apiHost + path` for every endpoint kind.)
// That is why vercel.json needs the /cairn/static and /cairn/array rewrites and
// not just the catch-all — without them the SDK 404s on its own assets.

import { apiUrl } from '../api'
import { env } from '../env'
import { settingsStore } from '../settings'
import { setAnalyticsTransport, type AnalyticsEvent, type PropValue } from '../analytics'
import { pathOnly, scrubProperties } from './scrubUrl'

type PostHog = typeof import('posthog-js').default

let instance: PostHog | null = null
/** Set the moment a boot is scheduled, so a burst of settings changes boots once. */
let booting = false
/** Identity requested before the SDK finished loading; replayed on arrival. */
let pendingIdentity: {
  distinctId: string
  props?: Record<string, PropValue> | undefined
} | null = null

async function boot(): Promise<void> {
  if (instance || booting) return
  if (!env.posthogKey) return
  booting = true

  try {
    const { default: posthog } = await import('posthog-js')

    posthog.init(env.posthogKey, {
      // Our own domain, proxied to PostHog by vercel.json. Absolute on desktop.
      api_host: apiUrl('/cairn'),
      // Without this, posthog-js derives the "open this in PostHog" host from
      // api_host and produces a dead link at our own domain. Cosmetic, but it
      // is what the toolbar and debug links use.
      ui_host: 'https://us.posthog.com',

      // ── The flags that would otherwise collect content ──────────────────
      // Defaults noted because posthog-js ships most of these ON.

      // DEFAULT ON. Sends every click, input, and form submit with the
      // surrounding DOM text. On a journal that is the entry itself. Never
      // enable this.
      autocapture: false,
      // DEFAULT 'history_change'. Would emit a $pageview per navigation
      // carrying the raw URL. We name our own surfaces as enums instead.
      capture_pageview: false,
      // DEFAULT 'if_capture_pageview' — already off given the line above, but
      // stated so it stays off if that ever changes.
      capture_pageleave: false,
      // DEFAULT OFF, stated because turning it on records the screen: a
      // pixel-perfect video of somebody writing a confession.
      disable_session_recording: true,
      // DEFAULT ON (via `enable_heatmaps` deriving from this). Streams
      // coordinates and DOM context from the writing surface.
      capture_heatmaps: false,
      // DEFAULT ON. Fetches and renders vendor-authored UI over our app —
      // Principle 2's "modal interruptions" with someone else's copy in them.
      disable_surveys: true,
      disable_product_tours: true,
      disable_conversations: true,
      // Rage-click detection watches interaction patterns on the editor.
      rageclick: false,
      // Best-effort masking of anything that looks personal in auto props.
      // Belt and braces — the real defence is the closed vocabulary.
      mask_personal_data_properties: true,

      // ── Identity and consent ────────────────────────────────────────────
      // We only ever init after an affirmative opt-in, so this is a backstop
      // against a race, not the mechanism. The mechanism is not calling init.
      opt_out_capturing_by_default: !settingsStore.get().shareUsage,

      // ── URL scrubbing ───────────────────────────────────────────────────
      // Two layers on purpose. get_current_url is what posthog-js calls when it
      // builds $current_url; before_send is the last thing to touch an event on
      // its way out, and catches every other URL-shaped property including the
      // $initial_* set that persistence replays from an earlier session.
      get_current_url: () => String(pathOnly(window.location.href)),
      before_send: (event) => {
        if (!event) return null
        if (event.properties) event.properties = scrubProperties(event.properties)
        if (event.$set) event.$set = scrubProperties(event.$set)
        if (event.$set_once) event.$set_once = scrubProperties(event.$set_once)
        return event
      },
    })

    instance = posthog

    if (pendingIdentity) {
      posthog.identify(pendingIdentity.distinctId, pendingIdentity.props)
      pendingIdentity = null
    }
  } catch {
    // A blocked or failed vendor load must not be visible to the user in any
    // way. track() keeps no-oping; the app does not care.
  } finally {
    booting = false
  }
}

/**
 * Consent withdrawn mid-session.
 *
 * `reset(true)` mints a new device id and drops the stored person, so what is
 * left behind cannot be rejoined to the account. Then opt out, which is what
 * stops anything further going over the wire. The SDK stays loaded — it is
 * already in memory and unloading it buys nothing — but it is now inert.
 */
function optOut(): void {
  try {
    instance?.reset(true)
    instance?.opt_out_capturing()
  } catch {
    /* never break the app */
  }
}

/** Boot at idle so the vendor bundle can never compete with first paint. */
function scheduleBoot(): void {
  if (instance || booting || !env.posthogKey) return
  const run = () => void boot()
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 4000 })
  else setTimeout(run, 2000)
}

/**
 * Install the adapter. Call once from bootstrap(), after first paint is
 * scheduled — this returns immediately and does no network work of its own.
 */
export function installAnalytics(): void {
  setAnalyticsTransport({
    capture(event: AnalyticsEvent, props?: Record<string, PropValue>) {
      instance?.capture(event, props)
    },
    identify(distinctId: string, props?: Record<string, PropValue>) {
      if (instance) instance.identify(distinctId, props)
      // Sign-in usually beats the idle boot. Hold the identity rather than
      // dropping it, or the first session of a new account is anonymous and
      // never joins to its own subscription webhook.
      else pendingIdentity = { distinctId, props }
    },
    setPerson(props: Record<string, PropValue>) {
      if (instance) instance.setPersonProperties(props)
      // Before boot there is nobody to attach to. Merge into the held identity
      // so a fork chosen during a cold first run still lands.
      else if (pendingIdentity) {
        pendingIdentity = {
          ...pendingIdentity,
          props: { ...pendingIdentity.props, ...props },
        }
      }
    },
    reset() {
      pendingIdentity = null
      try {
        instance?.reset()
      } catch {
        /* never break the app */
      }
    },
  })

  let sharing = settingsStore.get().shareUsage
  if (sharing) scheduleBoot()

  // Remote settings land after boot (useSettingsSync), so this subscription —
  // not the read above — is what actually decides. Edge-triggered: applyRemote
  // notifies on every field, and re-running opt-out on each theme change would
  // reset the device id continuously.
  settingsStore.subscribe(() => {
    const next = settingsStore.get().shareUsage
    if (next === sharing) return
    sharing = next
    if (next) scheduleBoot()
    else optOut()
  })
}
