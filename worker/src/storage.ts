import { timingSafeEqualString } from './safeEqual.ts'
import type { Env } from './env.ts'

export const ATTACHMENTS_BUCKET = 'attachments'
export const SIGNED_URL_TTL_S = 3600
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export function storageBackend(env: Pick<Env, 'STORAGE_BACKEND'>): 'r2' | 'supabase' {
  return env.STORAGE_BACKEND?.trim().toLowerCase() === 'r2' ? 'r2' : 'supabase'
}

/** Object keys are `<owner-uuid>/<sha256>.<ext>` — same as today's Supabase paths. */
export function ownerStorageKey(ownerId: string, storageKey: string): string | null {
  const prefix = `${ownerId}/`
  if (!storageKey.startsWith(prefix) || storageKey.includes('..') || storageKey.includes('//')) return null
  if (storageKey.slice(prefix.length).includes('/')) return null
  return storageKey
}

function tokenAlreadyInUrl(rel: string): boolean {
  try {
    if (rel.startsWith('http')) return new URL(rel).searchParams.has('token')
  } catch {
    // fall through to the query-string scan
  }
  return /(?:^|[?&])token=/.test(rel)
}

function appendTokenOnce(rel: string, token: string): string {
  if (!token || tokenAlreadyInUrl(rel)) return rel
  return `${rel}${rel.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
}

/** Build the upload URL. Never append `token=` when the path already has one. */
export function composeSupabaseUploadUrl(base: string, rel: string, token: string): string {
  const withToken = appendTokenOnce(rel, token)
  return withToken.startsWith('http') ? withToken : `${base}/storage/v1${withToken}`
}

export async function supabaseSign(
  env: Env,
  action: 'download' | 'upload',
  storageKey: string,
  transform?: { width?: number; quality?: number; resize?: string },
): Promise<{ signedUrl: string } | { error: string; status: number }> {
  const base = env.SUPABASE_URL?.trim().replace(/\/$/, '')
  const secret = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!base || !secret) return { error: 'storage not configured', status: 501 }
  const encoded = storageKey.split('/').map(encodeURIComponent).join('/')
  const path = action === 'upload'
    ? `/storage/v1/object/upload/sign/${ATTACHMENTS_BUCKET}/${encoded}`
    : `/storage/v1/object/sign/${ATTACHMENTS_BUCKET}/${encoded}`
  const body: Record<string, unknown> = { expiresIn: SIGNED_URL_TTL_S }
  if (action === 'download' && transform) body.transform = transform
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      apikey: secret,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = await res.json().catch(() => ({})) as {
    signedURL?: string
    signedUrl?: string
    url?: string
    token?: string
  }
  if (!res.ok) return { error: 'sign failed', status: 502 }
  if (action === 'upload') {
    return { signedUrl: composeSupabaseUploadUrl(base, payload.url ?? '', payload.token ?? '') }
  }
  const rel = payload.signedURL ?? payload.signedUrl ?? ''
  const signedUrl = rel.startsWith('http') ? rel : `${base}/storage/v1${rel}`
  return { signedUrl }
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
