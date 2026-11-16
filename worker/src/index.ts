import { Hono } from 'hono'
import { API_CORS, API_SECURITY, beginAuthCors, json, webAuthOrigins } from './cors.ts'
import { sessionUser } from './auth.ts'
import { resolveAuthBaseURL } from './authUrl.ts'
import { NATIVE_FINISH_PATH, NATIVE_START_PATH, nativeFinish, nativeStart } from './nativeAuth.ts'
import { echoCallerBearer, stripGetSessionToken } from './sessionBody.ts'
import { CPU_HEAVY_ROUTES } from './cpuLimits.ts'
import type { Env } from './env.ts'
import { closeSql, createSql } from './db.ts'
import { CRON_PATHS, PORTED_ROUTES, openaiDirectConfigured, workerMailCronsOn, type PortedRoute } from './vercel/routes.ts'
import { authOf, finishRequest, sqlOf, type WorkerContext, type WorkerVars } from './request.ts'
import { timingSafeEqualString } from './safeEqual.ts'
import { UNSUBSCRIBE_PATH, verifyUnsubscribe } from '../../api/_lib/unsubscribe.ts'
import { buildSelfKick, KICK_HEADER, PROCESS_TICK_PATH } from './vercel/selfKick.ts'
import {
  deleteOwnedAccount,
  ensureProfile,
  extendTrialOnce,
  getEntry,
  getProfile,
  setAckedCompletion,
  listEntries,
  listEntriesSince,
  isBannerProcessingJob,
  listProcessingJobs,
  makeStore,
  deleteEntry,
  upsertAttachment,
  upsertEntryChecked,
} from './store.ts'
import { runDataQuery, type DataQuerySpec } from './dataQuery.ts'
import {
  declaredMime,
  deleteOwnedR2Objects,
  hashFromStorageKey,
  MAX_UPLOAD_BYTES,
  ownerStorageKey,
  sha256Hex,
  signR2Url,
  verifyR2Sig,
} from './storage.ts'

const app = new Hono<{ Bindings: Env; Variables: WorkerVars }>()

app.use('*', async (c, next) => {
  try {
    await next()
    const path = new URL(c.req.url).pathname
    if (path.startsWith('/api/')) {
      // Responses from ASSETS.fetch (and fetch() generally) have immutable
      // headers. Re-wrap once so unknown /api paths don't 500 here.
      if (!headersMutable(c.res)) c.res = new Response(c.res.body, c.res)
      for (const [key, value] of Object.entries(API_SECURITY)) {
        c.res.headers.set(key, value)
      }
      // Bearer-authed /api/* calls come cross-origin from the native apps
      // (tauri://localhost). The OPTIONS preflight already answers with
      // API_CORS; the real response needs Allow-Origin too or WebKit drops it
      // ("Load failed") and the app shows "We couldn't reach your account".
      // /api/auth/* and R2 objects set their own (credentialed) CORS — keep it.
      if (!path.startsWith('/api/auth/') && !c.res.headers.has('Access-Control-Allow-Origin')) {
        c.res.headers.set('Access-Control-Allow-Origin', API_CORS['Access-Control-Allow-Origin'])
      }
    }
  } finally {
    await finishRequest(c)
  }
})

function headersMutable(res: Response): boolean {
  try {
    res.headers.set('x-content-type-options', res.headers.get('x-content-type-options') ?? 'nosniff')
    return true
  } catch {
    return false
  }
}

function missingAsset(): Response {
  return new Response('Not found', {
    status: 404,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      ...API_SECURITY,
    },
  })
}

function cronAuthorized(req: Request, env: Env): boolean {
  const secret = env.CRON_SECRET?.trim()
  if (!secret) return false
  const header = req.headers.get('authorization') ?? ''
  return timingSafeEqualString(header, `Bearer ${secret}`)
}

async function requireUser(c: WorkerContext) {
  return sessionUser(authOf(c), c.req.raw)
}

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'dayspring',
    runtime: 'cloudflare-workers',
    cpu_heavy: CPU_HEAVY_ROUTES,
  }),
)

