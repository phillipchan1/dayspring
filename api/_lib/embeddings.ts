// Server-only embedding helper for the Altar threading + open-thread sweep.
// Uses OpenAI text-embedding-3-small (1536d). Batched so a few hundred prayers /
// thousands of entries embed in a handful of requests. Never logs text (§8).

import OpenAI from 'openai'
import { env } from './env.js'

let client: OpenAI | null = null
function openai(): OpenAI {
  // Backfill makes thousands of calls over many minutes — tolerate transient
  // network blips (connect timeouts) with generous SDK retries + a longer timeout
  // instead of letting one failed connection abort the whole run.
  if (!client) client = new OpenAI({ apiKey: env.openaiKey(), maxRetries: 8, timeout: 60_000 })
  return client
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
    const res = await openai().embeddings.create({ model: env.embedModel(), input: slice })
    // The API guarantees data is returned in input order, but sort by index to be safe.
    const sorted = [...res.data].sort((a, b) => a.index - b.index)
    for (const d of sorted) out.push(d.embedding as number[])
  }
  return out
}
