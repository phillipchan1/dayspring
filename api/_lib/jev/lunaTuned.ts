/**
 * Lab-only "luna-tuned" arm: the Jev tuning ideas ported to Luna (gpt-6-luna).
 * Not imported by any production path. Production harvestTexts / tagTexts /
 * Keeping read are unchanged; this file only wraps the exported pure halves
 * (harvestBatch, tagTexts, callModel) with different structure and prompts.
 *
 * Levers (each switchable so dev can pick):
 *  - harvest: 'gate' = no cue prefilter, cheap batched entry gate (Jev rubric
 *    wording, criteria stated once), long entries split into chunks instead of
 *    truncated, span harvest only on gate-positive chunks in smaller batches.
 *    'nocue' = same chunking and small batches but no gate. 'prod' = production.
 *  - tagBatch: smaller subject-tag batches (production is 6).
 *  - sentiment: tight emotion definitions + exclusion rules; a `denied` field
 *    the model fills before `emotions` (dropped in code); optional 'lp' mode
 *    that asks one boolean per emotion at reasoning_effort=none and reads token
 *    logprobs as confidences, so per-emotion thresholds can be fit on dev.
 *    (gpt-6-luna rejects `logprobs` at any effort other than none, and returns
 *    only the chosen token in top_logprobs, so p = exp(lp) of the chosen value.)
 */

import OpenAI from 'openai'
import { callModel } from '../openai.js'
import { env } from '../env.js'
import { harvestBatch, isVerbatim, type HarvestedPassage } from '../altar.js'
import { tagTexts, type SubjectTag } from '../declared.js'
import { writerWords } from '../writerWords.js'
import { EMOTIONS, type Emotion } from '../keepingRead.js'
import { EMO_DEF, SENTIMENT_RULES_TIGHT, type JevSentiment, type ValenceBucket } from './sentiment.js'
import { finalizeEmotions, type FittedEmotionThresholds } from './sentimentThresholds.js'
import { KIND_RUBRIC } from './harvest.js'
import { splitSentences } from './sentences.js'

// ── variant parsing ─────────────────────────────────────────────────────────

export interface LunaTunedVariant {
  harvest: 'gate' | 'nocue' | 'prod'
  gateBatch: number
  harvestBatch: number
  chunkChars: number
  tagBatch: number
  tight: boolean
  denial: boolean
  lp: boolean
}

export const DEFAULT_LUNA_TUNED: LunaTunedVariant = {
  harvest: 'gate',
  gateBatch: 6,
  harvestBatch: 3,
  chunkChars: 4000,
  tagBatch: 2,
  tight: true,
  denial: true,
  lp: false,
}

/** `harvest=gate,gb=6,hb=3,chunk=4000,tb=2,sent=tight+denial+lp` (any subset; rest default). */
export function parseLunaVariant(raw?: string): LunaTunedVariant {
  const v: LunaTunedVariant = { ...DEFAULT_LUNA_TUNED }
  if (!raw) return v
  for (const part of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [k, val = ''] = part.split('=')
    const n = Number(val)
    if (k === 'harvest') {
      if (val !== 'gate' && val !== 'nocue' && val !== 'prod') throw new Error(`luna-variant harvest=${val}`)
      v.harvest = val
    } else if (k === 'gb' && n > 0) v.gateBatch = n
    else if (k === 'hb' && n > 0) v.harvestBatch = n
    else if (k === 'chunk' && n >= 500) v.chunkChars = n
    else if (k === 'tb' && n > 0) v.tagBatch = n
    else if (k === 'sent') {
      const toks = val.split('+').filter(Boolean)
      const bad = toks.filter((t) => !['tight', 'denial', 'lp', 'plain'].includes(t))
      if (bad.length) throw new Error(`luna-variant sent tokens: ${bad.join(',')}`)
      v.tight = toks.includes('tight')
      v.denial = toks.includes('denial')
      v.lp = toks.includes('lp')
    } else throw new Error(`luna-variant: unknown part "${part}"`)
  }
  return v
}

export function formatLunaVariant(v: LunaTunedVariant): string {
  const sent = [v.tight && 'tight', v.denial && 'denial', v.lp && 'lp'].filter(Boolean).join('+') || 'plain'
  return `harvest=${v.harvest},gb=${v.gateBatch},hb=${v.harvestBatch},chunk=${v.chunkChars},tb=${v.tagBatch},sent=${sent}`
}

// ── small helpers ───────────────────────────────────────────────────────────

async function mapPool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      out[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker))
  return out
}

function batches<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/**
 * Split an entry's writer-words into ≤maxChars chunks on sentence boundaries
 * (a single over-long sentence becomes its own chunk). Every chunk is a
 * contiguous substring of writerWords(body), so verbatim checks still hold.
 */