// Top-level navigations inside the native sign-in sheet — no Origin, no CORS.
// Registered before the /api/auth/* catch-all so Better Auth never sees them.
app.get(NATIVE_START_PATH, (c) => nativeStart(authOf(c), c.req.raw, resolveAuthBaseURL(c.env), webAuthOrigins(c.env)))
app.get(NATIVE_FINISH_PATH, (c) => nativeFinish(authOf(c), c.req.raw, webAuthOrigins(c.env)))

app.all('/api/auth/*', async (c) => {
  const started = beginAuthCors(c.req.header('Origin'), c.env)
  if (!started.ok) return started.response
  const cors = started.cors
  if (c.req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = authOf(c)
    const res = await stripGetSessionToken(await auth.handler(c.req.raw), new URL(c.req.url).pathname)
    const headers = new Headers(res.headers)
    echoCallerBearer(c.req.raw, res, headers)
    for (const [k, v] of Object.entries(cors)) {
      if (k === 'Access-Control-Allow-Origin' || !headers.has(k)) headers.set(k, v)
    }
    headers.delete('Access-Control-Allow-Credentials')
    if (cors['Access-Control-Allow-Credentials']) {
      headers.set('Access-Control-Allow-Credentials', 'true')
    }
    if (headers.get('Access-Control-Allow-Origin') === '*' && headers.get('Access-Control-Allow-Credentials') === 'true') {
      headers.set('Access-Control-Allow-Origin', cors['Access-Control-Allow-Origin'])
    }
    return new Response(res.body, { status: res.status, headers })
  } catch {
    return new Response(JSON.stringify({ error: 'authentication failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})

app.options('/api/*', () => new Response('ok', { headers: API_CORS }))

app.get('/api/data/entries', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const store = makeStore(sqlOf(c), user.id)
  const since = c.req.query('since')
  const entries = since ? await listEntriesSince(store, since) : await listEntries(store)
  return json({ entries })
})

app.get('/api/data/entries/:id', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const entry = await getEntry(makeStore(sqlOf(c), user.id), c.req.param('id'))
  if (!entry) return json({ error: 'not found' }, 404)
  return json({ entry })
})

app.post('/api/data/entries/upsert-checked', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const body = await c.req.json<{
    id: string
    created_at: string
    body_markdown: string
    title: string | null
    mood: string | null
    tags: string[]
    word_count: number
    source: string
    external_id: string | null
    base_updated_at: string | null
    circumstances: unknown
  }>()
  const result = await upsertEntryChecked(makeStore(sqlOf(c), user.id), body)
  return json(result)
})

app.get('/api/data/profile', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  return json({ profile: await getProfile(makeStore(sqlOf(c), user.id)) })
})

app.get('/api/data/jobs', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const jobs = (await listProcessingJobs(makeStore(sqlOf(c), user.id))).filter(isBannerProcessingJob)
  return json({
    jobs: jobs.map((job) => ({
      id: job.id,
      kind: job.kind,
      status: job.status,
      completed: job.completed,
      total: job.total,
      updated_at: job.updated_at,
    })),
  })
})

app.post('/api/profile/ensure', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const profile = await ensureProfile(makeStore(sqlOf(c), user.id))
  return json({ profile })
})

app.post('/api/profile/ack-completion', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const body = await c.req.json<{ key?: string }>()
  const key = typeof body.key === 'string' ? body.key.trim() : ''
  if (!key) return json({ error: 'key required' }, 400)
  await setAckedCompletion(makeStore(sqlOf(c), user.id), key)
  return json({ ok: true })
})

app.delete('/api/account/delete', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  await deleteOwnedAccount(makeStore(sqlOf(c), user.id))
  await deleteOwnedR2Objects(c.env.ATTACHMENTS, user.id)
  return json({ ok: true })
})

app.post('/api/data/query', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const spec = await c.req.json<DataQuerySpec>()
  const result = await runDataQuery(sqlOf(c), user.id, spec)
  return json(result)
})

