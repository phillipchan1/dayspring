/**
 * Constant-time string compare for secrets (cron bearer, etc.).
 * Pads to a shared length so a length mismatch does not take a faster path.
 */
export function timingSafeEqualString(left: string, right: string): boolean {
  const enc = new TextEncoder()
  const a = enc.encode(left)
  const b = enc.encode(right)
  const len = Math.max(a.byteLength, b.byteLength, 1)
  const pa = new Uint8Array(len)
  const pb = new Uint8Array(len)
  pa.set(a)
  pb.set(b)
  const sameLength = a.byteLength === b.byteLength
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?(x: BufferSource, y: BufferSource): boolean
  }
  if (typeof subtle.timingSafeEqual === 'function') {
    return subtle.timingSafeEqual(pa, pb) && sameLength
  }
  let diff = sameLength ? 0 : 1
  for (let i = 0; i < len; i++) diff |= pa[i]! ^ pb[i]!
  return diff === 0
}
