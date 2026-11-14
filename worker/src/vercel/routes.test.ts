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
      '/api/concordance/rebuild', '/api/processing/enqueue',
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

  it('transcribe 501s without OPENAI_API_KEY and does not name the key', async () => {
    const res = await app.request('/api/transcribe', { method: 'POST' }, baseEnv)
    expect(res.status).toBe(501)
    expect(await res.text()).not.toMatch(/OPENAI_API_KEY/)
  })
})