app.delete('/api/data/entries/:id', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const ok = await deleteEntry(makeStore(sqlOf(c), user.id), c.req.param('id'))
  if (!ok) return json({ error: 'not found' }, 404)
  return json({ ok: true })
})

app.post('/api/trial/extend', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const result = await extendTrialOnce(makeStore(sqlOf(c), user.id))
  if (!result.ok) return json({ error: result.error }, result.status)
  return json({ trial_ends_at: result.trial_ends_at })
})

/** Copy string bindings onto process.env, which api/_lib/env.ts reads. Values are never logged. */
function bindPortEnv(env: Env): void {
  for (const [name, value] of Object.entries(env as unknown as Record<string, unknown>)) {
    if (typeof value === 'string') process.env[name] = value
  }
}

/**
 * Serve a Vercel handler (api/**) unchanged against Neon. See worker/src/vercel/.
 * Gates run first: AI text/vision/embeddings only through the ZDR gateway (fail
 * closed, never direct OpenAI), transcription direct to OpenAI as on Vercel, and
 * mail crons off until WORKER_MAIL_CRONS=on.
 */
async function servePorted(c: WorkerContext, route: PortedRoute): Promise<Response> {
  const isCron = route.path.startsWith('/api/cron/')
  if (isCron && !cronAuthorized(c.req.raw, c.env)) return json({ error: 'unauthorized' }, 401)
  if (route.gate === 'ai-gateway') {
    const { workerAiClient, workerAiGatewayReady } = await import('./ai.ts')
    if (!workerAiGatewayReady(c.env)) {
      return json({ error: 'AI_GATEWAY_ZDR is off or AI_GATEWAY_API_KEY is not set', route: `${route.method} ${route.path}` }, 501)
    }
    // Throws unless the gateway ZDR client can be built. The handler's own
    // createAiClient() then reads the same AI_GATEWAY_* names from process.env.
    workerAiClient(c.env)
  }
  if (route.gate === 'openai-direct' && !openaiDirectConfigured(c.env)) {
    return json({ error: 'transcription is not configured on this Worker' }, 501)
  }
  if (route.gate === 'mail' && !workerMailCronsOn(c.env.WORKER_MAIL_CRONS)) {
    // Vercel's cron still sends until the switch step that turns it off and sets WORKER_MAIL_CRONS=on.
    return json({ ok: true, skipped: 'WORKER_MAIL_CRONS is off' })
  }
  bindPortEnv(c.env)
  const [{ createPgRestClient, runVercelHandler }, handler] = await Promise.all([
    import('./vercel/bridge.ts'),
    route.load(),
  ])
  // Own connection: background work (waitUntil) can outlive the response, and
  // finishRequest closes the request's sqlOf(c) as soon as the response is sent.
  const sql = createSql(c.env)
  const auth = authOf(c)
  const pending: Promise<unknown>[] = []
  const client = createPgRestClient(sql, {
    resolveToken: async (token) => {
      const headers = new Headers({ authorization: `Bearer ${token}` })
      return (await sessionUser(auth, new Request(c.req.url, { headers })))?.id ?? null
    },
  })
  const kick = buildSelfKick({
    self: c.env.SELF ?? null,
    origin: c.env.BETTER_AUTH_URL?.trim() || new URL(c.req.url).origin,
    cronSecret: c.env.CRON_SECRET?.trim() || null,
  })
  const run = async (): Promise<Response> => {
    try {
      return await runVercelHandler(
        {
          client,
          waitUntil: (task) => {
            pending.push(Promise.resolve(task).catch((e) => {
              console.error(`[waitUntil] ${route.path} task failed: ${e instanceof Error ? e.message : String(e)}`)
            }))
          },
          kick,
          email: c.env.EMAIL ?? null,
          unsubscribeSecret: c.env.BETTER_AUTH_SECRET ?? null,
        },
        handler,
        c.req.raw,
      )
    } finally {
      const drain = (async () => {
        while (pending.length) await Promise.all(pending.splice(0))
        await closeSql(sql)
      })()
      await waitUntilOrAwait(c, drain)
    }
  }
  // A self-kick (selfKick.ts): answer 202 now and run the tick under this
  // invocation's own waitUntil, so the kicker never waits on the tick.
  if (isCron && route.path === PROCESS_TICK_PATH && c.req.header(KICK_HEADER) === '1') {
    const tick = run()
      .then(async (res) => {
        if (!res.ok) console.error(`[self-kick] kicked process-tick returned ${res.status}`)
        await res.body?.cancel().catch(() => undefined)
      })
      .catch((e) => {
        console.error(`[self-kick] kicked process-tick failed: ${e instanceof Error ? e.message : String(e)}`)
      })
    await waitUntilOrAwait(c, tick)
    return json({ ok: true, kicked: true }, 202)
  }
  return run()
}

