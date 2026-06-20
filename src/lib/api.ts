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

export interface SSEHandlers {
  /** A streamed partial chunk (e.g. a transcript delta). */
  onDelta?: (delta: string) => void
  /** The terminal payload once the server finishes. */
  onFinal?: (data: Record<string, unknown>) => void
  /** A server-emitted error event. */
  onError?: (message: string) => void
}

/**
 * POST multipart/form-data to a user-authed `/api/*` endpoint that responds with
 * Server-Sent Events, dispatching `delta` / `final` / `error` events to the
 * handlers. Resolves when the stream closes. Used for progressive transcription.
 */
export async function apiPostFormStream(
  path: string,
  form: FormData,
  handlers: SSEHandlers,
): Promise<void> {
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
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`${path} → ${res.status} ${text}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    // SSE frames are separated by a blank line.
    let sep: number
    while ((sep = buf.indexOf('\n\n')) !== -1) {
      const frame = buf.slice(0, sep)
      buf = buf.slice(sep + 2)
      let event = 'message'
      let data = ''
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue
      let parsed: Record<string, unknown>
      try {
        parsed = JSON.parse(data) as Record<string, unknown>
      } catch {
        continue
      }
      if (event === 'delta') handlers.onDelta?.(String(parsed.delta ?? ''))
      else if (event === 'final') handlers.onFinal?.(parsed)
      else if (event === 'error') handlers.onError?.(String(parsed.error ?? 'stream error'))
    }
  }
}
