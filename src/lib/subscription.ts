import { requireSupabase } from './supabase'
import { apiUrl } from './api'

export type Plan = 'none' | 'trialing' | 'active' | 'cancelled' | 'past_due'

/** Who bills this subscription. Entitlement never depends on it — a Stripe
 *  subscriber is entitled on iPhone and an App Store subscriber is entitled on
 *  the web — but the *management* and *purchase* UI does, because each store
 *  can only cancel and charge its own. */
export type PlanSource = 'stripe' | 'apple'

export interface Subscription {
  plan: Plan
  plan_source: PlanSource | null
  trial_ends_at: string | null
  plan_expires_at: string | null
  /** Null until the user finishes (or skips) the first-run onboarding flow. */
  onboarded_at: string | null
  featureFlags: string[]
}

/**
 * How long access outlives the moment billing says it should stop — a dropped
 * renewal webhook or a card in dunning. Mirrors api/_lib/entitlement.ts, which
 * carries the full reasoning; api/_lib/entitlementParity.test.ts fails if the
 * two ever disagree.
 */
export const GRACE_DAYS = 3
const GRACE_MS = GRACE_DAYS * 86_400_000

/** True when `iso` is a real timestamp that fell more than `graceMs` ago.
 *  Absent and unparseable both mean "no evidence of a lapse" — a null expiry is
 *  the normal healthy state for Stripe, and neither is a reason to take
 *  someone's journal away. */
function lapsed(iso: string | null | undefined, now: number, graceMs: number): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return false
  return t + graceMs <= now
}

/**
 * True when the App Store might still take money from this account.
 *
 * The guard for **purchase** surfaces: selling a Stripe subscription to someone
 * Apple is also charging is how one person pays twice for one journal, and
 * neither store refunds the other's charge.
 *
 * The line is at `cancelled`, not at entitlement. `past_due` is on the "still
 * charging" side because Apple's BILLING_RETRY keeps retrying the card for up
 * to 60 days — and that user's fix (update the payment method at Apple) works
 * from any browser, so it strands nobody.
 *
 * But once Apple reports EXPIRED or REVOKED, the relationship is over and they
 * must be free to subscribe on the web. The old source-only rule left anyone who
 * cancelled on iOS permanently unable to pay us again from a browser — told to
 * open an iPhone they may no longer own, while the server would gladly have
 * taken the payment. Mirrors appleMayStillCharge() in api/_lib/entitlement.ts.
 */
export function appleMayStillCharge(sub: Subscription | null): boolean {
  if (sub?.plan_source !== 'apple') return false
  return sub.plan === 'active' || sub.plan === 'trialing' || sub.plan === 'past_due'
}

/**
 * True when this account's billing relationship lives at Apple, live or lapsed.
 *
 * The guard for **management** surfaces. A cancelled App Store subscription is
 * still only visible — and only refundable — in the App Store, so "Manage
 * billing" keeps pointing there after it lapses. A Stripe portal would 404.
 */
export function isAppleRelationship(sub: Subscription | null): boolean {
  return sub?.plan_source === 'apple' && sub.plan !== 'none'
}

/** Where a *new* purchase has to go. */
export type PurchaseRoute =
  /** StoreKit in-app purchase. */
  | 'apple-iap'
  /** Stripe Checkout. */
  | 'stripe'
  /** Apple already bills them, but they aren't on an Apple device — there is no
   *  purchase to make here, only a subscription to manage over there. */
  | 'apple-elsewhere'

/**
 * Route a purchase by device first, then by who already bills them.
 *
 * Device first because the App Store requires digital goods on iOS to go through
 * StoreKit — a Stripe checkout on an iPhone is a rejection, regardless of how
 * the account was billed before.
 *
 * Off an Apple device, the only reason to withhold Stripe is that Apple may
 * still charge them. A cancelled or expired App Store subscriber gets Stripe —
 * the path that used to dead-end.
 */
export function purchaseRoute(
  sub: Subscription | null,
  { onAppleDevice }: { onAppleDevice: boolean },
): PurchaseRoute {
  if (onAppleDevice) return 'apple-iap'
  return appleMayStillCharge(sub) ? 'apple-elsewhere' : 'stripe'
}

/** Where "Manage billing" has to send this account. */
export type BillingDestination =
  /** StoreKit's native manage-subscriptions sheet (Apple-billed, on an Apple device). */
  | 'apple-native'
  /** apps.apple.com/account/subscriptions (Apple-billed, but not on an Apple device). */
  | 'apple-web'
  /** The Stripe billing portal. */
  | 'stripe'

/**
 * Route "Manage billing" by **who takes the money**, never by which device is
 * in your hand. Each store can only cancel and refund its own subscriptions, so
 * sending a Stripe subscriber to the App Store shows them an empty list and
 * reads as "my subscription vanished".
 *
 * This used to be decided device-first in two places, which meant every Stripe
 * subscriber on an iPhone was told "Manage in App Store". One helper now, so
 * SettingsPanel and LockedScreen cannot drift apart again.
 */
export function billingDestination(
  sub: Subscription | null,
  { onAppleDevice }: { onAppleDevice: boolean },
): BillingDestination {
  // Relationship, not entitlement: someone whose App Store subscription already
  // lapsed still manages (and disputes) it at Apple.
  if (isAppleRelationship(sub)) return onAppleDevice ? 'apple-native' : 'apple-web'
  return 'stripe'
}

