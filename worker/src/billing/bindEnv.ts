import type { Env } from '../env.ts'

/** Copy Worker secrets onto `process.env` so `api/_lib/env.ts` / Apple verify can read them.
 *  Values are never logged. */
export function bindBillingEnv(env: Env): void {
  const pairs: Array<[string, string | undefined]> = [
    ['STRIPE_SECRET_KEY', env.STRIPE_SECRET_KEY],
    ['STRIPE_WEBHOOK_SECRET', env.STRIPE_WEBHOOK_SECRET],
    ['STRIPE_ANNUAL_PRICE_ID', env.STRIPE_ANNUAL_PRICE_ID],
    ['STRIPE_MONTHLY_PRICE_ID', env.STRIPE_MONTHLY_PRICE_ID],
    ['APPLE_BUNDLE_ID', env.APPLE_BUNDLE_ID],
    ['APPLE_ISSUER_ID', env.APPLE_ISSUER_ID],
    ['APPLE_KEY_ID', env.APPLE_KEY_ID],
    ['APPLE_PRIVATE_KEY', env.APPLE_PRIVATE_KEY],
    ['APPLE_APP_APPLE_ID', env.APPLE_APP_APPLE_ID],
    ['APP_URL', env.APP_URL],
    ['ONBOARDING_REQUIRE_CARD', env.ONBOARDING_REQUIRE_CARD],
    ['VITE_POSTHOG_KEY', env.VITE_POSTHOG_KEY],
    ['VITE_POSTHOG_HOST', env.VITE_POSTHOG_HOST],
    ['META_PIXEL_ID', env.META_PIXEL_ID],
    ['META_CAPI_ACCESS_TOKEN', env.META_CAPI_ACCESS_TOKEN],
  ]
  for (const [name, value] of pairs) {
    if (value !== undefined) process.env[name] = value
  }
}
