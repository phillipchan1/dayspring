// Apple IAP via StoreKit 2 (tauri-plugin-purchases). Only active inside the
// iOS Tauri shell — web/desktop keep using Stripe.

import { isMobileTauri } from './platform'
import { apiUrl } from './api'
import { requireSupabase } from './supabase'
import { track } from './analytics'
import type { Product, Purchase } from '@spicavi/tauri-plugin-purchases'

export const APPLE_PRODUCT_IDS = {
  monthly:
    (import.meta.env.VITE_APPLE_IAP_MONTHLY_PRODUCT_ID as string | undefined) ||
    'dayspring_monthly',
  annual:
    (import.meta.env.VITE_APPLE_IAP_ANNUAL_PRODUCT_ID as string | undefined) ||
    'dayspring_annual',
} as const

export type ApplePlan = 'annual' | 'monthly'

export function appleProductId(plan: ApplePlan): string {
  return plan === 'annual' ? APPLE_PRODUCT_IDS.annual : APPLE_PRODUCT_IDS.monthly
}

export function isAppleIapAvailable(): boolean {
  // Dev-only: the standalone paywall preview (?__preview=…) renders the iOS
  // purchase surface in a desktop browser so the App Store review screenshot
  // can be captured without a provisioned device. `import.meta.env.DEV` is
  // statically false in production, so Vite strips this branch entirely.
  if (isPaywallPreview()) return true
  return isMobileTauri()
}

let listenerStarted = false

/** Register for out-of-band StoreKit updates (Ask to Buy, renewals, restores). */
export async function initApplePurchases(
  onUpdate?: (purchase: Purchase) => void,
): Promise<void> {
  if (!isMobileTauri() || listenerStarted) return
  listenerStarted = true
  try {
    const { onPurchaseUpdated } = await import('@spicavi/tauri-plugin-purchases')
    await onPurchaseUpdated((purchase) => {
      void syncPurchaseToServer(purchase).catch((err) => {
        console.warn('[apple-iap] background sync failed', err)
      })
      onUpdate?.(purchase)
    })
  } catch (err) {
    console.warn('[apple-iap] listener init failed', err)
  }
}

function isPaywallPreview(): boolean {
  return (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.location.search.includes('__preview=')
  )
}

export async function fetchAppleProducts(): Promise<Product[]> {
  // Stand-in products for the dev-only paywall preview, where StoreKit does not
  // exist and real prices cannot be fetched.
  //
  // ⚠️ These MUST match App Store Connect. They exist so the App Store review
  // screenshot shows the prices a reviewer will actually be charged — a shot
  // with no price, or the wrong one, is a guideline 3.1.2 rejection. Update
  // here and in docs/IOS.md together, then re-run the screenshot script.
  //
  // Written inline under a literal `import.meta.env.DEV` rather than hoisted to
  // a module const: as a const the minifier kept the array as dead data in the
  // production bundle even though the branch was already `return false`.
  if (import.meta.env.DEV && isPaywallPreview()) {
    return [
      { id: APPLE_PRODUCT_IDS.annual, displayPrice: '$69.99' },
      { id: APPLE_PRODUCT_IDS.monthly, displayPrice: '$7.99' },
    ] as unknown as Product[]
  }
  if (!isMobileTauri()) return []
  const { getProducts, isSupported } = await import('@spicavi/tauri-plugin-purchases')
  const support = await isSupported()
  if (!support.supported) return []
  return getProducts([APPLE_PRODUCT_IDS.annual, APPLE_PRODUCT_IDS.monthly])
}

export type ApplePurchaseOutcome = 'purchased' | 'pending' | 'cancelled'

export interface ApplePurchaseResult {
  outcome: ApplePurchaseOutcome
  /** Set when this purchase leaves the account paying both stores. */
  warning: string | null
}

/**
 * Start a StoreKit purchase for a plan. On success, POSTs the JWS to the server
 * so entitlement unlocks immediately; App Store Server Notifications are the
 * backup path that keeps it honest afterwards.
 */
export async function purchaseApple(plan: ApplePlan): Promise<ApplePurchaseResult> {
  if (!isMobileTauri()) throw new Error('Apple IAP is only available on iOS')
  // The Stripe twin of this lives in subscription.ts startCheckout. Both report
  // an *intent*: the store confirms the actual purchase later, via webhook.
  track('checkout_started', { plan: plan === 'annual' ? 'annual' : 'monthly', store: 'apple' })

  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session?.user?.id) throw new Error('not authenticated')

  const { purchase } = await import('@spicavi/tauri-plugin-purchases')
  // StoreKit requires appAccountToken to be a UUID — Supabase user ids are.
  const result = await purchase(appleProductId(plan), {
    appAccountToken: session.user.id,
  })

  let warning: string | null = null
  if (result.outcome === 'purchased' && result.purchase) {
    const synced = await syncPurchaseToServer(result.purchase)
    if (synced.alsoBilledByStripe) warning = DOUBLE_BILLED_WARNING
  }
  return { outcome: result.outcome, warning }
}

/** What a restore actually achieved, in the terms the UI needs to answer
 *  "why am I still looking at a paywall?". */
export interface RestoreOutcome {
  /** Transactions StoreKit handed back for this Apple ID. */
  found: number
  /** How many the server verified and accepted. */
  synced: number
  /** True when at least one restored subscription is live — the only case that
   *  actually unlocks the app. */
  entitling: boolean
  /**
   * Set when a restored subscription belongs to a *different* Dayspring account.
   * This is the single most common real restore failure (subscribed with Google,
   * later signed in with Apple), and the message names the button to press, so
   * it must reach the user verbatim instead of becoming "Could not restore".
   */
  crossAccount: string | null
  /** Any other failure, kept only when nothing succeeded. */
  error: string | null
}

