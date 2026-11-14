// One-click unsubscribe links for Worker-sent mail (RFC 8058).
// A link carries the address and an HMAC of it, keyed by BETTER_AUTH_SECRET with a
// purpose label, so only addresses we mailed can be suppressed through it. The
// Worker route /api/email/unsubscribe verifies the token and writes
// public.email_suppressions (worker/schema/0008). Vercel does not use this.

export const UNSUBSCRIBE_BASE = 'https://api.usedayspring.app'
export const UNSUBSCRIBE_PATH = '/api/email/unsubscribe'
export const UNSUBSCRIBE_MAILTO = 'mailto:hello@usedayspring.app?subject=unsubscribe'
const LABEL = 'dayspring-unsubscribe-v1:'

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): string {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(pad)
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(LABEL + msg))))
}

export async function unsubscribeUrl(email: string, secret: string, base = UNSUBSCRIBE_BASE): Promise<string> {
  const e = normalizeEmail(email)
  const t = await hmac(secret, e)
  return `${base}${UNSUBSCRIBE_PATH}?e=${b64url(new TextEncoder().encode(e))}&t=${t}`
}

/** The verified, normalized address for a link's e/t pair, or null. */
export async function verifyUnsubscribe(e: string | null, t: string | null, secret: string): Promise<string | null> {
  if (!e || !t || !secret) return null
  let email: string
  try {
    email = normalizeEmail(fromB64url(e))
  } catch {
    return null
  }
  if (!email.includes('@') || email.length > 320) return null
  const want = await hmac(secret, email)
  if (want.length !== t.length) return null
  let diff = 0
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ t.charCodeAt(i)
  return diff === 0 ? email : null
}

/** Headers for a Worker send: one-click https (when a secret exists) plus mailto. */
export async function listUnsubscribeHeaders(email: string, secret: string | undefined | null): Promise<{ url: string; headers: Record<string, string> }> {
  if (!secret) {
    return { url: UNSUBSCRIBE_MAILTO, headers: { 'List-Unsubscribe': `<${UNSUBSCRIBE_MAILTO}>` } }
  }
  const url = await unsubscribeUrl(email, secret)
  return {
    url,
    headers: {
      'List-Unsubscribe': `<${url}>, <${UNSUBSCRIBE_MAILTO}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  }
}