/**
 * True when there is a billing relationship worth opening a portal for.
 *
 * The first-run trial is app-managed — no card, no customer at either store —
 * so `plan_source` stays null until money actually changes hands, and a portal
 * link would 404. Note the converse is NOT safe: rows predating the
 * `plan_source` column can be genuinely subscribed with a null source, so only
 * the trial case is excluded here.
 */
export function hasBillingRelationship(sub: Subscription | null): boolean {
  const plan = sub?.plan ?? 'none'
  if (plan === 'none') return false
  if (plan === 'trialing' && !sub?.plan_source) return false
  return true
}

/**
 * The single entitlement question: can this account open the journal right now?
 *
 * Must stay behaviourally identical to api/_lib/entitlement.ts — the server
 * enforces it, this paints the UI, and a disagreement means either a lockout or
 * a free ride. `now` is injectable so tests pin time instead of sleeping.
 */
export function isEntitled(sub: Subscription | null, now: number = Date.now()): boolean {
  if (!sub) return false

  switch (sub.plan) {
    case 'active':
      // Healthy Stripe rows carry no expiry, so this is a no-op for them and a
      // backstop for Apple: an 'active' row long past its renewal date means we
      // never heard the renewal, not that someone is entitled forever.
      return !lapsed(sub.plan_expires_at, now, GRACE_MS)

    case 'trialing':
      // The only branch with no grace — a trial's whole contract is its end date.
      return sub.trial_ends_at != null && !lapsed(sub.trial_ends_at, now, 0)

    case 'past_due':
      // Dunning grace, measured from when billing actually failed.
      return sub.plan_expires_at != null && !lapsed(sub.plan_expires_at, now, GRACE_MS)

    case 'cancelled':
    case 'none':
      return false

    default:
      return false
  }
}

export function trialDaysRemaining(sub: Subscription | null): number {
  if (!sub?.trial_ends_at) return 0
  const ms = new Date(sub.trial_ends_at).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

/** Last-known subscription, used to paint the app instantly on launch while
 * we reconcile with the server in the background. Owner-fenced: reset by
 * fenceCacheToOwner (localData.ts) when a different user takes over the
 * browser, same as the other onboarding/preference flags. */
export const SUBSCRIPTION_CACHE_KEY = 'dayspring.subscription_cache.v1'

export function readCachedSubscription(): Subscription | null {
  try {
    const raw = localStorage.getItem(SUBSCRIPTION_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Subscription
    // Caches written before plan_source existed have no such key. Normalise to
    // null so `plan_source !== 'apple'` reads true instead of undefined-y.
    return { ...parsed, plan_source: parsed.plan_source ?? null }
  } catch {
    return null
  }
}

export function writeCachedSubscription(sub: Subscription): void {
  try {
    localStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(sub))
  } catch {
    /* ignore */
  }
}

/** Fetch the current user's subscription state from their profile row. */
export async function fetchSubscription(): Promise<Subscription> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('profiles')
    .select('plan, plan_source, trial_ends_at, plan_expires_at, onboarded_at, feature_flags')
    .maybeSingle()

  if (error) throw error

  return {
    plan: (data?.plan as Plan | null) ?? 'none',
    plan_source: (data?.plan_source as PlanSource | null) ?? null,
    trial_ends_at: data?.trial_ends_at ?? null,
    plan_expires_at: data?.plan_expires_at ?? null,
    onboarded_at: data?.onboarded_at ?? null,
    featureFlags: (data?.feature_flags as string[] | null) ?? [],
  }
}

/** POST to /api/stripe/checkout and return the Stripe-hosted checkout URL. */
export async function startCheckout(plan: 'annual' | 'monthly'): Promise<string> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const res = await fetch(apiUrl('/api/stripe/checkout'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ plan }),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `checkout failed (${res.status})`)
  }

  const { url } = (await res.json()) as { url: string }
  return url
}

/** POST /api/trial/extend — one-time +7 day self-serve extension. */
export async function extendTrial(): Promise<void> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const res = await fetch(apiUrl('/api/trial/extend'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `extend failed (${res.status})`)
  }
}

/** What Dayspring is holding for this user — the personal value anchor. */
export interface JournalHolding {
  entries: number
  years: number
  prayers: number
  scriptures: number
}

export async function fetchJournalHolding(): Promise<JournalHolding> {
  const sb = requireSupabase()
  const head = { count: 'exact' as const, head: true }
  const [entriesRes, firstRes, prayersRes, scripturesRes] = await Promise.all([
    sb.from('entries').select('id', head),
    sb
      .from('entries')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    sb.from('spiritual_items').select('id', head).eq('type', 'prayer'),
    sb.from('scripture_refs').select('id', head),
  ])
  const entries = entriesRes.count ?? 0
  const first = firstRes.data?.created_at ? new Date(firstRes.data.created_at) : null
  const years = first
    ? Math.max(1, Math.round((Date.now() - first.getTime()) / (365.25 * 864e5)))
    : 0
  return {
    entries,
    years,
    prayers: prayersRes.count ?? 0,
    scriptures: scripturesRes.count ?? 0,
  }
}

/** GET /api/stripe/portal and return the Stripe Customer Portal URL. */
export async function fetchPortalUrl(): Promise<string> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const res = await fetch(apiUrl('/api/stripe/portal'), {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `portal failed (${res.status})`)
  }

  const { url } = (await res.json()) as { url: string }
  return url
}
