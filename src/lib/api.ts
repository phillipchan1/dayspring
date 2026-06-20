import { env } from './env'
import { requireSupabase } from './supabase'

/** Resolve a serverless API path for web (same-origin) or desktop (Vercel prod). */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  const base = env.apiBaseUrl
  if (!base) return normalized
  return `${base.replace(/\/$/, '')}${normalized}`
}

/**
 * POST JSON to a user-authed `/api/*` endpoint, attaching the current Supabase
 * access token as a Bearer (the server validates it via getAuthedUser). Throws
 * on a non-2xx response.
 */
export async function apiPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not signed in')

  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${path} → ${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}

/**
 * POST multipart/form-data to a user-authed `/api/*` endpoint (e.g. an audio
 * blob for transcription). Don't set Content-Type — the browser adds the
 * multipart boundary. Throws on a non-2xx response.
 */
export async function apiPostForm<T = unknown>(path: string, form: FormData): Promise<T> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not signed in')

  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { authorization: `Bearer ${session.access_token}` },
    body: form,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${path} → ${res.status} ${text}`)
  }
  return res.json() as Promise<T>
}
