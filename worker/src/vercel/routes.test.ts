import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { openWireSql, type WireSql } from '../testPg.ts'
import { app } from '../index.ts'
import { CRON_PATHS, PORTED_ROUTES } from './routes.ts'

const CRON = 'cron-secret-for-tests'
let wire: WireSql
let baseEnv: Record<string, string>

beforeAll(async () => {
  wire = await openWireSql()
  baseEnv = {
    DATABASE_URL: wire.url,
    CRON_SECRET: CRON,
    BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-32',
    BETTER_AUTH_URL: 'http://127.0.0.1:8787',
    ENVIRONMENT: 'local',
  }
}, 60_000)

afterAll(async () => {
  vi.unstubAllGlobals()
  await wire?.close()
})

const cronHeaders = { authorization: `Bearer ${CRON}` }

describe('Vercel-port routes on the Worker', () => {
  it('serves the 12 routes, enqueue, and the 6 crons on the Vercel schedule', () => {
    const paths = PORTED_ROUTES.map((r) => r.path)
    for (const p of [
      '/api/ask', '/api/transcribe', '/api/transcribe-image', '/api/pages/interpret', '/api/keeping/read',
      '/api/reflections/generate', '/api/spiritual/notice', '/api/spiritual/scripture',
      '/api/spiritual/scripture-resolve', '/api/spiritual/scripture-chapter', '/api/onboarding/backfill',
      '/api/concordance/rebuild', '/api/processing/enqueue', '/api/realtime-token', '/api/zdr-selftest',
    ]) expect(paths).toContain(p)
    for (const p of Object.values(CRON_PATHS)) expect(paths).toContain(p)
    expect(Object.keys(CRON_PATHS)).toHaveLength(6)
  })

  it('crons need CRON_SECRET', async () => {
    for (const path of Object.values(CRON_PATHS)) {
      const res = await app.request(path, { headers: { authorization: 'Bearer wrong' } }, baseEnv)
      expect(res.status, path).toBe(401)
    }
  })

  it('mail crons stay off (no Resend call) until WORKER_MAIL_CRONS=on', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    try {
      for (const path of ['/api/cron/welcome-drip', '/api/cron/remind', '/api/cron/sync-resend']) {
        const res = await app.request(path, { headers: cronHeaders }, { ...baseEnv, RESEND_API_KEY: 're_test', WELCOME_DRIP_SENDS_ENABLED: 'true' })
        expect(res.status, path).toBe(200)
        expect(await res.json(), path).toEqual({ ok: true, skipped: 'WORKER_MAIL_CRONS is off' })
      }
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('with WORKER_MAIL_CRONS=on the real remind cron runs against the DB', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    try {
      const res = await app.request('/api/cron/remind', { headers: cronHeaders }, { ...baseEnv, WORKER_MAIL_CRONS: 'on' })
      expect(res.status).toBeLessThan(500)
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('AI crons fail closed without the ZDR gateway, even with OPENAI_API_KEY', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    try {
      for (const path of ['/api/cron/synthesize', '/api/cron/process-tick', '/api/cron/echoes']) {
        const res = await app.request(path, { headers: cronHeaders }, { ...baseEnv, OPENAI_API_KEY: 'sk-must-not-be-used' })
        expect(res.status, path).toBe(501)
      }
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('with the gateway on, the real process-tick handler runs on Neon (empty queue)', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    try {
      const res = await app.request('/api/cron/process-tick', { headers: cronHeaders }, {
        ...baseEnv, AI_GATEWAY_ZDR: 'on', AI_GATEWAY_API_KEY: 'gw-test', GATHER_ENGINE: 'on', GATHER_MODE: 'gate',
      })
      expect(res.status).toBe(200)
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('user routes run the Vercel handler and 401 without a Better Auth session', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    try {
      const env = { ...baseEnv, AI_GATEWAY_ZDR: 'on', AI_GATEWAY_API_KEY: 'gw-test', OPENAI_API_KEY: 'sk-test', ESV_API_KEY: 'esv-test' }
      for (const path of ['/api/transcribe', '/api/spiritual/scripture-resolve', '/api/ask', '/api/processing/enqueue']) {
        const res = await app.request(path, {
          method: 'POST',
          headers: { authorization: 'Bearer forged', 'content-type': 'application/json' },
          body: '{}',
        }, env)
        expect(res.status, path).toBe(401)
      }
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('a self-kicked process-tick answers 202 at once and runs the tick under waitUntil', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const tasks: Promise<unknown>[] = []
    const executionCtx = { waitUntil: (p: Promise<unknown>) => { tasks.push(p) }, passThroughOnException: () => undefined, props: {} }
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const res = await app.request('/api/cron/process-tick', { headers: { ...cronHeaders, 'x-dayspring-kick': '1' } }, {
        ...baseEnv, AI_GATEWAY_ZDR: 'on', AI_GATEWAY_API_KEY: 'gw-test', GATHER_ENGINE: 'on', GATHER_MODE: 'gate',
      }, executionCtx as never)
      expect(res.status).toBe(202)
      expect(await res.json()).toEqual({ ok: true, kicked: true })
      expect(tasks.length).toBeGreaterThan(0)
      await Promise.all(tasks)
      expect(err.mock.calls.filter((c) => String(c[0]).includes('[self-kick]'))).toEqual([])
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      err.mockRestore()
      vi.unstubAllGlobals()
    }
  })

  it('the kick header without CRON_SECRET is still 401', async () => {
    const res = await app.request('/api/cron/process-tick', { headers: { 'x-dayspring-kick': '1' } }, baseEnv)
    expect(res.status).toBe(401)
  })

  it('synthesize and echoes accept x-dayspring-owner (cron secret only) and refuse a malformed one', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    try {
      const env = { ...baseEnv, AI_GATEWAY_ZDR: 'on', AI_GATEWAY_API_KEY: 'gw-test' }
      for (const path of ['/api/cron/synthesize', '/api/cron/echoes']) {
        const bad = await app.request(path, { headers: { ...cronHeaders, 'x-dayspring-owner': "x' or 1=1" } }, env)
        expect(bad.status, path).toBe(400)
        const scoped = await app.request(path, { headers: { ...cronHeaders, 'x-dayspring-owner': 'no-such-owner-0001' } }, env)
        expect(scoped.status, path).toBe(200)
        expect((await scoped.json() as { owners: number }).owners, path).toBe(0)
        const noSecret = await app.request(path, { headers: { 'x-dayspring-owner': 'no-such-owner-0001' } }, env)
        expect(noSecret.status, path).toBe(401)
      }
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('zdr-selftest is a clean 404 when ZDR_SELFTEST_TOKEN is unset', async () => {
    for (const method of ['GET', 'POST']) {
      const res = await app.request('/api/zdr-selftest', { method, headers: { 'x-zdr-selftest-token': 'guess' } }, baseEnv)
      expect(res.status, method).toBe(404)
    }
  })

  it('an unknown /api path served by ASSETS (immutable headers) is not a 500', async () => {
    const ASSETS = { fetch: async () => fetchLikeResponse('<!doctype html>', 404) }
    const res = await app.request('/api/does-not-exist', {}, { ...baseEnv, ASSETS } as never)
    expect(res.status).toBe(404)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('realtime-token is served by the Worker: 501 without OPENAI_API_KEY, 401 without a session', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    try {
      const off = await app.request('/api/realtime-token', { method: 'POST', body: '{}' }, baseEnv)
      expect(off.status).toBe(501)
      expect(await off.text()).not.toMatch(/OPENAI_API_KEY/)
      const anon = await app.request('/api/realtime-token', {
        method: 'POST', headers: { authorization: 'Bearer forged', 'content-type': 'application/json' }, body: '{}',
      }, { ...baseEnv, OPENAI_API_KEY: 'sk-test' })
      expect(anon.status).toBe(401)
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('transcribe 501s without OPENAI_API_KEY and does not name the key', async () => {
    const res = await app.request('/api/transcribe', { method: 'POST' }, baseEnv)
    expect(res.status).toBe(501)
    expect(await res.text()).not.toMatch(/OPENAI_API_KEY/)
  })
})

/** A Response whose headers are immutable, like one from fetch() / ASSETS.fetch(). */
function fetchLikeResponse(body: string, status: number): Response {
  const res = new Response(body, { status, headers: { 'content-type': 'text/html' } })
  const headers = res.headers
  const frozen = new Proxy(headers, {
    get(target, prop) {
      if (prop === 'set' || prop === 'append' || prop === 'delete') {
        return () => { throw new TypeError("Can't modify immutable headers.") }
      }
      const v = Reflect.get(target, prop, target)
      return typeof v === 'function' ? v.bind(target) : v
    },
  })
  Object.defineProperty(res, 'headers', { get: () => frozen })
  return res
}