/**
 * Explicit "Restore Purchases" — required by App Store review, and the escape
 * hatch for every "I paid and it's still locked" support email.
 *
 * Two rules learned the hard way:
 *
 *  • **Never let one bad transaction sink the restore.** StoreKit routinely
 *    returns several transactions for an Apple ID, including long-expired ones
 *    that 404 at verification. The old loop awaited them in sequence and threw
 *    on the first failure, so a user with one dead transaction and one live
 *    subscription got "Could not restore purchases" and stayed locked out.
 *
 *  • **Count entitlement, not transactions.** A non-zero restore count is not
 *    success — restoring an expired subscription is the expected outcome for
 *    someone who genuinely lapsed, and telling them "restored!" before dropping
 *    them back on the paywall reads as a broken app rather than an expired plan.
 */
export async function restoreApplePurchases(): Promise<RestoreOutcome> {
  if (!isMobileTauri()) {
    return { found: 0, synced: 0, entitling: false, crossAccount: null, error: null }
  }
  const { restorePurchases } = await import('@spicavi/tauri-plugin-purchases')
  const purchases = await restorePurchases()

  const results = await Promise.allSettled(purchases.map((p) => syncPurchaseToServer(p)))

  let synced = 0
  let entitling = false
  let crossAccount: string | null = null
  let error: string | null = null

  for (const r of results) {
    if (r.status === 'fulfilled') {
      synced++
      if (r.value.entitled) entitling = true
    } else if (r.reason instanceof AppleVerifyError && r.reason.code === CROSS_ACCOUNT_CODE) {
      crossAccount = r.reason.message
    } else if (!error) {
      error = r.reason instanceof Error ? r.reason.message : 'Could not restore purchases.'
    }
  }

  return {
    found: purchases.length,
    synced,
    entitling,
    crossAccount,
    // A real success beside a stale-transaction failure is still a success —
    // don't show an error the user cannot act on and does not need.
    error: synced > 0 ? null : error,
  }
}

export interface RestoreMessage {
  kind: 'info' | 'error'
  text: string
}

/**
 * What to tell the user after a restore — the same answer on every surface that
 * offers the button (paywall, locked screen, Settings), because "Restore did
 * nothing" is the support email this feature exists to prevent.
 *
 * Returns null when the restore actually unlocked the app: the UI changing out
 * from under them is the message, and a toast on top of it just adds noise.
 */
export function describeRestore(outcome: RestoreOutcome): RestoreMessage | null {
  if (outcome.entitling) return null

  // Most actionable failure by a wide margin — it names the button to press.
  if (outcome.crossAccount) return { kind: 'error', text: outcome.crossAccount }

  if (outcome.found === 0) {
    return {
      kind: 'error',
      text:
        'No purchases found for this Apple ID. If you subscribed using a different one, ' +
        'switch to it in the Settings app under Media & Purchases, then try again.',
    }
  }

  // The honest, and easily-missed, case: we DID find their old subscription and
  // it is simply over. Claiming success here and then showing them the paywall
  // again reads as a broken app rather than an expired plan.
  if (outcome.synced > 0) {
    return {
      kind: 'info',
      text: 'We found your previous subscription, but it has expired. Choose a plan to pick back up.',
    }
  }

  return { kind: 'error', text: outcome.error ?? 'Could not restore purchases.' }
}

const CROSS_ACCOUNT_CODE = 'subscription_owned_by_other_account'

/** Carries the server's `code` through, so callers can single out the
 *  cross-account case without string-matching a user-facing message. */
export class AppleVerifyError extends Error {
  readonly code: string | null
  readonly status: number
  constructor(message: string, code: string | null, status: number) {
    super(message)
    this.name = 'AppleVerifyError'
    this.code = code
    this.status = status
  }
}

/** Open Apple's subscription management sheet. */
export async function manageAppleSubscriptions(): Promise<void> {
  if (!isMobileTauri()) return
  const { manageSubscriptions } = await import('@spicavi/tauri-plugin-purchases')
  await manageSubscriptions()
}

/** What the server made of one restored/purchased transaction. */
export interface SyncedPurchase {
  plan: string
  /** True only when this specific subscription unlocks the app right now. */
  entitled: boolean
  /** The server found a still-live Stripe subscription on this account. The
   *  StoreKit charge has already happened by the time we know, so this is a
   *  warning to pass on, not something to block. */
  alsoBilledByStripe: boolean
}

/** Shown after a purchase that leaves the user paying both stores. Neither store
 *  can refund the other's charge, so the only fix is for them to cancel the web
 *  subscription — and they will not know to unless we say so. */
export const DOUBLE_BILLED_WARNING =
  'Heads up: you also have an active subscription billed on the web. ' +
  'Cancel it in Settings → Billing so you are not charged twice.'

async function syncPurchaseToServer(purchase: Purchase): Promise<SyncedPurchase> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  // Server verifies the StoreKit JWS against Apple's roots, re-reads
  // subscription status from the App Store Server API, then writes profiles.
  const res = await fetch(apiUrl('/api/apple/verify'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ jws: purchase.jws }),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
    throw new AppleVerifyError(
      err.error ?? `verify failed (${res.status})`,
      err.code ?? null,
      res.status,
    )
  }

  const body = (await res.json().catch(() => ({}))) as {
    plan?: string
    entitled?: boolean
    alsoBilledByStripe?: boolean
  }
  return {
    plan: body.plan ?? 'none',
    entitled: body.entitled === true,
    alsoBilledByStripe: body.alsoBilledByStripe === true,
  }
}