export function chunkWriterWords(body: string, maxChars: number): string[] {
  const source = writerWords(body)
  if (source.length <= maxChars) return source.trim() ? [source] : []
  const sents = splitSentences(body)
  const out: string[] = []
  let start = -1
  let end = -1
  for (const s of sents) {
    if (start === -1) {
      start = s.start
      end = s.end
    } else if (s.end - start <= maxChars) {
      end = s.end
    } else {
      out.push(source.slice(start, end))
      start = s.start
      end = s.end
    }
  }
  if (start !== -1) out.push(source.slice(start, end))
  return out
}

// ── gate-first harvest ──────────────────────────────────────────────────────

export const GATE_PROMPT = `You read entries from one person's private faith journal. For EACH entry decide two things, using these criteria (stated once, apply to every entry):

prayer — ${KIND_RUBRIC.prayer}
sense — ${KIND_RUBRIC.sense}
neither — ${KIND_RUBRIC.neither}

contains_prayer = true if at least one sentence of the entry is a prayer by the criteria above.
contains_sense = true if at least one sentence is a sense by the criteria above.
Answer for every id. Return JSON only.`

const GATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['entries'],
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'contains_prayer', 'contains_sense'],
        properties: {
          id: { type: 'string' },
          contains_prayer: { type: 'boolean' },
          contains_sense: { type: 'boolean' },
        },
      },
    },
  },
} as const

export interface LunaHarvestDeps {
  callModel?: typeof callModel
  harvestBatch?: typeof harvestBatch
}

export interface LunaHarvestResult {
  byEntry: Map<string, HarvestedPassage[]>
  failed: string[]
  gate: Map<string, { containsPrayer: boolean; containsSense: boolean }>
  /** Chunks sent to span harvest (after the gate). */
  harvestedChunks: number
  totalChunks: number
}

const POOL = 3
const PER_ENTRY_CAP = 5

export async function lunaTunedHarvest(
  entries: { id: string; body: string }[],
  variant: LunaTunedVariant,
  deps: LunaHarvestDeps = {},
): Promise<LunaHarvestResult> {
  const call = deps.callModel ?? callModel
  const harvest = deps.harvestBatch ?? harvestBatch
  const chunks: { id: string; entryId: string; body: string }[] = []
  for (const e of entries) {
    const parts = chunkWriterWords(e.body, variant.chunkChars)
    parts.forEach((body, k) => chunks.push({ id: parts.length === 1 ? e.id : `${e.id}::${k}`, entryId: e.id, body }))
  }
  const gate = new Map<string, { containsPrayer: boolean; containsSense: boolean }>()
  const failed = new Set<string>()
  let toHarvest = chunks

  if (variant.harvest === 'gate') {
    const positive = new Set<string>()
    await mapPool(batches(chunks, variant.gateBatch), POOL, async (b) => {
      try {
        const out = await call<{ entries?: { id: string; contains_prayer?: boolean; contains_sense?: boolean }[] }>(
          GATE_PROMPT,
          { entries: b.map((c) => ({ id: c.id, text: c.body })) },
          GATE_SCHEMA as unknown as Record<string, unknown>,
          'altar_harvest_gate',
          'low',
          600,
        )
        const byId = new Map((out.entries ?? []).map((r) => [r.id, r]))
        for (const c of b) {
          const r = byId.get(c.id)
          const cur = gate.get(c.entryId) ?? { containsPrayer: false, containsSense: false }
          if (!r) {
            // unanswered chunk: send it on to span harvest rather than drop it
            positive.add(c.id)
            continue
          }
          cur.containsPrayer ||= r.contains_prayer === true
          cur.containsSense ||= r.contains_sense === true
          gate.set(c.entryId, cur)
          if (r.contains_prayer || r.contains_sense) positive.add(c.id)
        }
      } catch {
        for (const c of b) positive.add(c.id) // fail open to the span pass
      }
    })
    toHarvest = chunks.filter((c) => positive.has(c.id))
  }

  const byEntry = new Map<string, HarvestedPassage[]>()
  const bodyOf = new Map(entries.map((e) => [e.id, e.body]))
  await mapPool(batches(toHarvest, variant.harvestBatch), POOL, async (b) => {
    const res = await harvest(b.map((c) => ({ id: c.id, body: c.body })))
    if (res === null) {
      for (const c of b) failed.add(c.entryId)
      return
    }
    for (const c of b) {
      const ps = res.get(c.id) ?? []
      const full = bodyOf.get(c.entryId) ?? ''
      const own = writerWords(full)
      const kept = ps.filter((p) => isVerbatim(own, p.text) && isVerbatim(full, p.text))
      if (!kept.length) continue
      const cur = byEntry.get(c.entryId) ?? []
      byEntry.set(c.entryId, [...cur, ...kept].slice(0, PER_ENTRY_CAP))
    }
  })

  // Without a separate gate, the entry gate is "any span kept".
  if (variant.harvest !== 'gate') {
    for (const e of entries) {
      const ps = byEntry.get(e.id) ?? []
      gate.set(e.id, {
        containsPrayer: ps.some((p) => p.type === 'prayer'),
        containsSense: ps.some((p) => p.type === 'sense'),
      })
    }
  }
  return { byEntry, failed: [...failed], gate, harvestedChunks: toHarvest.length, totalChunks: chunks.length }
}

