/**
 * Thin TypeSafe / Jev client for the recognition lab.
 *
 * Lab only: nothing in processing.ts, harvestPrayers, tagSubjects, or
 * api/keeping/read.ts imports this. Production classifier provider stays openai.
 *
 * Wire protocol (verified 2026-09-29 against https://docs.typesafe.ai/api.md):
 *   POST https://api.typesafe.ai/v1/systemone
 *   Authorization: Bearer <TYPESAFE_API_KEY>
 *   { model, state, questions } → { model, answers, usage: { input_tokens, output_tokens } }
 *
 * SDK RetryPolicy uses `maxRetries` (retries after the first attempt), not
 * `maxAttempts`. maxRetries: 3 → 4 attempts total, matching the brief.
 */

import {
  TypeSafeClient,
  type EntryType,
  type Fetch,
  type Questions,
  type SystemOneResult,
} from '@typesafe-ai/sdk'
import { env } from './env.js'

export type TypeSafeFetch = Fetch

export interface AskJevResult<Q extends Questions> {
  answers: SystemOneResult<Q>['answers']
  model: string
  usage: { input_tokens: number; output_tokens: number }
  ms: number
}

let injectedFetch: Fetch | undefined
let client: TypeSafeClient | null = null

/** Test hook — inject a fetch and drop the singleton so the next ask rebuilds. */
export function configureTypeSafe(opts: { fetch?: Fetch } = {}): void {
  injectedFetch = opts.fetch
  client = null
}

export function resetTypeSafe(): void {
  injectedFetch = undefined
  client = null
}

function getClient(): TypeSafeClient {
  if (client) return client
  const apiKey = env.typesafeKey()
  if (!apiKey) {
    throw new Error('Missing TYPESAFE_API_KEY — Jev lab calls need a TypeSafe key')
  }
  // Official field is maxRetries (after the first attempt), not maxAttempts.
  client = new TypeSafeClient({
    apiKey,
    defaultModel: env.typesafeModel(),
    timeout: 15_000,
    retry: { maxRetries: 3 },
    ...(injectedFetch ? { fetch: injectedFetch } : {}),
  })
  return client
}

/**
 * One System One call. Logs the same `[tokens]` line recognition-eval.ts parses.
 * Never logs state or answers (§8).
 */
export async function askJev<Q extends Questions>(
  name: string,
  state: EntryType,
  questions: Q,
): Promise<AskJevResult<Q>> {
  const t0 = Date.now()
  const resp = await getClient().systemOne({
    model: env.typesafeModel(),
    state,
    questions,
  })
  const ms = Date.now() - t0
  const input = resp.usage?.input_tokens ?? 0
  const output = resp.usage?.output_tokens ?? 0
  console.log(
    `[tokens] name=${name} model=${resp.model} in=${input} cached=0 out=${output} reasoning=0 attempt=0 ms=${Math.round(ms)}`,
  )
  return {
    answers: resp.answers,
    model: resp.model,
    usage: { input_tokens: input, output_tokens: output },
    ms,
  }
}

/** Dry-run token estimate: JSON chars / 4, matching the eval brief. */
export function estimateJevTokens(state: unknown, questions: unknown): number {
  return Math.ceil(JSON.stringify({ state, questions }).length / 4)
}
