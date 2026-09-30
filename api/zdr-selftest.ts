// GET/POST /api/zdr-selftest
//
// Synthetic-only probe of the AI Gateway ZDR path (text, vision, embeddings).
// Never reads a journal. Returns 404 unless ZDR_SELFTEST_TOKEN is set and the
// request header matches it. Forces the gateway helper on so a preview can be
// exercised without flipping AI_GATEWAY_ZDR for real traffic.

import OpenAI from 'openai'
import {
  createAiClient,
  gatewayBody,
  readGatewayExtras,
  readGatewayProvider,
  readGatewayRouting,
  resolveModelId,
  type GatewayRequestOpts,
} from './_lib/aiClient.js'
import { cosine } from './_lib/embeddings.js'
import { env } from './_lib/env.js'

export const maxDuration = 60

const FORCE: GatewayRequestOpts = { forceGateway: true }

const SYNTHETIC_TEXT = 'Dayspring ZDR synthetic probe — not user journal text.'
const SYNTHETIC_VISION_PROMPT = 'Reply with the single word ok. This is a synthetic 1x1 PNG, not a journal page.'

/** 1×1 opaque PNG, generated here, never user data. */
const SYNTHETIC_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

type CallResult = {
  success: boolean
  latencyMs: number
  model: string
  provider: string | null
  routing?: unknown
  enabledZeroDataRetention?: unknown
  cost?: unknown
  error?: string
  vectorLength?: number
  cosineVsOpenAI?: number | null
}

function authorized(req: Request): boolean {
  const expected = env.zdrSelftestToken()
  if (!expected) return false
  const header = req.headers.get('x-zdr-selftest-token')
  const bearer = req.headers.get('authorization')
  const presented = header || (bearer?.startsWith('Bearer ') ? bearer.slice(7) : null)
  return Boolean(presented) && presented === expected
}

function notFound(): Response {
  return new Response(null, { status: 404 })
}

function client(): OpenAI {
  return createAiClient({ forceGateway: true, maxRetries: 1, timeout: 45_000 })
}

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; latencyMs: number; error?: string }> {
  const t0 = Date.now()
  try {
    const value = await fn()
    return { value, latencyMs: Date.now() - t0 }
  } catch (e) {
    return {
      latencyMs: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

async function runText(): Promise<CallResult> {
  const model = resolveModelId(env.model(), FORCE)
  const body = gatewayBody(FORCE)
  const ran = await timed(async () => {
    const { data } = await client()
      .chat.completions.create({
        model,
        max_completion_tokens: 32,
        messages: [
          { role: 'system', content: 'Reply with the single word ok.' },
          { role: 'user', content: SYNTHETIC_TEXT },
        ],
        ...body,
      })
      .withResponse()
    return data
  })
  if (!ran.value) {
    return { success: false, latencyMs: ran.latencyMs, model, provider: null, error: ran.error }
  }
  const data = ran.value
  const gw = readGatewayExtras(data)
  return {
    success: Boolean(data.choices[0]?.message),
    latencyMs: ran.latencyMs,
    model,
    provider: readGatewayProvider(data),
    routing: readGatewayRouting(data),
    enabledZeroDataRetention: gw.enabledZeroDataRetention,
    cost: gw.cost,
  }
}

async function runVision(): Promise<CallResult> {
  const model = resolveModelId(env.visionModel(), FORCE)
  const body = gatewayBody(FORCE)
  const b64 = SYNTHETIC_PNG.toString('base64')
  const ran = await timed(async () => {
    const { data } = await client()
      .chat.completions.create({
        model,
        max_tokens: 32,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SYNTHETIC_VISION_PROMPT },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}`, detail: 'low' } },
            ],
          },
        ],
        ...body,
      })
      .withResponse()
    return data
  })
  if (!ran.value) {
    return { success: false, latencyMs: ran.latencyMs, model, provider: null, error: ran.error }
  }
  const data = ran.value
  const gw = readGatewayExtras(data)
  return {
    success: Boolean(data.choices[0]?.message),
    latencyMs: ran.latencyMs,
    model,
    provider: readGatewayProvider(data),
    routing: readGatewayRouting(data),
    enabledZeroDataRetention: gw.enabledZeroDataRetention,
    cost: gw.cost,
  }
}

async function runEmbeddings(): Promise<CallResult> {
  const model = resolveModelId(env.embedModel(), FORCE)
  const body = gatewayBody(FORCE)
  const ran = await timed(async () => {
    const { data } = await client()
      .embeddings.create({ model, input: SYNTHETIC_TEXT, ...body })
      .withResponse()
    return data
  })
  if (!ran.value) {
    return { success: false, latencyMs: ran.latencyMs, model, provider: null, error: ran.error }
  }
  const data = ran.value
  const gw = readGatewayExtras(data)
  const vector = data.data[0]?.embedding as number[] | undefined
  const result: CallResult = {
    success: Boolean(vector && vector.length > 0),
    latencyMs: ran.latencyMs,
    model,
    provider: readGatewayProvider(data),
    routing: readGatewayRouting(data),
    enabledZeroDataRetention: gw.enabledZeroDataRetention,
    cost: gw.cost,
    vectorLength: vector?.length,
    cosineVsOpenAI: null,
  }

  const directKey = process.env.OPENAI_API_KEY
  if (vector && directKey) {
    try {
      const direct = new OpenAI({ apiKey: directKey, maxRetries: 1, timeout: 30_000 })
      const cmp = await direct.embeddings.create({
        model: env.embedModel(),
        input: SYNTHETIC_TEXT,
      })
      const other = cmp.data[0]?.embedding as number[] | undefined
      if (other && other.length === vector.length) {
        result.cosineVsOpenAI = cosine(vector, other)
      }
    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e)
    }
  }
  return result
}

async function handle(req: Request): Promise<Response> {
  if (!authorized(req)) return notFound()

  const [text, vision, embeddings] = await Promise.all([runText(), runVision(), runEmbeddings()])
  const ok = text.success && vision.success && embeddings.success
  return Response.json({
    ok,
    flag: { envOn: env.aiGatewayZdr(), forced: true },
    providers: env.aiGatewayZdrProviders(),
    calls: { text, vision, embeddings },
  })
}

export const GET = handle
export const POST = handle