// ── subjects ────────────────────────────────────────────────────────────────

/** Production tagTexts, called on smaller slices so each model call sees `size` notes. */
export async function lunaTunedTag(
  lines: { id: string; content: string }[],
  variant: LunaTunedVariant,
  deps: { tagTexts?: typeof tagTexts } = {},
): Promise<Map<string, SubjectTag[]>> {
  const tag = deps.tagTexts ?? tagTexts
  const merged = new Map<string, SubjectTag[]>()
  // tagTexts batches by 6 internally; a slice ≤6 is exactly one call.
  const size = Math.min(variant.tagBatch, 6)
  const res = await mapPool(batches(lines, size), POOL, (b) => tag(b))
  for (const m of res) for (const [k, v] of m) merged.set(k, v)
  return merged
}

// ── sentiment ───────────────────────────────────────────────────────────────

const BASE_RULES = `- Estimate only emotion EXPRESSED BY THE WRITER.
- present=false is normal. For absent emotion return valence=0, activation=0 and no emotions.
- Valence is pleasantness, never goodness, in [-1, 1]. Activation is felt energy in [0, 1].
- Emotion is not spiritual discernment. Never infer faith, maturity, or diagnosis.`

export function lunaSentimentSystem(v: LunaTunedVariant): string {
  const defs = EMOTIONS.map((e) => `- ${e}: ${v.tight ? EMO_DEF[e] : e}`).join('\n')
  const rules = v.tight ? `${SENTIMENT_RULES_TIGHT}\n` : ''
  const denial = v.denial
    ? `\nFirst fill "denied": every emotion from the list the page NAMES but the writer does not feel — negated or denied ("I'm not angry", "I don't feel afraid"), someone else's feeling, or a quoted song/verse/speaker. An emotion in "denied" must not be marked as felt.`
    : ''
  const shape = v.lp
    ? `Then set each feels_<emotion> boolean: true only if the writer themselves feels it on this page.`
    : `Then list at most four felt emotions in "emotions".`
  return `You read ONE page from a private Christian journal and estimate the WRITER's own expressed emotion.

${rules}${BASE_RULES}

Emotion definitions (use exactly these meanings):
${defs}
${denial}
${shape}
Return JSON only.`
}

export function lunaSentimentSchema(v: LunaTunedVariant): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  const required: string[] = []
  if (v.denial) {
    props.denied = { type: 'array', items: { type: 'string', enum: [...EMOTIONS] } }
    required.push('denied')
  }
  props.present = { type: 'boolean' }
  props.valence = { type: 'number' }
  props.activation = { type: 'number' }
  required.push('present', 'valence', 'activation')
  if (v.lp) {
    for (const e of EMOTIONS) {
      props[`feels_${e}`] = { type: 'boolean' }
      required.push(`feels_${e}`)
    }
  } else {
    props.emotions = { type: 'array', maxItems: 4, items: { type: 'string', enum: [...EMOTIONS] } }
    required.push('emotions')
  }
  return { type: 'object', additionalProperties: false, required, properties: props }
}

export interface LogprobToken {
  token: string
  logprob: number
}

/**
 * p(true) for every JSON boolean field, from the chosen-token logprobs.
 * The chosen token's probability is exp(logprob); for a `false` answer p(true) = 1 − that.
 */
export function booleanProbs(tokens: readonly LogprobToken[]): Record<string, number> {
  const out: Record<string, number> = {}
  let text = ''
  for (const t of tokens) {
    const tok = t.token.trim()
    if (tok === 'true' || tok === 'false') {
      const key = /"([A-Za-z0-9_]+)"\s*:\s*$/.exec(text)?.[1]
      if (key) {
        const p = Math.exp(t.logprob)
        out[key] = tok === 'true' ? p : 1 - p
      }
    }
    text += t.token
  }
  return out
}

let lpClient: OpenAI | null = null

