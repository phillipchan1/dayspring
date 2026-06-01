// CORS for cross-origin calls from the Tauri desktop shell (tauri.localhost → dayspring.app).

const DESKTOP_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
const TAURI_ORIGIN_RE = /^https?:\/\/tauri\.localhost(:\d+)?$/

function isAllowedOrigin(origin: string): boolean {
  return DESKTOP_ORIGIN_RE.test(origin) || TAURI_ORIGIN_RE.test(origin)
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('Origin')
  if (!origin || !isAllowedOrigin(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}

export function preflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

export function withCors(req: Request, res: Response): Response {
  const headers = corsHeaders(req)
  if (!headers || Object.keys(headers).length === 0) return res
  const next = new Response(res.body, res)
  for (const [key, value] of Object.entries(headers)) {
    next.headers.set(key, value)
  }
  return next
}
