import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AI_GATEWAY_BASE_URL,
  createAiClient,
  gatewayBody,
  logGatewayError,
  readGatewayExtras,
  readGatewayProvider,
  readGatewayRouting,
  resetAiClientsForTests,
  resolveModelId,
} from './aiClient.js'

const ENV_KEYS = [
  'AI_GATEWAY_ZDR',
  'AI_GATEWAY_ZDR_PROVIDERS',
  'AI_GATEWAY_API_KEY',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
] as const

const saved: Record<string, string | undefined> = {}

function isolate(): void {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  process.env.OPENAI_API_KEY = 'sk-test-direct'
}

function restore(): void {
  for (const key of ENV_KEYS) {
    const value = saved[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  resetAiClientsForTests()
}

const getToken = vi.fn(async () => 'oidc-token')

vi.mock('@vercel/functions/oidc', () => ({
  getVercelOidcToken: () => getToken(),
}))

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

const CHAT_OK = {
  id: 'chatcmpl-test',
  object: 'chat.completion',
  created: 0,
  model: 'gpt-6-luna',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: '{}' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
}

const EMBED_OK = {
  object: 'list',
  data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2] }],
  model: 'text-embedding-3-small',
  usage: { prompt_tokens: 1, total_tokens: 1 },
}

describe('AI Gateway ZDR client helper', () => {
  beforeEach(() => {
    isolate()
    getToken.mockClear()
    resetAiClientsForTests()
  })
  afterEach(restore)

  it('treats unset / garbage flag values as off', () => {
    expect(resolveModelId('gpt-6-luna')).toBe('gpt-6-luna')
    process.env.AI_GATEWAY_ZDR = 'yes'
    expect(resolveModelId('gpt-6-luna')).toBe('gpt-6-luna')
    process.env.AI_GATEWAY_ZDR = '1'
    expect(resolveModelId('gpt-6-luna')).toBe('gpt-6-luna')
    process.env.AI_GATEWAY_ZDR = 'false'
    expect(resolveModelId('gpt-6-luna')).toBe('gpt-6-luna')
  })

  it('prefixes models and adds ZDR providerOptions when the flag is on', () => {
    process.env.AI_GATEWAY_ZDR = 'on'
    expect(resolveModelId('gpt-6-luna')).toBe('openai/gpt-6-luna')
    expect(resolveModelId('gpt-4o')).toBe('openai/gpt-4o')
    expect(resolveModelId('text-embedding-3-small')).toBe('openai/text-embedding-3-small')
    expect(resolveModelId('openai/already-prefixed')).toBe('openai/already-prefixed')
    expect(gatewayBody()).toEqual({
      providerOptions: {
        gateway: { zeroDataRetention: true, only: ['azure'] },
      },
    })
  })

  it('accepts true (any case) and a comma list of providers', () => {
    process.env.AI_GATEWAY_ZDR = 'TRUE'
    process.env.AI_GATEWAY_ZDR_PROVIDERS = 'azure,openai'
    expect(gatewayBody()).toEqual({
      providerOptions: {
        gateway: { zeroDataRetention: true, only: ['azure', 'openai'] },
      },
    })
  })

  it('flag off: same client destination and request shape as today', async () => {
    const captured: { url?: string; body?: Record<string, unknown> } = {}
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      captured.url = String(url)
      captured.body = JSON.parse(String(init?.body))
      return jsonResponse(CHAT_OK)
    })
    const client = createAiClient({ maxRetries: 0, fetch })
    expect(client.baseURL).toBe('https://api.openai.com/v1')
    await client.chat.completions.create({
      model: resolveModelId('gpt-6-luna'),
      messages: [{ role: 'user', content: 'hi' }],
      ...gatewayBody(),
    })
    expect(captured.url).toContain('api.openai.com')
    expect(captured.body?.model).toBe('gpt-6-luna')
    expect(captured.body?.providerOptions).toBeUndefined()
    expect(getToken).not.toHaveBeenCalled()
  })

  it('flag on: gateway baseURL, prefixed model, providerOptions on the wire', async () => {
    process.env.AI_GATEWAY_ZDR = 'on'
    process.env.AI_GATEWAY_API_KEY = 'gw-test-key'
    const captured: { url?: string; body?: Record<string, unknown>; auth?: string | null } = {}
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      captured.url = String(url)
      captured.body = JSON.parse(String(init?.body))
      const headers = new Headers(init?.headers)
      captured.auth = headers.get('authorization')
      return jsonResponse(CHAT_OK)
    })
    const client = createAiClient({ maxRetries: 0, fetch })
    expect(client.baseURL).toBe(AI_GATEWAY_BASE_URL)
    await client.chat.completions.create({
      model: resolveModelId('gpt-6-luna'),
      reasoning_effort: 'low',
      max_completion_tokens: 2048,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'probe', strict: true, schema: { type: 'object', additionalProperties: false } },
      },
      messages: [{ role: 'user', content: 'hi' }],
      ...gatewayBody(),
    })
    expect(captured.url).toBe(`${AI_GATEWAY_BASE_URL}/chat/completions`)
    expect(captured.auth).toBe('Bearer gw-test-key')
    expect(captured.body?.model).toBe('openai/gpt-6-luna')
    expect(captured.body?.reasoning_effort).toBe('low')
    expect(captured.body?.max_completion_tokens).toBe(2048)
    expect(captured.body?.response_format).toMatchObject({ type: 'json_schema' })
    expect(captured.body?.providerOptions).toEqual({
      gateway: { zeroDataRetention: true, only: ['azure'] },
    })
  })

  it('flag on: embeddings carry the same providerOptions and are not stripped', async () => {
    process.env.AI_GATEWAY_ZDR = 'on'
    process.env.AI_GATEWAY_API_KEY = 'gw-test-key'
    const captured: { url?: string; body?: Record<string, unknown> } = {}
    const fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      captured.url = String(url)
      captured.body = JSON.parse(String(init?.body))
      return jsonResponse(EMBED_OK)
    })
    const client = createAiClient({ maxRetries: 0, fetch })
    await client.embeddings.create({
      model: resolveModelId('text-embedding-3-small'),
      input: ['synthetic'],
      ...gatewayBody(),
    })
    expect(captured.url).toBe(`${AI_GATEWAY_BASE_URL}/embeddings`)
    expect(captured.body?.model).toBe('openai/text-embedding-3-small')
    expect(captured.body?.providerOptions).toEqual({
      gateway: { zeroDataRetention: true, only: ['azure'] },
    })
  })

  it('does not fetch the OIDC token at construct time; fetches per request', async () => {
    process.env.AI_GATEWAY_ZDR = 'on'
    let n = 0
    getToken.mockImplementation(async () => {
      n += 1
      return `oidc-${n}`
    })
    const auths: string[] = []
    const fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      auths.push(new Headers(init?.headers).get('authorization') ?? '')
      return jsonResponse(CHAT_OK)
    })
    const client = createAiClient({ maxRetries: 0, fetch })
    expect(getToken).not.toHaveBeenCalled()
    await client.chat.completions.create({
      model: 'openai/gpt-6-luna',
      messages: [{ role: 'user', content: 'a' }],
      ...gatewayBody({ forceGateway: true }),
    })
    await client.chat.completions.create({
      model: 'openai/gpt-6-luna',
      messages: [{ role: 'user', content: 'b' }],
      ...gatewayBody({ forceGateway: true }),
    })
    expect(getToken).toHaveBeenCalledTimes(2)
    expect(auths).toEqual(['Bearer oidc-1', 'Bearer oidc-2'])
  })

  it('AI_GATEWAY_API_KEY wins over OIDC', async () => {
    process.env.AI_GATEWAY_ZDR = 'on'
    process.env.AI_GATEWAY_API_KEY = 'gw-override'
    const fetch = vi.fn(async () => jsonResponse(CHAT_OK))
    const client = createAiClient({ maxRetries: 0, fetch })
    await client.chat.completions.create({
      model: 'openai/gpt-6-luna',
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(getToken).not.toHaveBeenCalled()
  })

  it('reads chat provider from choices[0].message.provider_metadata.gateway', () => {
    const data = {
      choices: [
        {
          message: {
            provider_metadata: {
              gateway: {
                routing: { finalProvider: 'azure', providerAttempts: 1, planningReasoning: 'ZDR' },
                enabledZeroDataRetention: true,
                cost: '0.0001',
              },
            },
          },
        },
      ],
    }
    expect(readGatewayProvider(data)).toBe('azure')
    expect(readGatewayRouting(data)).toEqual({
      finalProvider: 'azure',
      providerAttempts: 1,
      planningReasoning: 'ZDR',
    })
    expect(readGatewayExtras(data)).toEqual({ enabledZeroDataRetention: true, cost: '0.0001' })
  })

  it('falls back to top-level providerMetadata.gateway (embeddings / errors)', () => {
    const data = {
      providerMetadata: {
        gateway: {
          routing: { finalProvider: 'azure' },
          enabledZeroDataRetention: true,
          cost: '0.00000012',
        },
      },
    }
    expect(readGatewayProvider(data)).toBe('azure')
    expect(readGatewayExtras(data).cost).toBe('0.00000012')
  })

  it('does not infer a provider from response headers', () => {
    const data = { choices: [{ message: { content: 'ok' } }] }
    expect(readGatewayProvider(data)).toBeNull()
  })

  it('logs gateway_error status and name only', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    logGatewayError({
      status: 400,
      name: 'BadRequestError',
      type: 'no_zdr_providers_available',
      error: { name: 'NoZdrProvidersError', type: 'no_zdr_providers_available', message: 'journal text must not appear' },
    })
    logGatewayError({
      status: 403,
      name: 'PermissionDeniedError',
      error: { name: 'RestrictedModelsError', type: 'restricted_models' },
    })
    const lines = err.mock.calls.map((c) => c.map(String).join(' '))
    expect(lines).toContain('gateway_error status=400 name=NoZdrProvidersError')
    expect(lines).toContain('gateway_error status=403 name=RestrictedModelsError')
    expect(lines.join('\n')).not.toContain('journal text')
    err.mockRestore()
  })
})
