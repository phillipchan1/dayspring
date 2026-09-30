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
 * Best-effort read of the provider the gateway actually used. Headers vary;
 * providerMetadata.gateway.routing is the documented shape.
 */
export function readGatewayProvider(data: unknown, response?: Response): string | null {
  if (response) {
    const named = [
      'x-vercel-ai-gateway-provider',
      'ai-gateway-provider',
      'x-ai-gateway-provider',
      'x-gateway-provider',
    ]
    for (const name of named) {
      const v = response.headers.get(name)
      if (v) return v
    }
    for (const [k, v] of response.headers) {
      if (v && /provider/i.test(k) && !/rate|limit|retry/i.test(k)) return v
    }
  }

  if (!data || typeof data !== 'object') return null
  const rec = data as Record<string, unknown>
  const meta = rec.providerMetadata as Record<string, unknown> | undefined
  const gateway = (meta?.gateway ?? rec.gateway) as Record<string, unknown> | undefined
  if (!gateway || typeof gateway !== 'object') return null
  if (typeof gateway.provider === 'string' && gateway.provider) return gateway.provider
  const routing = gateway.routing as Record<string, unknown> | undefined
  if (routing && typeof routing === 'object') {
    for (const field of ['finalProvider', 'provider', 'selectedProvider', 'chosenProvider']) {
      const v = routing[field]
      if (typeof v === 'string' && v) return v
    }
    const reason = routing.planningReasoning
    if (typeof reason === 'string' && reason) {
      const m = reason.match(/\b(azure|openai|bedrock|vertex|anthropic)\b/i)
      if (m?.[1]) return m[1].toLowerCase()
      return reason
    }
  }
  return null
}

export function readGatewayRouting(data: unknown): unknown {
  if (!data || typeof data !== 'object') return null
  const rec = data as Record<string, unknown>
  const meta = rec.providerMetadata as Record<string, unknown> | undefined
  const gateway = (meta?.gateway ?? rec.gateway) as Record<string, unknown> | undefined
  return gateway?.routing ?? null
}
