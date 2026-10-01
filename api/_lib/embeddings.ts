// Server-only embedding helper for the Altar threading + open-thread sweep.
// Uses OpenAI text-embedding-3-small (1536d). Batched so a few hundred prayers /
// thousands of entries embed in a handful of requests. Never logs text (§8).

import { createAiClient, gatewayBody, logGatewayError, resolveModelId, useAiGateway } from './aiClient.js'
import { env } from './env.js'

function openai() {
  // Backfill makes thousands of calls over many minutes — tolerate transient
  // network blips (connect timeouts) with generous SDK retries + a longer timeout
  // instead of letting one failed connection abort the whole run.
  return createAiClient({ maxRetries: 8, timeout: 60_000 })
}

// Per-input token cap is 8191; ~4 chars/token, so truncate well under that.
const MAX_INPUT_CHARS = 8000
// Inputs per request — keeps each call comfortably under the array + token caps.
const BATCH = 96

/** pgvector text literal — `[1,2,3]` — accepted as a text→vector cast by PostgREST. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(',')}]`
}

/** Cosine similarity of two equal-length vectors. 1 = identical direction. */
export function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    na += a[i]! * a[i]!
    nb += b[i]! * b[i]!
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/** Mean vector (centroid) of one or more equal-length vectors. */
export function centroid(vectors: number[][]): number[] {
  const n = vectors.length
  if (n === 0) return []
  const dim = vectors[0]!.length
  const out = new Array<number>(dim).fill(0)
  for (const v of vectors) for (let i = 0; i < dim; i++) out[i]! += v[i]!
  for (let i = 0; i < dim; i++) out[i]! /= n
  return out
}

/** Embed texts → one vector per input, in order. Empty input → empty array. */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const out: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH).map((t) => t.slice(0, MAX_INPUT_CHARS) || ' ')
    let res
    try {
      res = await openai().embeddings.create({
        model: resolveModelId(env.embedModel()),
        input: slice,
        ...gatewayBody(),
      })
    } catch (e) {
      if (useAiGateway()) logGatewayError(e)
      throw e
    }
    // Same line shape as callModel's, so one grep prices a run. Embeddings were
    // the one priced call that logged nothing. Counts only, never text (§8).
    console.log(
      `[tokens] name=embed model=${res.model ?? env.embedModel()} in=${res.usage?.prompt_tokens ?? 0} inputs=${slice.length}`,
    )
    // The API guarantees data is returned in input order, but sort by index to be safe.
    const sorted = [...res.data].sort((a, b) => a.index - b.index)
    for (const d of sorted) out.push(d.embedding as number[])
  }
  return out
}
