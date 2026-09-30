import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAiClientsForTests } from './aiClient.js'
import { embed } from './embeddings.js'
import { callModel } from './openai.js'

const ENV_KEYS = ['AI_GATEWAY_ZDR', 'AI_GATEWAY_ZDR_PROVIDERS', 'AI_GATEWAY_API_KEY', 'OPENAI_API_KEY', 'OPENAI_MODEL'] as const
const saved: Record<string, string | undefined> = {}

const SCHEMA = {
  type: 'object',
  properties: { ok: { type: 'boolean' } },
  required: ['ok'],
  additionalProperties: false,
}

function chatOk(content: string) {
  return {
    id: 'chatcmpl-test',
    object: 'chat.completion',
    created: 0,
    model: 'gpt-6-luna',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function lastFetch(): { url: string; body: Record<string, unknown> } {
  const call = fetchMock.mock.calls[0]
  if (!call) throw new Error('fetch was not called')
  const [first, init] = call
  if (first instanceof Request) {
    return { url: first.url, body: JSON.parse(String(init?.body ?? '')) as Record<string, unknown> }
  }
  return { url: String(first), body: JSON.parse(String(init?.body)) as Record<string, unknown> }
}

const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
  jsonResponse(chatOk('{"ok":true}')),
)

describe('callModel / embed request shape', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
    process.env.OPENAI_API_KEY = 'sk-test-direct'
    fetchMock.mockImplementation(async () => jsonResponse(chatOk('{"ok":true}')))
    vi.stubGlobal('fetch', fetchMock)
    resetAiClientsForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
    for (const key of ENV_KEYS) {
      const value = saved[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    resetAiClientsForTests()
  })

  it('flag off: callModel hits api.openai.com with the bare model and no providerOptions', async () => {
    const out = await callModel<{ ok: boolean }>('sys', { n: 1 }, SCHEMA, 'probe', 'low', 128)
    expect(out).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalled()
    const { url, body } = lastFetch()
    expect(url).toContain('api.openai.com')
    expect(body.model).toBe('gpt-6-luna')
    expect(body.providerOptions).toBeUndefined()
    expect(body.reasoning_effort).toBe('low')
    expect(body.max_completion_tokens).toBe(128)
    expect(body.response_format).toMatchObject({ type: 'json_schema' })
  })

  it('flag on: callModel prefixes the model and sends ZDR providerOptions', async () => {
    process.env.AI_GATEWAY_ZDR = 'on'
    process.env.AI_GATEWAY_API_KEY = 'gw-test'
    process.env.OPENAI_MODEL = 'gpt-6-luna'
    resetAiClientsForTests()
    await callModel<{ ok: boolean }>('sys', { n: 1 }, SCHEMA, 'probe', 'medium', 256)
    const { url, body } = lastFetch()
    expect(url).toContain('ai-gateway.vercel.sh')
    expect(body.model).toBe('openai/gpt-6-luna')
    expect(body.reasoning_effort).toBe('medium')
    expect(body.max_completion_tokens).toBe(256)
    expect(body.providerOptions).toEqual({
      gateway: { zeroDataRetention: true, only: ['azure'] },
    })
  })

  it('flag on: embed prefixes the model and sends ZDR providerOptions', async () => {
    process.env.AI_GATEWAY_ZDR = 'on'
    process.env.AI_GATEWAY_API_KEY = 'gw-test'
    resetAiClientsForTests()
    const b64 = Buffer.from(new Float32Array([0.1, 0.2]).buffer).toString('base64')
    fetchMock.mockImplementation(async () =>
      jsonResponse({
        object: 'list',
        data: [{ object: 'embedding', index: 0, embedding: b64 }],
        model: 'openai/text-embedding-3-small',
        usage: { prompt_tokens: 1, total_tokens: 1 },
      }),
    )
    const vectors = await embed(['synthetic'])
    expect(vectors[0]?.length).toBe(2)
    const { url, body } = lastFetch()
    expect(url).toContain('ai-gateway.vercel.sh/v1/embeddings')
    expect(body.model).toBe('openai/text-embedding-3-small')
    expect(body.providerOptions).toEqual({
      gateway: { zeroDataRetention: true, only: ['azure'] },
    })
  })

  it('does not clamp max_completion_tokens when the flag is off', async () => {
    await callModel<{ ok: boolean }>('sys', { n: 1 }, SCHEMA, 'probe', 'low', 8)
    expect(lastFetch().body.max_completion_tokens).toBe(8)
  })

  it('clamps max_completion_tokens to 16 on the gateway path only', async () => {
    process.env.AI_GATEWAY_ZDR = 'on'
    process.env.AI_GATEWAY_API_KEY = 'gw-test'
    resetAiClientsForTests()
    await callModel<{ ok: boolean }>('sys', { n: 1 }, SCHEMA, 'probe', 'low', 8)
    expect(lastFetch().body.max_completion_tokens).toBe(16)
  })

  it('logs gateway_error then rethrows on a ZDR rejection (fail closed)', async () => {
    process.env.AI_GATEWAY_ZDR = 'on'
    process.env.AI_GATEWAY_API_KEY = 'gw-test'
    resetAiClientsForTests()
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              message: 'No ZDR providers',
              type: 'no_zdr_providers_available',
              name: 'NoZdrProvidersError',
            },
          }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
    )
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(callModel('sys', { n: 1 }, SCHEMA, 'probe')).rejects.toThrow()
    const joined = err.mock.calls.map((c) => c.map(String).join(' ')).join('\n')
    expect(joined).toMatch(/gateway_error status=400 name=NoZdrProvidersError/)
    expect(joined).not.toContain('No ZDR providers')
    err.mockRestore()
  })

  it('does not log journal-derived model output on parse failure', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockImplementation(async () => jsonResponse(chatOk('SECRET_JOURNAL_TEXT_SHOULD_NOT_APPEAR')))
    await expect(callModel('sys', { n: 1 }, SCHEMA, 'probe')).rejects.toThrow(/malformed/)
    const joined = err.mock.calls.map((c) => c.map(String).join(' ')).join('\n')
    expect(joined).not.toContain('SECRET_JOURNAL')
    expect(joined).toMatch(/hash=[0-9a-f]{12}/)
    expect(joined).toMatch(/parse_preview/)
    err.mockRestore()
  })
})