/** Lab-local call with logprobs (callModel does not expose them). Logs the same [tokens] line. */
export async function callModelLogprobs<T>(
  system: string,
  input: unknown,
  schema: Record<string, unknown>,
  name: string,
  maxTokens = 500,
): Promise<{ out: T; tokens: LogprobToken[] }> {
  if (!lpClient) lpClient = new OpenAI({ apiKey: env.openaiKey(), maxRetries: 8, timeout: 60_000 })
  const model = env.model()
  for (let attempt = 0; attempt < 2; attempt++) {
    const t0 = Date.now()
    const c = await lpClient.chat.completions.create({
      model,
      reasoning_effort: 'none',
      logprobs: true,
      top_logprobs: 1,
      max_completion_tokens: attempt === 0 ? maxTokens : maxTokens * 2,
      response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(input) },
      ],
    } as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming)
    const u = c.usage as
      | { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number }; completion_tokens_details?: { reasoning_tokens?: number } }
      | undefined
    console.log(
      `[tokens] name=${name} model=${model} in=${u?.prompt_tokens ?? 0} cached=${u?.prompt_tokens_details?.cached_tokens ?? 0} ` +
        `out=${u?.completion_tokens ?? 0} reasoning=${u?.completion_tokens_details?.reasoning_tokens ?? 0} attempt=${attempt} ms=${Date.now() - t0}`,
    )
    const raw = c.choices[0]?.message?.content
    if (raw) {
      try {
        const tokens = (c.choices[0]?.logprobs?.content ?? []).map((t) => ({ token: t.token, logprob: t.logprob }))
        return { out: JSON.parse(raw) as T, tokens }
      } catch {
        /* retry */
      }
    }
  }
  throw new Error('Model returned malformed output after retry')
}

function bucket(v: number): ValenceBucket {
  if (v < -0.33) return 'negative'
  if (v > 0.33) return 'positive'
  return 'mixed'
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export interface LunaSentimentDeps {
  callModel?: typeof callModel
  callModelLogprobs?: typeof callModelLogprobs
}

type RawSentiment = {
  denied?: string[]
  present?: boolean
  valence?: number
  activation?: number
  emotions?: string[]
} & Record<string, unknown>

export async function lunaTunedSentiment(
  text: string,
  variant: LunaTunedVariant,
  opts: { thresholds?: FittedEmotionThresholds | null } = {},
  deps: LunaSentimentDeps = {},
): Promise<JevSentiment> {
  const system = lunaSentimentSystem(variant)
  const schema = lunaSentimentSchema(variant)
  const input = { text: text.slice(0, 20_000) }
  const allowed = new Set<string>(EMOTIONS)
  let out: RawSentiment
  let emoProbs: Record<string, number> = {}
  let presentProb: number
  if (variant.lp) {
    const res = await (deps.callModelLogprobs ?? callModelLogprobs)<RawSentiment>(system, input, schema, 'lab_sentiment_tuned', 500)
    out = res.out
    const probs = booleanProbs(res.tokens)
    for (const e of EMOTIONS) {
      const key = `feels_${e}`
      emoProbs[e] = probs[key] ?? (out[key] === true ? 1 : 0)
    }
    presentProb = probs.present ?? (out.present === true ? 1 : 0)
  } else {
    out = await (deps.callModel ?? callModel)<RawSentiment>(system, input, schema, 'lab_sentiment_tuned', 'low', 400)
    emoProbs = {}
    for (const e of out.emotions ?? []) if (allowed.has(e)) emoProbs[e] = 1
    presentProb = out.present === true ? 1 : 0
  }
  const present = out.present === true
  const denied = (out.denied ?? []).filter((e) => allowed.has(e))
  const emotions = finalizeEmotions({
    present,
    probs: emoProbs,
    denied,
    thresholds: variant.lp ? opts.thresholds ?? null : null,
    max: 4,
  })
  const valence = present ? clamp(out.valence ?? 0, -1, 1) : 0
  const activation = present ? clamp(out.activation ?? 0, 0, 1) : 0
  return {
    present,
    valenceBucket: present ? bucket(valence) : 'mixed',
    valence,
    valenceExpected: valence,
    valenceLevel: present ? (valence < -0.33 ? 1 : valence > 0.33 ? 3 : 2) : 2,
    activation,
    emotions: emotions as Emotion[],
    denied: denied as Emotion[],
    primary: null,
    primaryConfidence: 0,
    variant: `luna-tuned:${formatLunaVariant(variant)}`,
    probs: { present: presentProb, valence, activation, emotions: emoProbs },
    confidence: Math.max(presentProb, 1 - presentProb),
  }
}
