import { describe, it, expect } from 'vitest'
import { shouldLock } from './appLockPolicy'
import { GRACE_ONLY_ON_LAUNCH, type AppLockConfig } from './appLock'

const NOW = 1_760_000_000_000

function config(graceSeconds: number): AppLockConfig {
  return {
    v: 1,
    kind: 'pin',
    salt: 'c2FsdA==',
    iterations: 1_000,
    hash: 'aGFzaA==',
    graceSeconds,
    biometric: false,
    updatedAt: '2026-08-17T00:00:00.000Z',
  }
}

/** Returning to the foreground after `awaySeconds`, with the lock configured
 *  to `graceSeconds`. */
function resume(graceSeconds: number, awaySeconds: number, suppressed = false) {
  return shouldLock({
    config: config(graceSeconds),
    coldStart: false,
    hiddenAtMs: NOW - awaySeconds * 1000,
    nowMs: NOW,
    suppressed,
  })
}

describe('shouldLock', () => {
  it('never locks when the lock is off', () => {
    expect(
      shouldLock({ config: null, coldStart: true, hiddenAtMs: null, nowMs: NOW, suppressed: false }),
    ).toBe(false)
    expect(
      shouldLock({
        config: null,
        coldStart: false,
        hiddenAtMs: NOW - 86_400_000,
        nowMs: NOW,
        suppressed: false,
      }),
    ).toBe(false)
  })

  // The case the whole feature exists for.
  it('locks on a cold start, whatever the grace period', () => {
    for (const grace of [0, 60, 300, 900, GRACE_ONLY_ON_LAUNCH]) {
      expect(
        shouldLock({
          config: config(grace),
          coldStart: true,
          hiddenAtMs: null,
          nowMs: NOW,
          suppressed: false,
        }),
      ).toBe(true)
    }
  })

  it('holds the lock open across the grace period and closes it after', () => {
    expect(resume(300, 299)).toBe(false)
    expect(resume(300, 300)).toBe(true)
    expect(resume(300, 301)).toBe(true)

    expect(resume(60, 59)).toBe(false)
    expect(resume(60, 61)).toBe(true)

    expect(resume(900, 899)).toBe(false)
    expect(resume(900, 901)).toBe(true)
  })

  it('locks on any return when the grace is zero', () => {
    expect(resume(0, 0)).toBe(true)
    expect(resume(0, 1)).toBe(true)
  })

  it('never re-locks on resume when set to only-on-launch', () => {
    expect(resume(GRACE_ONLY_ON_LAUNCH, 86_400)).toBe(false)
  })

  // OAuth, "Manage billing", the photo picker, the mic prompt — and Face ID,
  // which backgrounds the webview exactly like the rest. Locking here would
  // slam the door underneath our own biometric prompt.
  it('never locks on a trip the app started itself', () => {
    expect(resume(0, 120, true)).toBe(false)
    expect(resume(60, 3_600, true)).toBe(false)
  })

  // ...but a cold start still asks. Suppression is about a foreground round
  // trip, not about a relaunch.
  it('still locks on cold start even while suppressed', () => {
    expect(
      shouldLock({
        config: config(300),
        coldStart: true,
        hiddenAtMs: null,
        nowMs: NOW,
        suppressed: true,
      }),
    ).toBe(true)
  })

  it('does not lock when the app has never been backgrounded', () => {
    expect(
      shouldLock({
        config: config(0),
        coldStart: false,
        hiddenAtMs: null,
        nowMs: NOW,
        suppressed: false,
      }),
    ).toBe(false)
  })

  // A timezone change, an NTP correction, or someone setting the clock back to
  // outrun the timer. We can't tell how long they were really gone.
  it('fails closed when the clock moves backwards', () => {
    expect(resume(900, -60)).toBe(true)
    expect(resume(GRACE_ONLY_ON_LAUNCH, -60)).toBe(false) // only-on-launch still wins
  })
})
