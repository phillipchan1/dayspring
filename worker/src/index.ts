import { Hono } from 'hono'
import { API_CORS, API_SECURITY, beginAuthCors, json } from './cors.ts'
import { getAuth, sessionUser } from './auth.ts'
import { CPU_HEAVY_ROUTES, cpuHeavyPayload } from './cpuLimits.ts'
import { getSql } from './db.ts'
import type { Env } from './env.ts'
import { welcomeDripSendsEnabled } from './env.ts'
import {
  deleteOwnedAccount,
  enrollWelcomeDrip,
  getEntry,
  getProfile,
  listEntries,
  listEntriesSince,
  listProcessingJobs,
  makeStore,
  upsertEntryChecked,
  upsertProfile,
} from './store.ts'

const app = new Hono<{ Bindings: Env }>()

app.use('*', async (c, next) => {
  await next()
  const path = new URL(c.req.url).pathname
  if (path.startsWith('/api/')) {
    for (const [key, value] of Object.entries(API_SECURITY)) {
      c.res.headers.set(key, value)
    }
  }
})

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
  return header === `Bearer ${secret}`
}

async function requireUser(c: { env: Env; req: { raw: Request } }) {
  return sessionUser(c.env, c.req.raw)
}

app.get('/api/health', (c) =>
  c.json({
    ok: true,
    service: 'dayspring',
    runtime: 'cloudflare-workers',
    cpu_heavy: CPU_HEAVY_ROUTES,
  }),
)

app.all('/api/auth/*', async (c) => {
  const started = beginAuthCors(c.req.header('Origin'), c.env)
  if (!started.ok) return started.response
  const cors = started.cors
  if (c.req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const auth = getAuth(c.env)
    const res = await auth.handler(c.req.raw)
    const headers = new Headers(res.headers)
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})

app.options('/api/*', () => new Response('ok', { headers: API_CORS }))

app.get('/api/data/entries', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const store = makeStore(getSql(c.env), user.id)
  const since = c.req.query('since')
  const entries = since ? await listEntriesSince(store, since) : await listEntries(store)
  return json({ entries })
})

app.get('/api/data/entries/:id', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const entry = await getEntry(makeStore(getSql(c.env), user.id), c.req.param('id'))
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
  const result = await upsertEntryChecked(makeStore(getSql(c.env), user.id), body)
  return json(result)
})

app.get('/api/data/profile', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  return json({ profile: await getProfile(makeStore(getSql(c.env), user.id)) })
})

app.get('/api/data/jobs', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  return json({ jobs: await listProcessingJobs(makeStore(getSql(c.env), user.id)) })
})

app.post('/api/profile/ensure', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const store = makeStore(getSql(c.env), user.id)
  const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
  const profile = await upsertProfile(store, {
    plan: 'trialing',
    plan_source: 'app',
    trial_ends_at: trialEnds,
  })
  await enrollWelcomeDrip(store, 'signup')
  return json({ profile })
})

app.delete('/api/account/delete', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  await deleteOwnedAccount(makeStore(getSql(c.env), user.id))
  return json({ ok: true })
})

app.post('/api/processing/enqueue', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  return json({ ok: true, queued: true })
})

