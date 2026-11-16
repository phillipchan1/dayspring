/** Drop the raw DB session token from Better Auth get-session JSON. */
export async function stripGetSessionToken(res: Response, pathname: string): Promise<Response> {
  if (!pathname.endsWith('/get-session')) return res
  const type = res.headers.get('content-type') ?? ''
  if (!type.includes('json')) return res
  let body: unknown
  try {
    body = await res.json()
  } catch {
    return new Response(null, { status: res.status, statusText: res.statusText, headers: res.headers })
  }
  if (body && typeof body === 'object') {
    const session = (body as { session?: unknown }).session
    if (session && typeof session === 'object' && session !== null && 'token' in session) {
      delete (session as { token?: unknown }).token
    }
  }
  const headers = new Headers(res.headers)
  headers.delete('content-length')
  return new Response(JSON.stringify(body), { status: res.status, statusText: res.statusText, headers })
}

const ENDS_SESSION = /\/(sign-out|revoke-session|revoke-sessions|revoke-other-sessions|delete-user)$/

/**
 * Echo the caller's own signed bearer as `set-auth-token` on successful auth
 * responses that did not mint a new one.
 *
 * Native builds up to 1.0.1357 store whatever `set-auth-token` a Better Auth
 * response carries — and erase the stored bearer when the header is absent,
 * which Better Auth does on get-session. They signed themselves out right after
 * sign-in. Echoing the bearer they just sent keeps them signed in. It reveals
 * nothing the caller does not already hold. Not on endpoints that end the
 * session.
 */
export function echoCallerBearer(req: Request, res: Response, headers: Headers): void {
  if (!res.ok || headers.has('set-auth-token')) return
  if (ENDS_SESSION.test(new URL(req.url).pathname)) return
  const auth = req.headers.get('authorization') ?? ''
  const match = /^Bearer\s+([^\s.]+\.[^\s.]+)$/i.exec(auth.trim())
  if (!match) return
  headers.set('set-auth-token', match[1]!)
  const exposed = new Set((headers.get('access-control-expose-headers') ?? '').split(',').map((h) => h.trim()).filter(Boolean))
  exposed.add('set-auth-token')
  headers.set('Access-Control-Expose-Headers', [...exposed].join(', '))
}
