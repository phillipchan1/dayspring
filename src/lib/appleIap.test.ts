import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────
// restorePurchases is the seam: everything interesting about a restore is what
// we do with the transactions StoreKit hands back.
const restorePurchases = vi.fn()
const purchase = vi.fn()

vi.mock('@spicavi/tauri-plugin-purchases', () => ({
  restorePurchases: () => restorePurchases(),
  purchase: (...args: unknown[]) => purchase(...args),
  getProducts: vi.fn(),
  isSupported: vi.fn(),
  manageSubscriptions: vi.fn(),
  onPurchaseUpdated: vi.fn(),
}))

let onAppleDevice = true
vi.mock('./platform', () => ({
  isMobileTauri: () => onAppleDevice,
  isTauri: () => onAppleDevice,
  isDesktopTauri: () => false,
}))

vi.mock('./supabase', () => ({
  requireSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: 't', user: { id: 'u1' } } } }),
    },
  }),
}))

vi.mock('./api', () => ({ apiUrl: (p: string) => p }))

import {
  describeRestore,
  purchaseApple,
  restoreApplePurchases,
  DOUBLE_BILLED_WARNING,
  type RestoreOutcome,
} from './appleIap'

/** One /api/apple/verify reply. */
type Reply =
  | { ok: true; entitled: boolean; alsoBilledByStripe?: boolean }
  | { ok: false; status: number; error: string; code?: string }

/** Queue replies in the order the JWSs are sent. Order is deterministic because
 *  restore maps over the purchases array. */
function mockVerify(replies: Reply[]): void {
  let i = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const r = replies[i++] ?? { ok: true as const, entitled: false }
      if (r.ok) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            plan: r.entitled ? 'active' : 'cancelled',
            entitled: r.entitled,
            alsoBilledByStripe: r.alsoBilledByStripe === true,
          }),
        }
      }
      return {
        ok: false,
        status: r.status,
        json: async () => ({ error: r.error, code: r.code }),
      }
    }),
  )
}

const purchases = (n: number) => Array.from({ length: n }, (_, i) => ({ jws: `jws-${i}` }))

