// Apple IAP via StoreKit 2 (tauri-plugin-purchases). Only active inside the
// iOS Tauri shell — web/desktop keep using Stripe.

import { isMobileTauri } from './platform'
import { apiUrl } from './api'
import { requireSupabase } from './supabase'
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

export async function fetchAppleProducts(): Promise<Product[]> {
  if (!isMobileTauri()) return []
  const { getProducts, isSupported } = await import('@spicavi/tauri-plugin-purchases')
  const support = await isSupported()
  if (!support.supported) return []
  return getProducts([APPLE_PRODUCT_IDS.annual, APPLE_PRODUCT_IDS.monthly])
}

export type ApplePurchaseOutcome = 'purchased' | 'pending' | 'cancelled'

/**
 * Start StoreKit purchase for a plan. On success, POSTs the JWS to the server
 * so entitlement unlocks immediately (RevenueCat webhook is the backup path).
 */
export async function purchaseApple(plan: ApplePlan): Promise<ApplePurchaseOutcome> {
  if (!isMobileTauri()) throw new Error('Apple IAP is only available on iOS')

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

  if (result.outcome === 'purchased' && result.purchase) {
    await syncPurchaseToServer(result.purchase)
  }
  return result.outcome
}

/** Explicit "Restore Purchases" — required by App Store review. */
export async function restoreApplePurchases(): Promise<number> {
  if (!isMobileTauri()) return 0
  const { restorePurchases } = await import('@spicavi/tauri-plugin-purchases')
  const purchases = await restorePurchases()
  for (const p of purchases) {
    await syncPurchaseToServer(p)
  }
  return purchases.length
}

/** Open Apple's subscription management sheet. */
export async function manageAppleSubscriptions(): Promise<void> {
  if (!isMobileTauri()) return
  const { manageSubscriptions } = await import('@spicavi/tauri-plugin-purchases')
  await manageSubscriptions()
}

async function syncPurchaseToServer(purchase: Purchase): Promise<void> {
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
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `verify failed (${res.status})`)
  }
}