/** ctx.waitUntil when there is an ExecutionContext (always on Workers); tests await instead. */
async function waitUntilOrAwait(c: WorkerContext, task: Promise<unknown>): Promise<void> {
  try {
    c.executionCtx.waitUntil(task)
  } catch {
    await task
  }
}

for (const route of PORTED_ROUTES) {
  if (route.method === 'POST') app.post(route.path, (c) => servePorted(c, route))
  // Vercel invokes crons with GET; POST kept for manual runs, as the stubs allowed.
  else app.on(['GET', 'POST'], route.path, (c) => servePorted(c, route))
}


async function r2Sign(
  env: Env,
  origin: string,
  action: 'download' | 'upload',
  storageKey: string,
  declared?: { mime?: string; bytes?: number },
): Promise<{ signedUrl: string } | { error: string; status: number }> {
  const secret = env.STORAGE_SIGNING_KEY?.trim()
  if (!secret) return { error: 'storage not configured', status: 501 }
  return signR2Url({
    origin,
    method: action === 'upload' ? 'PUT' : 'GET',
    key: storageKey,
    secret,
    mime: action === 'upload' ? declared?.mime : undefined,
    bytes: action === 'upload' ? declared?.bytes : undefined,
  })
}

app.post('/api/storage/sign', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const body = await c.req.json<{
    action?: string
    storageKey?: string
    hash?: string
    mime?: string
    bytes?: number
    transform?: { width?: number; quality?: number; resize?: string }
  }>()
  const storageKey = ownerStorageKey(user.id, String(body.storageKey ?? ''))
  if (!storageKey) return json({ error: 'forbidden key' }, 403)
  const action = body.action === 'upload' ? 'upload' : 'download'
  const signed = await r2Sign(c.env, new URL(c.req.url).origin, action, storageKey, {
    mime: body.mime,
    bytes: body.bytes,
  })
  if ('error' in signed) return json({ error: signed.error }, signed.status)
  if (action === 'upload' && body.hash) {
    await upsertAttachment(makeStore(sqlOf(c), user.id), {
      hash: body.hash,
      storage_key: storageKey,
      mime: body.mime ?? null,
      bytes: body.bytes ?? null,
    })
  }
  return json(signed)
})

function objectKeyFromParam(raw: string): string | null {
  let key = raw
  try {
    key = decodeURIComponent(raw)
  } catch {
    return null
  }
  if (!key || key.includes('..') || key.includes('//') || key.startsWith('/')) return null
  return key
}

