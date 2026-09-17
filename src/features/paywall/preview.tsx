import { createRoot } from 'react-dom/client'
import { LockedScreen } from './LockedScreen'
import { PaywallScreen } from './PaywallScreen'
import { DEFAULT_DARK_THEME } from '@/lib/resolveTheme'
import type { Subscription } from '@/lib/subscription'

/**
 * Dev-only standalone rendering of the purchase surfaces.
 *
 * Why this exists: App Store Connect requires a screenshot of the in-app
 * purchase for review, and Apple rejects submissions where the reviewer can't
 * find the paywall. Capturing one normally means a provisioned device, a signed
 * -in account, and a deliberately expired trial — which is slow enough that the
 * screenshot silently goes stale every time the paywall changes. This renders
 * the real components, with real styles, from a plain browser.
 *
 * Reached only via `import.meta.env.DEV`, so Vite strips the whole path (and
 * this module) from production bundles:
 *
 *   ?__preview=paywall       the plan picker
 *   ?__preview=locked        a cancelled subscriber — the shortest locked state
 *   ?__preview=locked-ended  access ended, with the extension offer — the
 *                            TALLEST locked state, and the one Apple cited as
 *                            crowded on a large iPhone. Open "Questions?" on it
 *                            to see the screen at its full height.
 *
 * See scripts/capture-appstore-screenshots.mjs.
 */

/** A lapsed Apple-billed subscription — the state that puts the iOS purchase
 *  surface on screen with Restore and the auto-renew disclosure visible. */
const LAPSED_APPLE: Subscription = {
  plan: 'cancelled',
  plan_source: 'apple',
  trial_ends_at: null,
  plan_expires_at: null,
  onboarded_at: null,
  featureFlags: [],
}

/** Access granted by the app has run out — nothing has ever been billed. This
 *  is the state a reviewer reaches by letting the 14 days lapse. */
const LAPSED_APP_GRANTED: Subscription = {
  plan: 'none',
  plan_source: null,
  trial_ends_at: new Date(Date.now() - 864e5).toISOString(),
  plan_expires_at: null,
  onboarded_at: new Date().toISOString(),
  featureFlags: [],
}

export function renderPaywallPreview(variant: string): void {
  // The preview bypasses <App/>, which is what normally stamps the theme onto
  // <html> from the user's settings. Without this the surface renders on the
  // default light palette and looks nothing like the product.
  // DEFAULT_DARK_THEME rather than a literal: this used to say 'dusk', which is
  // not a theme the registry has ever had, so every variable defined in a
  // [data-theme] block — --bg, --bg-input, --danger — resolved to nothing.
  const root = document.documentElement
  root.setAttribute('data-theme', DEFAULT_DARK_THEME)
  root.setAttribute('data-appearance', 'dark')
  root.style.colorScheme = 'dark'

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')

  createRoot(el).render(
    variant === 'paywall' ? (
      <PaywallScreen />
    ) : variant === 'locked-ended' ? (
      <LockedScreen
        plan="none"
        subscription={LAPSED_APP_GRANTED}
        canExtend
        userEmail="you@example.com"
        onRefetch={() => {}}
      />
    ) : (
      <LockedScreen
        plan="cancelled"
        subscription={LAPSED_APPLE}
        userEmail="you@example.com"
        onRefetch={() => {}}
      />
    ),
  )
}
