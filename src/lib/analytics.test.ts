import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyAuthAnalytics,
  flushAnalyticsIdentity,
  identifyUser,
  lengthBucket,
  resetAnalyticsUser,
  setIdentityTransport,
} from './analytics'
import { settingsStore } from './settings'

describe('lengthBucket', () => {
  it('buckets zero and negative counts as empty', () => {
    expect(lengthBucket(0)).toBe('empty')
    expect(lengthBucket(-1)).toBe('empty')
  })

  it('covers each boundary on both sides', () => {
    expect(lengthBucket(1)).toBe('1_50')
    expect(lengthBucket(50)).toBe('1_50')
    expect(lengthBucket(51)).toBe('51_200')
    expect(lengthBucket(200)).toBe('51_200')
    expect(lengthBucket(201)).toBe('201_500')
    expect(lengthBucket(500)).toBe('201_500')
    expect(lengthBucket(501)).toBe('500_plus')
    expect(lengthBucket(10_000)).toBe('500_plus')
  })
})

describe('identify / consent gate', () => {
  const identify = vi.fn()
  const reset = vi.fn()

  beforeEach(() => {
    const store = new Map<string, string>()
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage
    settingsStore.update({ shareUsage: true })
    setIdentityTransport({ identify, reset })
    resetAnalyticsUser()
    identify.mockClear()
    reset.mockClear()
  })

  afterEach(() => {
    resetAnalyticsUser()
    setIdentityTransport(null)
    settingsStore.update({ shareUsage: true })
  })

  it('identifies the Supabase user id when shareUsage is on', () => {
    identifyUser('user-123')
    expect(identify).toHaveBeenCalledTimes(1)
    expect(identify).toHaveBeenCalledWith('user-123')
    expect(reset).not.toHaveBeenCalled()
  })

  it('does not identify when shareUsage is off', () => {
    settingsStore.update({ shareUsage: false })
    identifyUser('user-123')
    expect(identify).not.toHaveBeenCalled()
  })

  it('identifies a remembered user when they opt in after sign-in', () => {
    settingsStore.update({ shareUsage: false })
    identifyUser('user-123')
    expect(identify).not.toHaveBeenCalled()

    settingsStore.update({ shareUsage: true })
    flushAnalyticsIdentity()
    expect(identify).toHaveBeenCalledWith('user-123')
  })

  it('does not flush an identity after sign-out', () => {
    identifyUser('user-123')
    identify.mockClear()
    resetAnalyticsUser()
    expect(reset).toHaveBeenCalledTimes(1)

    flushAnalyticsIdentity()
    expect(identify).not.toHaveBeenCalled()
  })

  it('applyAuthAnalytics identifies a restored session and resets only on sign-out', () => {
    applyAuthAnalytics('user-123')
    expect(identify).toHaveBeenCalledWith('user-123')

    identify.mockClear()
    applyAuthAnalytics(null)
    expect(reset).not.toHaveBeenCalled()
    expect(identify).not.toHaveBeenCalled()

    applyAuthAnalytics(null, true)
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it('swallows a throwing identity transport', () => {
    setIdentityTransport({
      identify: () => {
        throw new Error('vendor down')
      },
      reset: () => {
        throw new Error('vendor down')
      },
    })
    expect(() => identifyUser('user-123')).not.toThrow()
    expect(() => resetAnalyticsUser()).not.toThrow()
  })
})