async function serveR2Object(c: WorkerContext): Promise<Response> {
  const cors = API_CORS
  if (c.req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const key = objectKeyFromParam(c.req.param('key') ?? '')
  const secret = c.env.STORAGE_SIGNING_KEY?.trim()
  if (!key || !secret) return json({ error: 'forbidden' }, 403, cors)
  const url = new URL(c.req.url)
  const ok = await verifyR2Sig({
    method: c.req.method,
    key,
    exp: url.searchParams.get('exp'),
    sig: url.searchParams.get('sig'),
    secret,
    mime: url.searchParams.get('mime'),
    bytes: url.searchParams.get('bytes'),
  })
  if (!ok) return json({ error: 'forbidden' }, 403, cors)
  const bucket = c.env.ATTACHMENTS
  if (!bucket) return json({ error: 'storage not configured' }, 501, cors)

  if (c.req.method === 'GET') {
    const obj = await bucket.get(key)
    if (!obj) return json({ error: 'not found' }, 404, cors)
    const headers = new Headers(cors)
    headers.set('content-type', obj.httpMetadata?.contentType || 'application/octet-stream')
    headers.set('etag', obj.httpEtag)
    headers.set('cache-control', 'private, max-age=3600')
    headers.set('content-length', String(obj.size))
    return new Response(obj.body, { status: 200, headers })
  }

  if (c.req.method === 'PUT') {
    const mime = declaredMime(c.req.header('content-type') ?? undefined)
    if (!mime) return json({ error: 'content-type required' }, 400, cors)
    const declaredBytes = url.searchParams.get('bytes')
    const buf = await c.req.arrayBuffer()
    if (buf.byteLength > MAX_UPLOAD_BYTES) {
      return json({ error: 'too large' }, 413, cors)
    }
    if (declaredBytes != null && declaredBytes !== '') {
      const expected = Number(declaredBytes)
      if (!Number.isFinite(expected) || expected !== buf.byteLength) {
        return json({ error: 'bytes mismatch' }, 400, cors)
      }
    }
    const declared = url.searchParams.get('mime')
    if (declared && declared !== mime) return json({ error: 'mime mismatch' }, 400, cors)
    const expectedHash = hashFromStorageKey(key)
    if (expectedHash && (await sha256Hex(buf)) !== expectedHash) {
      return json({ error: 'hash mismatch' }, 400, cors)
    }
    await bucket.put(key, buf, { httpMetadata: { contentType: mime } })
    return new Response(null, { status: 200, headers: cors })
  }

  return json({ error: 'method not allowed' }, 405, cors)
}

app.on(['OPTIONS', 'GET', 'PUT'], '/api/storage/object/:key{.+}', (c) => serveR2Object(c))

function waitUntilOf(c: WorkerContext): (task: Promise<unknown>) => void {
  return (task) => {
    try {
      c.executionCtx.waitUntil(task)
    } catch {
      void task
    }
  }
}

// Dynamic import so Node strip-types checks that load `app` do not have to
// resolve api/_lib/apple.ts's .js imports (Vercel extension). Wrangler still bundles this.
async function billing() {
  const [
    { bindBillingEnv },
    { liveApple },
    { handleAppleWebhook },
    { handleStripeCheckout },
    { handleStripePortal },
    { handleStripeWebhook, stripeClientFromEnv },
    { handleAppleVerify },
    { handleRevenuecatWebhook },
  ] = await Promise.all([
    import('./billing/bindEnv.ts'),
    import('./billing/apple.ts'),
    import('./billing/appleWebhook.ts'),
    import('./billing/checkout.ts'),
    import('./billing/portal.ts'),
    import('./billing/stripeWebhook.ts'),
    import('./billing/verify.ts'),
    import('./billing/revenuecatWebhook.ts'),
  ])
  return {
    bindBillingEnv,
    liveApple,
    handleAppleWebhook,
    handleStripeCheckout,
    handleStripePortal,
    handleStripeWebhook,
    stripeClientFromEnv,
    handleAppleVerify,
    handleRevenuecatWebhook,
  }
}

app.post('/api/stripe/checkout', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const b = await billing()
  b.bindBillingEnv(c.env)
  const stripe = b.stripeClientFromEnv(c.env)
  return b.handleStripeCheckout(c.req.raw, sqlOf(c), c.env, user, stripe)
})

app.get('/api/stripe/portal', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const b = await billing()
  b.bindBillingEnv(c.env)
  const stripe = b.stripeClientFromEnv(c.env)
  return b.handleStripePortal(sqlOf(c), c.env, user, stripe)
})

app.post('/api/apple/verify', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const b = await billing()
  b.bindBillingEnv(c.env)
  return b.handleAppleVerify(c.req.raw, sqlOf(c), c.env, user, b.liveApple, waitUntilOf(c))
})

app.post('/api/webhooks/stripe', async (c) => {
  const b = await billing()
  b.bindBillingEnv(c.env)
  return b.handleStripeWebhook(c.req.raw, sqlOf(c), c.env, waitUntilOf(c))
})

