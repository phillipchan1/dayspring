import { describe, it, expect, beforeEach } from 'vitest'
import {
  clearMirror,
  clearResetMarker,
  hasResetMarker,
  lockState,
  markResetRequested,
  readMirror,
  withLearnedPinLength,
  writeMirror,
} from './appLockStore'
import type { AppLockConfig } from './appLock'

// Minimal localStorage stand-in — the tests run in the `node` environment.
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
  lockState.seed(undefined)
})

const CONFIG: AppLockConfig = {
  v: 1,
  kind: 'pin',
  salt: 'c2FsdA==',
  iterations: 1_000,
  hash: 'aGFzaA==',
  graceSeconds: 300,
  biometric: false,
  updatedAt: '2026-08-17T00:00:00.000Z',
}

describe('the local mirror', () => {
  it('reads back what it wrote for the same owner', () => {
    writeMirror('owner-a', CONFIG)
    expect(readMirror('owner-a')).toEqual(CONFIG)
  })

  // The three-way return is the whole point: "no lock" opens the app, "don't
  // know" has to go and ask before anything renders. Collapsing them would
  // either flash content or block every launch on the network.
  it('distinguishes "no lock" from "no answer"', () => {
    expect(readMirror('owner-a')).toBeUndefined()
    writeMirror('owner-a', null)
    expect(readMirror('owner-a')).toBeNull()
  })

  // The gate runs ABOVE fenceCacheToOwner, so it cannot assume a previous
  // user's mirror has been scrubbed. Handing owner B owner A's lock would
  // demand a PIN that B has never set and cannot possibly know.
  it('refuses a mirror belonging to a different owner', () => {
    writeMirror('owner-a', CONFIG)
    expect(readMirror('owner-b')).toBeUndefined()
  })

  it('treats a corrupted mirror as no answer, not as no lock', () => {
    localStorage.setItem('dayspring.applock', 'not json')
    expect(readMirror('owner-a')).toBeUndefined()
    localStorage.setItem('dayspring.applock', JSON.stringify({ owner: 'owner-a', config: { v: 9 } }))
    expect(readMirror('owner-a')).toBeUndefined()
  })

  it('forgets on clear', () => {
    writeMirror('owner-a', CONFIG)
    clearMirror()
    expect(readMirror('owner-a')).toBeUndefined()
  })
})

describe('the forgotten-PIN marker', () => {
  it('is only claimed by the owner that left it', () => {
    markResetRequested('owner-a')
    expect(hasResetMarker('owner-a')).toBe(true)
    expect(hasResetMarker('owner-b')).toBe(false)
  })

  it('is absent by default and after clearing', () => {
    expect(hasResetMarker('owner-a')).toBe(false)
    markResetRequested('owner-a')
    clearResetMarker()
    expect(hasResetMarker('owner-a')).toBe(false)
  })

  // It has to survive the sign-out it triggers, so it must not be one of the
  // owner-scoped keys that localData.ts wipes.
  it('is not stored under the mirror key', () => {
    markResetRequested('owner-a')
    clearMirror()
    expect(hasResetMarker('owner-a')).toBe(true)
  })
})

describe('lockState', () => {
  it('notifies subscribers on set but not on seed', () => {
    let calls = 0
    const stop = lockState.subscribe(() => calls++)

    lockState.seed(CONFIG)
    expect(lockState.get()).toEqual(CONFIG)
    expect(calls).toBe(0)

    lockState.set(null)
    expect(lockState.get()).toBeNull()
    expect(calls).toBe(1)

    stop()
    lockState.set(CONFIG)
    expect(calls).toBe(1)
  })
})

describe('the PIN length', () => {
  it('survives the mirror, so an offline launch still opens on the last digit', () => {
    writeMirror('owner-a', { ...CONFIG, pinLength: 6 })
    expect(readMirror('owner-a')?.pinLength).toBe(6)
  })

  // An older lock learns its length from the PIN that just opened it; the
  // verifier and its timestamp are carried through untouched.
  it('is learned by a lock made before it was stored', () => {
    const learned = withLearnedPinLength(CONFIG, 4)
    expect(learned).toEqual({ ...CONFIG, pinLength: 4 })
    expect(learned?.hash).toBe(CONFIG.hash)
    expect(learned?.updatedAt).toBe(CONFIG.updatedAt)
  })

  it('is not relearned when the lock already knows it', () => {
    expect(withLearnedPinLength({ ...CONFIG, pinLength: 4 }, 4)).toBeNull()
  })

  it('is never learned for a passphrase, or from a length the rules forbid', () => {
    expect(withLearnedPinLength({ ...CONFIG, kind: 'passphrase' }, 8)).toBeNull()
    expect(withLearnedPinLength(CONFIG, 12)).toBeNull()
  })
})
