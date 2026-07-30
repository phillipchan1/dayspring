// Apple In-App Purchase — server-side verification and entitlement resolution.
//
// Why direct StoreKit 2 + App Store Server API (and not RevenueCat): RevenueCat's
// value is its native SDK, and there is no RevenueCat SDK we can run inside a
// Tauri webview. Going through their REST API would add a vendor, a hop, and a
// second source of truth for entitlement — while Supabase already IS our source
// of truth and Apple ships a first-party Node library that does the hard parts
// (JWS chain verification, JWT auth against the App Store Server API).
//
// Two rules govern everything below:
//   1. NEVER trust the client. The app sends a signed transaction; we verify its
//      certificate chain against Apple's roots and then re-derive the real state
//      from Apple's own API. A tampered payload cannot grant entitlement.
//   2. The App Store Server API is authoritative, not the device. StoreKit tells
//      us *that something happened*; getAllSubscriptionStatuses tells us *what is
//      true right now*, including renewals and refunds the device never saw.

import {
  AppStoreServerAPIClient,
  Environment,
  OfferDiscountType,
  SignedDataVerifier,
  Status,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from '@apple/app-store-server-library'
import { appleRootCertificates } from './appleRootCerts.js'
import { env } from './env.js'
import type { Plan } from './entitlement.js'

/** Environments we try, in order. Production first: the overwhelming majority of
 *  real traffic is production, and sandbox only matters for TestFlight/reviewers
 *  and Phil's own device. Apple explicitly recommends this fall-through rather
 *  than trusting a client-supplied environment flag. */
const ENVIRONMENTS: Environment[] = [Environment.PRODUCTION, Environment.SANDBOX]

/** The Apple credentials are nullable in env.ts so that merely importing this
 *  module can't take down an unrelated endpoint. Resolve them at call time and
 *  fail with the exact variable name that's missing. */
function required(value: string | null, name: string): string {
  if (!value) throw new Error(`Missing required server env: ${name}`)
  return value
}

// ── Clients (memoised per environment; lambdas are reused across invocations) ──

const verifiers = new Map<Environment, SignedDataVerifier>()
const clients = new Map<Environment, AppStoreServerAPIClient>()

function verifier(environment: Environment): SignedDataVerifier {
  let v = verifiers.get(environment)
  if (!v) {
    v = new SignedDataVerifier(
      appleRootCertificates(),
      // Online checks (OCSP revocation + real-clock expiry) in production only.
      // Sandbox certificates routinely fail revocation lookups, which would make
      // TestFlight and App Review unusable.
      environment === Environment.PRODUCTION,
      environment,
      env.appleBundleId(),
      // appAppleId is required for production verification and must be omitted
      // for sandbox — the library validates the pairing.
      environment === Environment.PRODUCTION ? env.appleAppAppleId() : undefined,
    )
    verifiers.set(environment, v)
  }
  return v
}

function client(environment: Environment): AppStoreServerAPIClient {
  let c = clients.get(environment)
  if (!c) {
    c = new AppStoreServerAPIClient(
      required(env.applePrivateKey(), 'APPLE_PRIVATE_KEY'),
      required(env.appleKeyId(), 'APPLE_KEY_ID'),
      required(env.appleIssuerId(), 'APPLE_ISSUER_ID'),
      env.appleBundleId(),
      environment,
    )
    clients.set(environment, c)
  }
  return c
}

// ── Verification ──────────────────────────────────────────────────────────────

export interface VerifiedTransaction {
  transaction: JWSTransactionDecodedPayload
  environment: Environment
}

/**
 * Verify a `jwsRepresentation` handed up by StoreKit on the device.
 * Tries production then sandbox, because the same binary runs in both.
 */
export async function verifySignedTransaction(jws: string): Promise<VerifiedTransaction> {
  let lastError: unknown
  for (const environment of ENVIRONMENTS) {
    try {
      const transaction = await verifier(environment).verifyAndDecodeTransaction(jws)
      return { transaction, environment }
    } catch (e) {
      lastError = e
    }
  }
  throw new Error(
    `apple: could not verify signed transaction — ${
      lastError instanceof Error ? lastError.message : 'unknown'
    }`,
  )
}

export interface VerifiedNotification {
  payload: ResponseBodyV2DecodedPayload
  environment: Environment
}

/** Verify an App Store Server Notification V2 `signedPayload`. */
export async function verifySignedNotification(jws: string): Promise<VerifiedNotification> {
  let lastError: unknown
  for (const environment of ENVIRONMENTS) {
    try {
      const payload = await verifier(environment).verifyAndDecodeNotification(jws)
      return { payload, environment }
    } catch (e) {
      lastError = e
    }
  }
  throw new Error(
    `apple: could not verify notification — ${
      lastError instanceof Error ? lastError.message : 'unknown'
    }`,
  )
}

// ── Entitlement resolution ────────────────────────────────────────────────────

export interface AppleSubscriptionState {
  plan: Plan
  /** Stable across renewals — our durable handle on this subscription. */
  originalTransactionId: string
  /** Newest transaction id; used to drop out-of-order webhook deliveries. */
  transactionId: string | null
  productId: string | null
  /** Supabase user id, when the purchase carried one. */
  appAccountToken: string | null
  /** When access actually lapses (renewal date while active). */
  expiresAt: string | null
  /** Only set when Apple is running a free introductory offer. */
  trialEndsAt: string | null
  environment: Environment
}

/**
 * Ask Apple for the current truth about a subscription and normalise it into
 * the plan vocabulary the rest of Dayspring speaks.
 *
 * `anyTransactionId` may be a transactionId or an originalTransactionId.
 */
export async function resolveAppleSubscription(
  anyTransactionId: string,
  environment: Environment,
): Promise<AppleSubscriptionState | null> {
  const response = await client(environment).getAllSubscriptionStatuses(anyTransactionId)

  // One product family, one subscription group — take the most recent
  // transaction across whatever groups came back.
  const items = (response.data ?? []).flatMap((group) => group.lastTransactions ?? [])
  if (items.length === 0) return null

  const decoded = await Promise.all(
    items.map(async (item) => ({
      status: item.status as Status | undefined,
      transaction: item.signedTransactionInfo
        ? await verifier(environment).verifyAndDecodeTransaction(item.signedTransactionInfo)
        : null,
      renewal: item.signedRenewalInfo
        ? await verifier(environment).verifyAndDecodeRenewalInfo(item.signedRenewalInfo)
        : null,
    })),
  )

  // Prefer a live subscription; otherwise the most recently signed one, so a
  // lapsed user still resolves to a truthful "cancelled" rather than nothing.
  const best =
    decoded.find((d) => d.status === Status.ACTIVE || d.status === Status.BILLING_GRACE_PERIOD) ??
    decoded.sort((a, b) => (b.transaction?.signedDate ?? 0) - (a.transaction?.signedDate ?? 0))[0]

  const txn = best?.transaction
  const originalTransactionId = txn?.originalTransactionId ?? anyTransactionId
  if (!originalTransactionId) return null

  return {
    plan: appleStatusToPlan(best?.status, txn),
    originalTransactionId,
    transactionId: txn?.transactionId ?? null,
    productId: txn?.productId ?? null,
    appAccountToken: normaliseAccountToken(txn, best?.renewal),
    expiresAt: msToIso(txn?.expiresDate),
    trialEndsAt: isFreeTrial(txn) ? msToIso(txn?.expiresDate) : null,
    environment,
  }
}

/**
 * Apple subscription status → Dayspring plan.
 *
 * The one judgement call: BILLING_GRACE_PERIOD maps to an entitled plan, not
 * `past_due`. Apple's grace period exists precisely so the user keeps their
 * service while a card is retried — locking someone out of their own journal
 * because a renewal blipped would be both wrong and against Apple's intent.
 * BILLING_RETRY (no grace period configured, or grace already expired) is the
 * genuine "we couldn't charge you" state.
 */
export function appleStatusToPlan(
  status: Status | number | undefined,
  transaction?: JWSTransactionDecodedPayload | null,
): Plan {
  switch (status) {
    case Status.ACTIVE:
      return isFreeTrial(transaction) ? 'trialing' : 'active'
    case Status.BILLING_GRACE_PERIOD:
      return 'active'
    case Status.BILLING_RETRY:
      return 'past_due'
    case Status.EXPIRED:
    case Status.REVOKED:
      return 'cancelled'
    default:
      return 'none'
  }
}

function isFreeTrial(txn?: JWSTransactionDecodedPayload | null): boolean {
  return txn?.offerDiscountType === OfferDiscountType.FREE_TRIAL
}

/** appAccountToken is a UUID we set to the Supabase user id at purchase time.
 *  It can appear on either the transaction or the renewal info. */
function normaliseAccountToken(
  txn?: JWSTransactionDecodedPayload | null,
  renewal?: JWSRenewalInfoDecodedPayload | null,
): string | null {
  const raw = txn?.appAccountToken ?? renewal?.appAccountToken ?? null
  if (!raw) return null
  // Apple lowercases UUIDs; Supabase ids are already lowercase, but normalise
  // so a comparison never fails on case alone.
  return raw.toLowerCase()
}

function msToIso(ms: number | undefined): string | null {
  return typeof ms === 'number' ? new Date(ms).toISOString() : null
}

export { Environment as AppleEnvironment }