beforeEach(() => {
  onAppleDevice = true
  restorePurchases.mockReset()
  purchase.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('restoreApplePurchases', () => {
  it('reports nothing found when the Apple ID has no purchases', async () => {
    restorePurchases.mockResolvedValue([])
    mockVerify([])
    const out = await restoreApplePurchases()
    expect(out).toEqual({ found: 0, synced: 0, entitling: false, crossAccount: null, error: null })
  })

  it('unlocks when a live subscription comes back', async () => {
    restorePurchases.mockResolvedValue(purchases(1))
    mockVerify([{ ok: true, entitled: true }])
    const out = await restoreApplePurchases()
    expect(out.synced).toBe(1)
    expect(out.entitling).toBe(true)
    expect(describeRestore(out)).toBeNull()
  })

  it('does not let one dead transaction sink a restore that also found a live one', async () => {
    // The bug: StoreKit routinely returns several transactions for an Apple ID,
    // including long-expired ones that 404 at verification. The old loop awaited
    // them in sequence and threw on the first failure, so a user with one dead
    // transaction and one live subscription got "Could not restore purchases"
    // and stayed locked out of a subscription they were paying for.
    restorePurchases.mockResolvedValue(purchases(2))
    mockVerify([
      { ok: false, status: 404, error: 'no subscription found' },
      { ok: true, entitled: true },
    ])

    const out = await restoreApplePurchases()
    expect(out.found).toBe(2)
    expect(out.synced).toBe(1)
    expect(out.entitling).toBe(true)
    // A success alongside a stale-transaction failure is still a success — the
    // user must not be shown an error they cannot act on.
    expect(out.error).toBeNull()
    expect(describeRestore(out)).toBeNull()
  })

  it('surfaces the cross-account message verbatim', async () => {
    // The most common real restore failure — subscribed with Google, later
    // signed in with Apple — and the only one whose message names the fix.
    // Flattening it into "Could not restore purchases" is what turns it into a
    // support email.
    const msg = 'This App Store subscription is already on a Dayspring account that signs in with Google.'
    restorePurchases.mockResolvedValue(purchases(1))
    mockVerify([
      { ok: false, status: 409, error: msg, code: 'subscription_owned_by_other_account' },
    ])

    const out = await restoreApplePurchases()
    expect(out.crossAccount).toBe(msg)
    expect(out.entitling).toBe(false)
    expect(describeRestore(out)).toEqual({ kind: 'error', text: msg })
  })

  it('prefers the cross-account message over a generic failure', async () => {
    restorePurchases.mockResolvedValue(purchases(2))
    mockVerify([
      { ok: false, status: 502, error: 'could not reach the App Store' },
      { ok: false, status: 409, error: 'other account', code: 'subscription_owned_by_other_account' },
    ])

    const out = await restoreApplePurchases()
    expect(out.crossAccount).toBe('other account')
    expect(describeRestore(out)?.text).toBe('other account')
  })

  it('keeps a real error when nothing succeeded', async () => {
    restorePurchases.mockResolvedValue(purchases(1))
    mockVerify([{ ok: false, status: 502, error: 'could not reach the App Store' }])
    const out = await restoreApplePurchases()
    expect(out.synced).toBe(0)
    expect(out.error).toBe('could not reach the App Store')
  })

  it('is inert off an Apple device', async () => {
    onAppleDevice = false
    const out = await restoreApplePurchases()
    expect(out.found).toBe(0)
    expect(restorePurchases).not.toHaveBeenCalled()
  })
})

describe('purchaseApple', () => {
  it('warns when the account is still being billed by Stripe as well', async () => {
    // Neither store can refund the other's charge, so the only fix is for the
    // user to cancel the web subscription — and they will never know to unless
    // we tell them. We do NOT block the purchase: StoreKit has already taken
    // the money by the time the server can see the conflict, so refusing would
    // leave them charged AND locked out.
    purchase.mockResolvedValue({ outcome: 'purchased', purchase: { jws: 'jws-0' } })
    mockVerify([{ ok: true, entitled: true, alsoBilledByStripe: true }])

    const result = await purchaseApple('annual')
    expect(result).toEqual({ outcome: 'purchased', warning: DOUBLE_BILLED_WARNING })
  })

  it('carries no warning on an ordinary purchase', async () => {
    purchase.mockResolvedValue({ outcome: 'purchased', purchase: { jws: 'jws-0' } })
    mockVerify([{ ok: true, entitled: true }])
    expect(await purchaseApple('monthly')).toEqual({ outcome: 'purchased', warning: null })
  })

  it('passes cancelled and pending straight through without calling the server', async () => {
    purchase.mockResolvedValue({ outcome: 'cancelled' })
    mockVerify([])
    expect(await purchaseApple('annual')).toEqual({ outcome: 'cancelled', warning: null })

    purchase.mockResolvedValue({ outcome: 'pending' })
    expect(await purchaseApple('annual')).toEqual({ outcome: 'pending', warning: null })
  })

  it('tags the purchase with the Supabase user id so the server can claim it', async () => {
    // appAccountToken is what stops a subscription being re-pointed at another
    // Dayspring account. StoreKit requires it to be a UUID; Supabase ids are.
    purchase.mockResolvedValue({ outcome: 'purchased', purchase: { jws: 'jws-0' } })
    mockVerify([{ ok: true, entitled: true }])
    await purchaseApple('annual')
    expect(purchase).toHaveBeenCalledWith(expect.any(String), { appAccountToken: 'u1' })
  })
})

describe('describeRestore', () => {
  const outcome = (o: Partial<RestoreOutcome> = {}): RestoreOutcome => ({
    found: 0,
    synced: 0,
    entitling: false,
    crossAccount: null,
    error: null,
    ...o,
  })

  it('says nothing when the app just unlocked', () => {
    // The UI changing out from under them is the message.
    expect(describeRestore(outcome({ found: 1, synced: 1, entitling: true }))).toBeNull()
  })

  it('tells an empty restore how to switch Apple ID', () => {
    const msg = describeRestore(outcome({ found: 0 }))
    expect(msg?.kind).toBe('error')
    expect(msg?.text).toMatch(/different one/i)
    expect(msg?.text).toMatch(/Media & Purchases/)
  })

  it('is honest when the restored subscription has simply expired', () => {
    // The easily-missed case. Reporting "restored!" and then showing the paywall
    // again reads as a broken app rather than an expired plan — and it is the
    // exact confusion App Review looks for.
    const msg = describeRestore(outcome({ found: 2, synced: 2, entitling: false }))
    expect(msg?.kind).toBe('info')
    expect(msg?.text).toMatch(/expired/i)
  })

  it('falls back to a generic error only when it has nothing better', () => {
    expect(describeRestore(outcome({ found: 1 }))?.text).toBe('Could not restore purchases.')
    expect(describeRestore(outcome({ found: 1, error: 'network down' }))?.text).toBe('network down')
  })
})
