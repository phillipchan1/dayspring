// Worker AI goes through api/_lib/aiClient.ts — the same ZDR helper Vercel uses.
// Bindings are read by name only (AI_GATEWAY_API_KEY, AI_GATEWAY_ZDR, optional
// AI_GATEWAY_ZDR_PROVIDERS). This module never reads OPENAI_API_KEY.

import {
  createAiClient,
  gatewayBody,
  resolveModelId,
  useAiGateway,
  type AiGatewayBindings,
  type CreateAiClientOpts,
  type GatewayRequestOpts,
} from '../../api/_lib/aiClient.ts'
import type { Env } from './env.ts'

export { gatewayBody, resolveModelId, useAiGateway }

export function workerAiBindings(env: Env): AiGatewayBindings {
  return {
    AI_GATEWAY_ZDR: env.AI_GATEWAY_ZDR,
    AI_GATEWAY_ZDR_PROVIDERS: env.AI_GATEWAY_ZDR_PROVIDERS,
    AI_GATEWAY_API_KEY: env.AI_GATEWAY_API_KEY,
  }
}

export function workerGatewayOpts(env: Env): GatewayRequestOpts {
  return { forceGateway: true, bindings: workerAiBindings(env) }
}

export function aiGatewayZdrOn(env: Env): boolean {
  const v = (env.AI_GATEWAY_ZDR ?? '').trim().toLowerCase()
  return v === 'on' || v === 'true'
}

export function workerAiGatewayReady(env: Env): boolean {
  return aiGatewayZdrOn(env) && Boolean(env.AI_GATEWAY_API_KEY?.trim())
}

export function workerAiClient(
  env: Env,
  opts: Pick<CreateAiClientOpts, 'fetch' | 'maxRetries' | 'timeout'> = {},
) {
  if (!workerAiGatewayReady(env)) {
    throw new Error('Worker AI requires AI_GATEWAY_ZDR=on and AI_GATEWAY_API_KEY')
  }
  return createAiClient({
    ...workerGatewayOpts(env),
    maxRetries: opts.maxRetries ?? 8,
    timeout: opts.timeout ?? 60_000,
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  })
}
