// The app lock's credential: a PIN (or passphrase) the user sets once and that
// then guards Dayspring on every device they own.
//
// What this is, precisely: an ACCESS GATE ON THE UI. It is not encryption, and
// nothing here makes the entries themselves any less readable server-side than
// they already are (D-011 — no end-to-end encryption; Principle 7 — say so
// plainly). What it buys is that someone who picks up an unlocked laptop or
// phone can't read the journal. That is the whole claim, and the copy around
// this must not imply more.
//
// The verifier — salt, iteration count and hash, never the secret — lives on
// `profiles.app_lock` so one PIN set on the Mac is the same PIN on the iPhone.
// Storing it account-side rather than device-side is what makes that true, and
// it costs nothing against the threat model: anyone who can read that row is
// already holding the session that reads the entries.

/** PIN or passphrase — the same machinery either way, kept only so the UI can
 *  show the right keypad and the right validation message. */
export type AppLockKind = 'pin' | 'passphrase'

/** `graceSeconds` sentinel: never re-lock on resume, only on a cold launch. */
export const GRACE_ONLY_ON_LAUNCH = -1

/** The values the settings picker offers, in order. */
export const GRACE_CHOICES: readonly { seconds: number; label: string }[] = [
  { seconds: 0, label: 'Immediately' },
  { seconds: 60, label: 'After 1 minute' },
  { seconds: 300, label: 'After 5 minutes' },
  { seconds: 900, label: 'After 15 minutes' },
  { seconds: GRACE_ONLY_ON_LAUNCH, label: 'Only when I open Dayspring' },
]

export const DEFAULT_GRACE_SECONDS = 300

export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 8
export const PASSPHRASE_MIN_LENGTH = 6

/**
 * PBKDF2 rounds.
 *
 * Deliberately not chosen for cryptographic headroom: a 4–8 digit PIN is
 * exhaustible at any iteration count by someone who already holds the verifier,
 * and someone who holds the verifier holds the session too. So this is picked
 * for *feel* — high enough to be unembarrassing, low enough that unlocking on a
 * phone is instant. If it ever measures slow on device, lowering it is safe;
 * `iterations` is stored per-config, so existing locks keep verifying with the
 * number they were made with.
 */
export const PBKDF2_ITERATIONS = 210_000

const SALT_BYTES = 16
const HASH_BITS = 256

export type AppLockConfig = {
  v: 1
  kind: AppLockKind
  /** base64, 16 random bytes */
  salt: string
  iterations: number
  /** base64, PBKDF2-SHA256 → 32 bytes */
  hash: string
  /** Seconds away before a resume demands the secret. See GRACE_ONLY_ON_LAUNCH. */
  graceSeconds: number
  /** iOS only: the user opted into Face ID as a shortcut past typing the PIN. */
  biometric: boolean
  updatedAt: string
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Derive the verifier bytes for `secret` against a given salt and round count.
 *
 * `crypto.subtle` is available in every surface this ships to — the WKWebView
 * serves from a `localhost` origin, which is a secure context, and
 * `lib/attachments.ts` has been hashing attachments through the same API on iOS
 * for months.
 */
async function derive(secret: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    HASH_BITS,
  )
  return new Uint8Array(bits)
}

/** Build a fresh verifier for `secret`. The secret itself is never returned,
 *  stored, or sent anywhere. */
export async function createLock(
  secret: string,
  options: {
    kind: AppLockKind
    graceSeconds?: number
    biometric?: boolean
    iterations?: number
  },
): Promise<AppLockConfig> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iterations = options.iterations ?? PBKDF2_ITERATIONS
  const hash = await derive(secret, salt, iterations)
  return {
    v: 1,
    kind: options.kind,
    salt: toBase64(salt),
    iterations,
    hash: toBase64(hash),
    graceSeconds: options.graceSeconds ?? DEFAULT_GRACE_SECONDS,
    biometric: options.biometric ?? false,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Check `secret` against a stored verifier.
 *
 * The compare accumulates differences across the whole buffer rather than
 * returning at the first mismatch — a timing side channel is not a plausible
 * attack on a lock screen someone is holding in their hand, but writing the
 * short-circuiting version and then explaining why it's fine is worse than just
 * not writing it.
 */
export async function verifyLock(config: AppLockConfig, secret: string): Promise<boolean> {
  let expected: Uint8Array
  let actual: Uint8Array
  try {
    expected = fromBase64(config.hash)
    actual = await derive(secret, fromBase64(config.salt), config.iterations)
  } catch {
    // Malformed config — a hand-edited row, or a shape from a future version.
    // Refusing is right: we cannot confirm the secret, so we must not open.
    return false
  }
  if (expected.length !== actual.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected[i]! ^ actual[i]!
  return diff === 0
}

/**
 * True when `value` is a config this build knows how to verify against.
 *
 * Used on everything read back from the server or from the local mirror. An
 * unrecognised shape must not be treated as "no lock" — see `appLockStore`,
 * which keeps the user gated rather than opening on a parse failure.
 */
export function isAppLockConfig(value: unknown): value is AppLockConfig {
  if (!value || typeof value !== 'object') return false
  const c = value as Partial<AppLockConfig>
  return (
    c.v === 1 &&
    (c.kind === 'pin' || c.kind === 'passphrase') &&
    typeof c.salt === 'string' &&
    typeof c.hash === 'string' &&
    typeof c.iterations === 'number' &&
    c.iterations > 0 &&
    typeof c.graceSeconds === 'number'
  )
}

/** Whether a candidate secret is well-formed for its kind. Returns the reason
 *  it isn't, so the UI has something to say. */
export function validateSecret(kind: AppLockKind, secret: string): string | null {
  if (kind === 'pin') {
    if (!/^\d*$/.test(secret)) return 'Digits only.'
    if (secret.length < PIN_MIN_LENGTH || secret.length > PIN_MAX_LENGTH) {
      return `Choose ${PIN_MIN_LENGTH} to ${PIN_MAX_LENGTH} digits.`
    }
    return null
  }
  if (secret.length < PASSPHRASE_MIN_LENGTH) {
    return `At least ${PASSPHRASE_MIN_LENGTH} characters.`
  }
  return null
}
