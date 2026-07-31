import type { Product } from '@spicavi/tauri-plugin-purchases'
import type { ApplePlan } from '@/lib/appleIap'

/**
 * Stripe list prices. Correct for web and desktop ONLY.
 *
 * The App Store does not sell at these numbers: Apple's price tiers are .99
 * based, so the monthly plan is $7.99 there rather than $7. On top of that,
 * StoreKit returns a price already localised to the buyer's storefront and
 * currency, which no hardcoded string can stand in for.
 *
 * So these must never be rendered on the Apple path. Showing "$7" beside a
 * StoreKit sheet that charges $7.99 is inaccurate pricing under App Store
 * Review Guideline 3.1.2 — and, more simply, a promise the purchase won't keep.
 */
export const WEB_PRICES: Record<ApplePlan, string> = {
  annual: '$64',
  monthly: '$7',
}

/**
 * The price string to render for a plan.
 *
 * Returns `null` on Apple until StoreKit has answered — deliberately, so
 * callers are forced to render something honest (a plan name, a spinner)
 * instead of falling back to a figure that would be wrong. On web there is
 * nothing to wait for, so the Stripe price comes back immediately.
 */
export function displayPrice(
  plan: ApplePlan,
  opts: { useApple: boolean; products: Product[] },
): string | null {
  if (!opts.useApple) return WEB_PRICES[plan]
  return opts.products.find((p) => p.id.includes(plan))?.displayPrice ?? null
}
