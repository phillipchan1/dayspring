// CORS for cross-origin calls from the Tauri desktop shell → Vercel /api/*.

/** Tauri v2 serves bundled assets from http(s)://*.localhost (e.g. asset.localhost). */
function isAllowedOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname.endsWith('.localhost')
  } catch {
    return false
  }
}

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('Origin')
  if (!origin || !isAllowedOrigin(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
