// @vitest-environment jsdom

/**
 * Guideline 3.1.2(c), twice: 2026-09-21 (build 796) for a Subscribe button with
 * no billed amount beside it, and 2026-09-21 (build 930) for not saying what
 * the price buys. appStoreCopy.test.ts greps the source for words that must
 * never ship; these render the surfaces and check the two structural promises
 * that greps cannot see:
 *
 *   1. No buy CTA exists while StoreKit has not returned that product's price.
 *      Not "disabled" — absent. A greyed-out "Continue yearly" is still a
 *      purchase offer with no amount on it, which is what 796 was rejected for.
 *   2. Every purchase surface names what the subscription includes, in the
 *      shared words from valueCopy.ts.
 *
 * Both are about what a reviewer sees on a device where StoreKit is slow or
 * unreachable — the state a source grep is blind to.
 */

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '@spicavi/tauri-plugin-purchases'
import type { Subscription } from '@/lib/subscription'

/** StoreKit's answer, or its silence. Swapped per test before rendering. */
const storeKit = vi.hoisted(() => ({ products: [] as Product[] }))

vi.mock('@/lib/appleIap', async () => {
  const actual = await vi.importActual<typeof import('@/lib/appleIap')>('@/lib/appleIap')
  return {
    ...actual,
    isAppleIapAvailable: () => true,
    fetchAppleProducts: () => Promise.resolve(storeKit.products),
    purchaseApple: vi.fn(),
    restoreApplePurchases: vi.fn(),
    manageAppleSubscriptions: vi.fn(),
  }
})

vi.mock('@/lib/storeCopy', () => ({ usesAppStoreCopy: () => true }))

vi.mock('@/lib/analytics', () => ({ track: vi.fn() }))

vi.mock('@/lib/subscription', async () => {
  const actual = await vi.importActual<typeof import('@/lib/subscription')>('@/lib/subscription')
  return {
    ...actual,
    // The locked screen paints a "what Dayspring is holding" block from this;
    // an unresolved promise would leave the surface half-rendered.
    fetchJournalHolding: () => Promise.resolve({ entries: 0, years: 0, prayers: 0, scriptures: 0 }),
    startCheckout: vi.fn(),
  }
})

const { TrialBanner } = await import('./TrialBanner')
const { LockedScreen } = await import('./LockedScreen')
const { FEATURES } = await import('./valueCopy')

const priced = (id: string, displayPrice: string) =>
  ({ id, displayPrice }) as unknown as Product

const TRIALING: Subscription = {
  plan: 'trialing',
  trial_ends_at: new Date(Date.now() + 9 * 864e5).toISOString(),
} as Subscription

const LAPSED: Subscription = { plan: 'none', trial_ends_at: null } as Subscription

// React only accepts act() when the environment opts in.
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  storeKit.products = []
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

/** Render and flush the effects that fetch StoreKit prices. */
async function render(el: Parameters<Root['render']>[0]) {
  await act(async () => {
    root.render(el)
  })
  await act(async () => {})
}

/**
 * Every button that offers to START a purchase.
 *
 * Recovery controls are not offers and must survive the gate: someone who
 * already paid needs Restore and Refresh most when the plans have not loaded.
 */
const BUYS = /subscribe|continue (yearly|monthly)|^monthly$/i
const RECOVERS = /already subscribed|restore|refresh/i

function buyButtons(): HTMLButtonElement[] {
  return [...container.querySelectorAll('button')].filter((b) => {
    const text = `${b.textContent ?? ''} ${b.getAttribute('aria-label') ?? ''}`.trim()
    return BUYS.test(text) && !RECOVERS.test(text)
  })
}

/** Feature names are sentence-cased on some surfaces; the word is the point. */
function namesFeature(feature: string): boolean {
  return (container.textContent ?? '').toLowerCase().includes(feature.toLowerCase())
}

describe('purchase surfaces: no buy CTA before StoreKit answers', () => {
  it('TrialBanner offers nothing while the price is unknown', async () => {
    await render(createElement(TrialBanner, { subscription: TRIALING, onDismiss: () => {} }))

    expect(buyButtons()).toEqual([])
    // and nothing that looks like a price
    expect(container.querySelector('.trial-banner__price')).toBeNull()
  })

  it('TrialBanner offers the plan once the price arrives', async () => {
    storeKit.products = [priced('dayspring_annual', '$69.99')]
    await render(createElement(TrialBanner, { subscription: TRIALING, onDismiss: () => {} }))

    expect(buyButtons()).toHaveLength(1)
    expect(container.textContent).toContain('$69.99')
  })

  it('LockedScreen offers nothing while the price is unknown', async () => {
    await render(createElement(LockedScreen, { plan: 'none', subscription: LAPSED, onRefetch: () => {} }))

    expect(buyButtons()).toEqual([])
    expect(container.textContent).toContain('Loading plans')
  })

  it('LockedScreen offers both plans once the prices arrive', async () => {
    storeKit.products = [
      priced('dayspring_annual', '$69.99'),
      priced('dayspring_monthly', '$7.99'),
    ]
    await render(createElement(LockedScreen, { plan: 'none', subscription: LAPSED, onRefetch: () => {} }))

    expect(buyButtons()).toHaveLength(2)
    expect(container.textContent).toContain('$69.99')
    expect(container.textContent).toContain('$7.99')
    expect(container.textContent).not.toContain('Loading plans')
  })
})

describe('purchase surfaces: what the price buys', () => {
  it('TrialBanner names the features beside the price', async () => {
    storeKit.products = [priced('dayspring_annual', '$69.99')]
    await render(createElement(TrialBanner, { subscription: TRIALING, onDismiss: () => {} }))

    for (const feature of FEATURES) {
      expect(namesFeature(feature), `banner never names ${feature}`).toBe(true)
    }
  })

  it('LockedScreen names the features beside the price', async () => {
    storeKit.products = [priced('dayspring_annual', '$69.99')]
    await render(createElement(LockedScreen, { plan: 'none', subscription: LAPSED, onRefetch: () => {} }))

    for (const feature of FEATURES) {
      expect(namesFeature(feature), `locked screen never names ${feature}`).toBe(true)
    }
  })
})