app.post('/api/webhooks/apple', async (c) => {
  const b = await billing()
  b.bindBillingEnv(c.env)
  return b.handleAppleWebhook(c.req.raw, sqlOf(c), c.env, b.liveApple, waitUntilOf(c))
})

app.post('/api/webhooks/revenuecat', async (c) => {
  const b = await billing()
  b.bindBillingEnv(c.env)
  return b.handleRevenuecatWebhook(c.req.raw, sqlOf(c), c.env, waitUntilOf(c))
})

// One-click unsubscribe for Worker-sent mail (RFC 8058). GET shows a confirm
// button (link scanners prefetch GETs, so GET never writes); POST verifies the
// HMAC link and records the address in email_suppressions (worker/schema/0008).
const unsubscribePage = (title: string, body: string, form?: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>` +
  `<body style="font-family:Georgia,serif;max-width:520px;margin:3rem auto;padding:0 1.5rem;color:#2a2a2a"><h1 style="font-size:1.3rem">${title}</h1><p>${body}</p>${form ?? ''}</body></html>`

app.get(UNSUBSCRIBE_PATH, async (c) => {
  const email = await verifyUnsubscribe(c.req.query('e') ?? null, c.req.query('t') ?? null, c.env.BETTER_AUTH_SECRET ?? '')
  if (!email) return c.html(unsubscribePage('Link not valid', 'This unsubscribe link is not valid. Reply to any Dayspring email and we will take you off the list.'), 400)
  const qs = new URL(c.req.url).search.replace(/"/g, '')
  return c.html(unsubscribePage('Stop Dayspring emails?', 'You will stop getting reminder and welcome emails from Dayspring.',
    `<form method="post" action="${UNSUBSCRIBE_PATH}${qs}"><button type="submit" style="padding:0.6rem 1.2rem;background:#2a2a2a;color:#fff;border:0;border-radius:6px;font-size:0.95rem">Unsubscribe</button></form>`))
})

app.post(UNSUBSCRIBE_PATH, async (c) => {
  const email = await verifyUnsubscribe(c.req.query('e') ?? null, c.req.query('t') ?? null, c.env.BETTER_AUTH_SECRET ?? '')
  if (!email) return c.html(unsubscribePage('Link not valid', 'This unsubscribe link is not valid.'), 400)
  const sql = sqlOf(c)
  await sql`INSERT INTO public.email_suppressions (email, source) VALUES (${email}, 'one-click') ON CONFLICT (email) DO NOTHING`
  return c.html(unsubscribePage('You are unsubscribed', 'You will not get reminder or welcome emails from Dayspring.'))
})

app.get('/terms', (c) => fromAssets(c, '/legal/terms.html'))
app.get('/privacy', (c) => fromAssets(c, '/legal/privacy.html'))

function hasFileExtension(path: string): boolean {
  return /\.[A-Za-z0-9]{1,16}$/.test(path)
}

async function fromAssets(
  c: { env: Env; req: { raw: Request; url: string } },
  rewritePath?: string,
): Promise<Response> {
  const assets = c.env.ASSETS
  if (!assets) return missingAsset()
  const req = rewritePath
    ? new Request(new URL(rewritePath, c.req.url), c.req.raw)
    : c.req.raw
  const res = await assets.fetch(req)
  const path = new URL(rewritePath ? new URL(rewritePath, c.req.url).href : c.req.url).pathname
  const contentType = res.headers.get('content-type') ?? ''
  if (hasFileExtension(path) && (res.status === 404 || contentType.includes('text/html'))) {
    return missingAsset()
  }
  return res
}

app.all('/assets/*', (c) => fromAssets(c))
app.all('*', (c) => fromAssets(c))

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const url = CRON_PATHS[event.cron]
    if (!url) return
    // Pass ctx so the route's waitUntil work (and the per-request DB close) runs.
    ctx.waitUntil(Promise.resolve(app.fetch(new Request(`https://worker${url}`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET ?? ''}` },
    }), env, ctx)))
  },
}

export { app }
