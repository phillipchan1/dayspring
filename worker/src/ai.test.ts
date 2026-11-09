import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAiClientsForTests } from '../../api/_lib/aiClient.ts'
import {
  AI_GATEWAY_BASE_URL,
  createAiClient,
  gatewayBody,
  resolveModelId,
} from '../../api/_lib/aiClient.ts'
import { assertNoWorkerAiBypass } from './ai.guard.ts'
import {
  workerAiClient,
  workerAiGatewayReady,
  workerGatewayOpts,
} from './ai.ts'
import { app } from './index.ts'

const ENV_KEYS = ['AI_GATEWAY_ZDR', 'AI_GATEWAY_ZDR_PROVIDERS', 'AI_GATEWAY_API_KEY', 'OPENAI_API_KEY', 'OPENAI_MODEL'] as const
const saved: Record<string, string | undefined> = {}

function isolate(): void {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  process.env.OPENAI_API_KEY = 'sk-test-direct'
  resetAiClientsForTests()
}

function restore(): void {
  for (const key of ENV_KEYS) {
    const value = saved[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  resetAiClientsForTests()
}

const CHAT_OK = {
  id: 'chatcmpl-test',
  object: 'chat.completion',
  created: 0,
  model: 'gpt-6-luna',
  choices: [{ index: 0, message: { role: 'assistant', content: '{}' }, finish_reason: 'stop' }],
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

const GATEWAY_ROUTES = [
  'POST /api/ask',
  'POST /api/keeping/read',
  'POST /api/pages/interpret',
  'POST /api/transcribe-image',
  'POST /api/onboarding/backfill',
  'POST /api/spiritual/notice',
  'POST /api/reflections/generate',
  'POST /api/concordance/rebuild',
] as const

describe('Worker AI Gateway ZDR', () => {
  afterEach(restore)

  it('fails if any Worker AI call bypasses the gateway client', () => {
    expect(() => assertNoWorkerAiBypass()).not.toThrow()
  })

  it('flag-off Vercel path is unchanged: api.openai.com, no providerOptions', async () => {
    isolate()
    const captured: { url?: string; body?: Record<string, unknown> } = {}
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      captured.url = String(url)
      captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return jsonResponse(CHAT_OK)
    })
    const client = createAiClient({ maxRetries: 0, fetch })
    await client.chat.completions.create({
      model: resolveModelId('gpt-6-luna'),
      messages: [{ role: 'user', content: 'hi' }],
      ...gatewayBody(),
    })
    expect(captured.url).toContain('api.openai.com')
    expect(captured.body?.model).toBe('gpt-6-luna')
    expect(captured.body?.providerOptions).toBeUndefined()
  })

  it('Worker client hits the gateway with ZDR options and ignores OPENAI_API_KEY', async () => {
    isolate()
    const captured: { url?: string; auth?: string | null; body?: Record<string, unknown> } = {}
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      captured.url = String(url)
      captured.auth = new Headers(init?.headers).get('authorization')
      captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return jsonResponse(CHAT_OK)
    })
    const env = {
      AI_GATEWAY_ZDR: 'on',
      AI_GATEWAY_API_KEY: 'gw-worker',
      AI_GATEWAY_ZDR_PROVIDERS: 'azure',
    }
    const gw = workerGatewayOpts(env)
    const client = workerAiClient(env, { fetch, maxRetries: 0 })
    expect(client.baseURL).toBe(AI_GATEWAY_BASE_URL)
    await client.chat.completions.create({
      model: resolveModelId('gpt-6-luna', gw),
      messages: [{ role: 'user', content: 'synthetic' }],
      ...gatewayBody(gw),
    })
    expect(captured.url).toBe(`${AI_GATEWAY_BASE_URL}/chat/completions`)
    expect(captured.url).not.toContain('api.openai.com')
    expect(captured.auth).toBe('Bearer gw-worker')
    expect(captured.body?.model).toBe('openai/gpt-6-luna')
    expect(captured.body?.providerOptions).toEqual({
      gateway: { zeroDataRetention: true, only: ['azure'] },
    })
  })

  it('bindings without the gateway flag refuse to use OPENAI_API_KEY', () => {
    isolate()
    expect(() =>
      createAiClient({
        bindings: { AI_GATEWAY_API_KEY: 'gw-test' },
        maxRetries: 0,
      }),
    ).toThrow(/must use the AI Gateway ZDR client/)
    expect(workerAiGatewayReady({ AI_GATEWAY_API_KEY: 'gw-test' })).toBe(false)
    expect(() => workerAiClient({ AI_GATEWAY_API_KEY: 'gw-test' })).toThrow(/AI_GATEWAY_ZDR/)
  })

  it('Worker AI routes 501 without calling OpenAI when the gateway is unset', async () => {
    isolate()
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    try {
      for (const route of GATEWAY_ROUTES) {
        const [method, path] = route.split(' ')
        const res = await app.request(
          path,
          { method },
          { OPENAI_MODEL: 'gpt-6-luna', OPENAI_API_KEY: 'sk-must-not-be-used' } as Parameters<typeof app.request>[2],
        )
        expect(res.status, route).toBe(501)
        const body = await res.json() as { error?: string }
        expect(body.error, route).toMatch(/AI_GATEWAY/)
      }
      const transcribe = await app.request('/api/transcribe', { method: 'POST' }, {})
      expect(transcribe.status).toBe(501)
      expect(await transcribe.text()).not.toMatch(/OPENAI_API_KEY/)
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
