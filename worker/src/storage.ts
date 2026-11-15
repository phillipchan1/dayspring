import { timingSafeEqualString } from './safeEqual.ts'
import type { Env } from './env.ts'

export const ATTACHMENTS_BUCKET = 'attachments'
export const SIGNED_URL_TTL_S = 3600
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

/**
 * Attachments are always R2 (`ATTACHMENTS` binding). `STORAGE_BACKEND` is
 * ignored when present so existing wrangler vars stay harmless.
 */
export function storageBackend(_env?: Pick<Env, 'STORAGE_BACKEND'>): 'r2' {
  return 'r2'
}

/** Object keys are `<owner-uuid>/<sha256>.<ext>`. */
export function ownerStorageKey(ownerId: string, storageKey: string): string | null {
  const prefix = `${ownerId}/`
  if (!storageKey.startsWith(prefix) || storageKey.includes('..') || storageKey.includes('//')) return null
  if (storageKey.slice(prefix.length).includes('/')) return null
  return storageKey
}

function signPayload(
  method: string,
  key: string,
  exp: number,
  mime?: string,
  bytes?: number,
): string {
  let payload = `${method}\n${key}\n${exp}`
  if (mime) payload += `\n${mime}`
  if (bytes != null && Number.isFinite(bytes)) payload += `\n${bytes}`
  return payload
}

async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(payload))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function encodeObjectPath(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}

export async function signR2Url(opts: {
  origin: string
  method: 'GET' | 'PUT'
  key: string
  secret: string
  nowSec?: number
  mime?: string
  bytes?: number
}): Promise<{ signedUrl: string }> {
  const nowSec = opts.nowSec ?? Math.floor(Date.now() / 1000)
  const exp = nowSec + SIGNED_URL_TTL_S
  const mime = opts.mime?.trim() || undefined
  const bytes = opts.bytes
  const sig = await hmacHex(opts.secret, signPayload(opts.method, opts.key, exp, mime, bytes))
  const query = new URLSearchParams()
  query.set('exp', String(exp))
  query.set('sig', sig)
  if (mime) query.set('mime', mime)
  if (bytes != null && Number.isFinite(bytes)) query.set('bytes', String(bytes))
  return {
    signedUrl: `${opts.origin.replace(/\/$/, '')}/api/storage/object/${encodeObjectPath(opts.key)}?${query}`,
  }
}

export async function verifyR2Sig(opts: {
  method: string
  key: string
  exp: string | null
  sig: string | null
  secret: string
  nowSec?: number
  mime?: string | null
  bytes?: string | null
}): Promise<boolean> {
  if (!opts.sig || !opts.exp) return false
  const exp = Number(opts.exp)
  const nowSec = opts.nowSec ?? Math.floor(Date.now() / 1000)
  if (!Number.isFinite(exp) || exp < nowSec) return false
  const mime = opts.mime?.trim() || undefined
  const bytesRaw = opts.bytes
  const bytes = bytesRaw != null && bytesRaw !== '' ? Number(bytesRaw) : undefined
  if (bytes != null && !Number.isFinite(bytes)) return false
  const expected = await hmacHex(opts.secret, signPayload(opts.method, opts.key, exp, mime, bytes))
  return timingSafeEqualString(opts.sig, expected)
}

const HASH_IN_KEY = /^[^/]+\/([a-f0-9]{64})\.[a-z0-9]+$/i

export function hashFromStorageKey(key: string): string | null {
  const match = HASH_IN_KEY.exec(key)
  return match?.[1]?.toLowerCase() ?? null
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function declaredMime(header: string | undefined): string | null {
  const mime = header?.split(';')[0]?.trim()
  return mime || null
}

const R2_LIST_PAGE = 1000

/** Paginated list-then-delete of every object under `<ownerId>/`. */
export async function deleteOwnedR2Objects(
  bucket: R2Bucket | undefined,
  ownerId: string,
): Promise<void> {
  if (!bucket) return
  const prefix = `${ownerId}/`
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix, cursor, limit: R2_LIST_PAGE })
    const keys = page.objects.map((obj) => obj.key)
    if (keys.length > 0) await bucket.delete(keys)
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
}