app.post('/api/trial/extend', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  const store = makeStore(getSql(c.env), user.id)
  const current = await getProfile(store)
  const base = current?.trial_ends_at ? new Date(current.trial_ends_at).getTime() : Date.now()
  const profile = await upsertProfile(store, {
    trial_ends_at: new Date(base + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
  return json({ profile })
})

function llmOr501(c: { env: Env }, route: string): Response {
  if (!c.env.OPENAI_API_KEY) {
    return json({ error: 'OPENAI_API_KEY is not set', ...cpuHeavyPayload(route) }, 501)
  }
  return json({ error: 'not implemented on Workers Free', ...cpuHeavyPayload(route) }, 501)
}

app.post('/api/ask', (c) => llmOr501(c, 'POST /api/ask'))
app.post('/api/keeping/read', (c) => llmOr501(c, 'POST /api/keeping/read'))
app.post('/api/pages/interpret', (c) => llmOr501(c, 'POST /api/pages/interpret'))
app.post('/api/transcribe', (c) => llmOr501(c, 'POST /api/transcribe'))
app.post('/api/transcribe-image', (c) => llmOr501(c, 'POST /api/transcribe-image'))
app.post('/api/onboarding/backfill', (c) => llmOr501(c, 'POST /api/onboarding/backfill'))
app.post('/api/spiritual/notice', (c) => llmOr501(c, 'POST /api/spiritual/notice'))
app.post('/api/reflections/generate', (c) => llmOr501(c, 'POST /api/reflections/generate'))
app.post('/api/concordance/rebuild', (c) => llmOr501(c, 'POST /api/concordance/rebuild'))

app.post('/api/spiritual/scripture', (c) => json({ error: 'ESV stays on Vercel until cutover', configured: Boolean(c.env.ESV_API_KEY) }, 501))
app.post('/api/spiritual/scripture-resolve', () => json({ error: 'ESV stays on Vercel until cutover' }, 501))
app.post('/api/spiritual/scripture-chapter', () => json({ error: 'ESV stays on Vercel until cutover' }, 501))
app.post('/api/circumstances/snap', () => json({ error: 'geocode stays on Vercel until cutover' }, 501))
app.post('/api/realtime-token', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  return json({ error: 'OpenAI realtime stays on Vercel until cutover' }, 501)
})
app.post('/api/feedback', async (c) => {
  const user = await requireUser(c)
  if (!user) return json({ error: 'not authenticated' }, 401)
  return json({ error: 'feedback stays on Vercel until cutover' }, 501)
})

app.post('/api/stripe/checkout', () => json({ error: 'billing stays on Vercel; do not move webhooks' }, 501))
app.get('/api/stripe/portal', () => json({ error: 'billing stays on Vercel; do not move webhooks' }, 501))
app.post('/api/apple/verify', () => json({ error: 'StoreKit stays on Vercel; do not move webhooks' }, 501))
app.post('/api/webhooks/stripe', () => json({ error: 'billing webhook stays on Vercel' }, 501))
app.post('/api/webhooks/apple', () => json({ error: 'StoreKit webhook stays on Vercel' }, 501))
app.post('/api/webhooks/revenuecat', () => json({ error: 'billing webhook stays on Vercel' }, 501))

app.all('/api/cron/welcome-drip', async (c) => {
  if (!cronAuthorized(c.req.raw, c.env)) return json({ error: 'unauthorized' }, 401)
  const sql = getSql(c.env)
  const enrolled = await sql<{ owner: string; status: string }[]>`
    SELECT owner, status FROM welcome_drip_enrollments WHERE status = 'active'
  `
  return json({
    ok: true,
    evaluated: enrolled.length,
    sends_enabled: welcomeDripSendsEnabled(c.env),
  })
})

app.all('/api/cron/remind', async (c) => {
  if (!cronAuthorized(c.req.raw, c.env)) return json({ error: 'unauthorized' }, 401)
  const sql = getSql(c.env)
  const due = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM reminders WHERE fired = FALSE AND remind_at <= NOW()
  `
  return json({ ok: true, due: due[0]?.n ?? 0 })
})

app.all('/api/cron/sync-resend', async (c) => {
  if (!cronAuthorized(c.req.raw, c.env)) return json({ error: 'unauthorized' }, 401)
  return json({ ok: true, skipped: !c.env.RESEND_API_KEY })
})

app.all('/api/cron/synthesize', (c) => {
  if (!cronAuthorized(c.req.raw, c.env)) return json({ error: 'unauthorized' }, 401)
  return json({ ok: false, ...cpuHeavyPayload('GET|POST /api/cron/synthesize') }, 501)
})

app.all('/api/cron/process-tick', (c) => {
  if (!cronAuthorized(c.req.raw, c.env)) return json({ error: 'unauthorized' }, 401)
  return json({ ok: false, ...cpuHeavyPayload('GET|POST /api/cron/process-tick') }, 501)
})

app.all('/api/cron/echoes', (c) => {
  if (!cronAuthorized(c.req.raw, c.env)) return json({ error: 'unauthorized' }, 401)
  return json({ ok: false, ...cpuHeavyPayload('GET|POST /api/cron/echoes') }, 501)
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
    const cron = event.cron
    const url =
      cron === '0 8 * * *' ? '/api/cron/synthesize'
        : cron === '* * * * *' ? '/api/cron/process-tick'
          : cron === '0 9 * * *' ? '/api/cron/remind'
            : cron === '15 9 * * *' ? '/api/cron/sync-resend'
              : cron === '30 9 * * *' ? '/api/cron/welcome-drip'
                : '/api/cron/echoes'
    ctx.waitUntil(Promise.resolve(app.fetch(new Request(`https://worker${url}`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET ?? ''}` },
    }), env)))
  },
}

export { app }
