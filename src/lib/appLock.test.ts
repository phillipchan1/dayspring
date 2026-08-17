import { describe, it, expect } from 'vitest'
import {
  createLock,
  verifyLock,
  isAppLockConfig,
  validateSecret,
  GRACE_ONLY_ON_LAUNCH,
  type AppLockConfig,
} from './appLock'

// PBKDF2 at the shipping round count is ~0.2s a call and these tests make a lot
// of calls. The round count is stored per-config and verification reads it back
// from there, so exercising the machinery at 1_000 proves exactly the same
// thing several seconds faster.
const FAST = { iterations: 1_000 } as const

describe('createLock / verifyLock', () => {
  it('verifies the secret it was made from', async () => {
    const lock = await createLock('4821', { kind: 'pin', ...FAST })
    expect(await verifyLock(lock, '4821')).toBe(true)
  })

  it('rejects a wrong secret', async () => {
    const lock = await createLock('4821', { kind: 'pin', ...FAST })
    expect(await verifyLock(lock, '4822')).toBe(false)
    expect(await verifyLock(lock, '482')).toBe(false)
    expect(await verifyLock(lock, '')).toBe(false)
  })

  it('verifies a passphrase the same way', async () => {
    const lock = await createLock('the dayspring from on high', { kind: 'passphrase', ...FAST })
    expect(await verifyLock(lock, 'the dayspring from on high')).toBe(true)
    expect(await verifyLock(lock, 'The dayspring from on high')).toBe(false)
  })

  // Two people picking 1234 — or one person re-setting the same PIN — must not
  // produce the same stored bytes.
  it('salts each lock separately', async () => {
    const a = await createLock('1234', { kind: 'pin', ...FAST })
    const b = await createLock('1234', { kind: 'pin', ...FAST })
    expect(a.salt).not.toBe(b.salt)
    expect(a.hash).not.toBe(b.hash)
    expect(await verifyLock(a, '1234')).toBe(true)
    expect(await verifyLock(b, '1234')).toBe(true)
  })

  it('never stores the secret', async () => {
    const lock = await createLock('4821', { kind: 'pin', ...FAST })
    expect(JSON.stringify(lock)).not.toContain('4821')
  })

  it('carries the grace period and biometric opt-in it was given', async () => {
    const lock = await createLock('4821', {
      kind: 'pin',
      graceSeconds: GRACE_ONLY_ON_LAUNCH,
      biometric: true,
      ...FAST,
    })
    expect(lock.graceSeconds).toBe(GRACE_ONLY_ON_LAUNCH)
    expect(lock.biometric).toBe(true)
  })

  it('defaults to a 5 minute grace and no biometrics', async () => {
    const lock = await createLock('4821', { kind: 'pin', ...FAST })
    expect(lock.graceSeconds).toBe(300)
    expect(lock.biometric).toBe(false)
  })

  // A config whose stored bytes are garbage must not open the app. Failing
  // closed is the only safe direction: we cannot confirm the secret.
  it('refuses a corrupted config rather than throwing', async () => {
    const lock = await createLock('4821', { kind: 'pin', ...FAST })
    expect(await verifyLock({ ...lock, hash: 'not base64 !!' }, '4821')).toBe(false)
    expect(await verifyLock({ ...lock, salt: 'not base64 !!' }, '4821')).toBe(false)
    expect(await verifyLock({ ...lock, hash: '' }, '4821')).toBe(false)
  })

  it('verifies against the round count the lock was made with', async () => {
    const lock = await createLock('4821', { kind: 'pin', iterations: 2_000 })
    expect(lock.iterations).toBe(2_000)
    expect(await verifyLock(lock, '4821')).toBe(true)
    // Same secret, different rounds → different bytes, so a config whose
    // iteration count has been tampered with stops verifying.
    expect(await verifyLock({ ...lock, iterations: 3_000 }, '4821')).toBe(false)
  })
})

describe('isAppLockConfig', () => {
  it('accepts a freshly built config', async () => {
    const lock = await createLock('4821', { kind: 'pin', ...FAST })
    expect(isAppLockConfig(lock)).toBe(true)
  })

  it('rejects anything that is not a v1 config', () => {
    expect(isAppLockConfig(null)).toBe(false)
    expect(isAppLockConfig(undefined)).toBe(false)
    expect(isAppLockConfig({})).toBe(false)
    expect(isAppLockConfig('4821')).toBe(false)
    expect(isAppLockConfig({ v: 2, kind: 'pin' })).toBe(false)
  })

  it('rejects a config missing the pieces verification needs', async () => {
    const lock = (await createLock('4821', { kind: 'pin', ...FAST })) as Partial<AppLockConfig>
    expect(isAppLockConfig({ ...lock, salt: undefined })).toBe(false)
    expect(isAppLockConfig({ ...lock, hash: undefined })).toBe(false)
    expect(isAppLockConfig({ ...lock, iterations: 0 })).toBe(false)
    expect(isAppLockConfig({ ...lock, kind: 'fingerprint' })).toBe(false)
  })
})

describe('validateSecret', () => {
  it('accepts 4 to 8 digits', () => {
    expect(validateSecret('pin', '4821')).toBeNull()
    expect(validateSecret('pin', '48213')).toBeNull()
    expect(validateSecret('pin', '48213576')).toBeNull()
  })

  it('rejects PINs that are too short or too long', () => {
    expect(validateSecret('pin', '482')).not.toBeNull()
    expect(validateSecret('pin', '482135768')).not.toBeNull()
    expect(validateSecret('pin', '')).not.toBeNull()
  })

  it('rejects non-digits in a PIN', () => {
    expect(validateSecret('pin', '48a1')).not.toBeNull()
    expect(validateSecret('pin', '48 1')).not.toBeNull()
  })

  it('holds a passphrase to a length floor only', () => {
    expect(validateSecret('passphrase', 'dayspring')).toBeNull()
    expect(validateSecret('passphrase', 'short')).not.toBeNull()
  })
})
