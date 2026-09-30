// Single place that builds the OpenAI client for journal-touching text, vision,
// and embeddings. Flag off (the default) is byte-for-byte today's client:
// api.openai.com, OPENAI_API_KEY, unprefixed model ids, no extra body fields.
// Flag on points the same SDK at Vercel AI Gateway with per-request ZDR.
//
// Audio transcription (api/transcribe.ts) and realtime token mint
// (api/realtime-token.ts) stay on direct OpenAI — no ZDR route exists for them.
//
// Fail closed: callers surface gateway errors the same way they surface OpenAI
// errors today. This helper never falls back to api.openai.com.

import OpenAI from 'openai'
import { getVercelOidcToken } from '@vercel/functions/oidc'
import { env } from './env.js'

export const AI_GATEWAY_BASE_URL = 'https://ai-gateway.vercel.sh/v1'

export type GatewayRequestOpts = {
  /** Self-test forces the gateway path even when AI_GATEWAY_ZDR is off. */
  forceGateway?: boolean
}

export type CreateAiClientOpts = GatewayRequestOpts & {
  maxRetries?: number
  timeout?: number
  /** Test-only: intercept the outbound fetch. Omitted in production. */
  fetch?: typeof globalThis.fetch
}

export type GatewayProviderOptions = {
  providerOptions: {
    gateway: {
      zeroDataRetention: true
      only: string[]
    }
  }
}

const cache = new Map<string, OpenAI>()

export function aiGatewayZdrEnabled(): boolean {
  return env.aiGatewayZdr()
}

export function useAiGateway(opts?: GatewayRequestOpts): boolean {
  return Boolean(opts?.forceGateway) || aiGatewayZdrEnabled()
}

/** Prefix a bare OpenAI model id for the gateway (`gpt-6-luna` → `openai/gpt-6-luna`). */
export function resolveModelId(model: string, opts?: GatewayRequestOpts): string {
  if (!useAiGateway(opts)) return model
  return model.includes('/') ? model : `openai/${model}`
}

/**
 * Extra JSON fields the gateway reads. Spread onto chat/embeddings create()
 * params. Empty object when the flag is off so a `...gatewayBody()` spread
 * adds no keys. The openai SDK JSON.stringifies the body as-is (see
 * FallbackEncoder), so these fields are not stripped.
 */
export function gatewayBody(opts?: GatewayRequestOpts): GatewayProviderOptions | Record<string, never> {
  if (!useAiGateway(opts)) return {}
  return {
    providerOptions: {
      gateway: {
        zeroDataRetention: true,
        only: env.aiGatewayZdrProviders(),
      },
    },
  }
}

function gatewayApiKey(): string | (() => Promise<string>) {
  const override = env.aiGatewayApiKey()
  if (override) return override
  // Function form: the SDK invokes this before each request so a ~90 min OIDC
  // token is refreshed instead of being captured at module load.
  return getVercelOidcToken
}

export function createAiClient(opts: CreateAiClientOpts = {}): OpenAI {
  const maxRetries = opts.maxRetries ?? 8
  const timeout = opts.timeout ?? 60_000
  const gateway = useAiGateway(opts)
  const key = `${gateway ? 'gw' : 'oa'}:${maxRetries}:${timeout}:${opts.forceGateway ? 'force' : 'flag'}`
  const hit = cache.get(key)
  if (hit && !opts.fetch) return hit

  const client = gateway
    ? new OpenAI({
        apiKey: gatewayApiKey(),
        baseURL: AI_GATEWAY_BASE_URL,
        maxRetries,
        timeout,
        ...(opts.fetch ? { fetch: opts.fetch } : {}),
      })
    : new OpenAI({
        apiKey: env.openaiKey(),
        maxRetries,
        timeout,
        ...(opts.fetch ? { fetch: opts.fetch } : {}),
      })

  if (!opts.fetch) cache.set(key, client)
  return client
}

/** Drop cached clients so tests can flip AI_GATEWAY_ZDR between cases. */
export function resetAiClientsForTests(): void {
  cache.clear()
}

/**
 * Live chat completions put gateway metadata on
 * `choices[0].message.provider_metadata.gateway`. Embeddings and error bodies
 * use top-level `providerMetadata.gateway`. No response header names the
 * provider — do not scan headers.
 */
export function readGatewayBlock(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null
  const rec = data as Record<string, unknown>

  const choices = rec.choices
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === 'object') {
    const msg = (choices[0] as Record<string, unknown>).message
    if (msg && typeof msg === 'object') {
      const meta = msg as Record<string, unknown>
      const snake = meta.provider_metadata as Record<string, unknown> | undefined
      const camel = meta.providerMetadata as Record<string, unknown> | undefined
      const fromMsg = snake?.gateway ?? camel?.gateway
      if (fromMsg && typeof fromMsg === 'object') return fromMsg as Record<string, unknown>
    }
  }

  const top = rec.providerMetadata as Record<string, unknown> | undefined
  const topSnake = rec.provider_metadata as Record<string, unknown> | undefined
  const fromTop = top?.gateway ?? topSnake?.gateway
  if (fromTop && typeof fromTop === 'object') return fromTop as Record<string, unknown>
  return null
}

export function readGatewayProvider(data: unknown): string | null {
  const gateway = readGatewayBlock(data)
  if (!gateway) return null
  const routing = gateway.routing as Record<string, unknown> | undefined
  if (routing && typeof routing === 'object') {
    if (typeof routing.finalProvider === 'string' && routing.finalProvider) return routing.finalProvider
    if (typeof routing.provider === 'string' && routing.provider) return routing.provider
  }
  if (typeof gateway.provider === 'string' && gateway.provider) return gateway.provider
  return null
}

export function readGatewayRouting(data: unknown): unknown {
  return readGatewayBlock(data)?.routing ?? null
}

export function readGatewayExtras(data: unknown): {
  enabledZeroDataRetention: unknown
  cost: unknown
} {
  const gateway = readGatewayBlock(data)
  return {
    enabledZeroDataRetention: gateway?.enabledZeroDataRetention ?? null,
    cost: gateway?.cost ?? null,
  }
}

/**
 * One-line, no-content tag so 400 NoZdrProvidersError vs 403 RestrictedModelsError
 * (and timeouts) are distinguishable in Vercel logs. Call only on the gateway path.
 */
export function logGatewayError(err: unknown): void {
  const rec = err && typeof err === 'object' ? (err as Record<string, unknown>) : null
  const body = rec?.error
  const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const status = rec?.status ?? rec?.statusCode ?? bodyObj?.statusCode ?? 'unknown'
  const name =
    (typeof bodyObj?.name === 'string' && bodyObj.name) ||
    (typeof rec?.name === 'string' && rec.name !== 'Error' ? rec.name : null) ||
    (typeof bodyObj?.type === 'string' && bodyObj.type) ||
    (typeof rec?.type === 'string' && rec.type) ||
    'unknown'
  console.error(`gateway_error status=${String(status)} name=${name}`)
}
