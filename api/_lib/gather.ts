/**
 * Gather — gate-first harvest (production port).
 *
 * Pure logic from lab/jev-classifier@9566d4c (`lunaTunedHarvest`, harvest=gate,
 * gb=6, hb=3, chunk=4000). No Jev / TypeSafe. Subject tagging is unchanged.
 *
 * Wired only when `GATHER_MODE=gate`. Flag-off harvest stays in altar.ts.
 */

import { callModel } from './openai.js'
import { harvestBatch, isVerbatim, type HarvestedPassage } from './altar.js'
import { writerWords } from './writerWords.js'

export interface Sentence {
  id: string
  text: string
  start: number
  end: number
}

/**
 * Split writer-words into sentences. `text` is always a substring of the
 * writer-words string (and therefore of the body, modulo H3 stripping).
 */
export function splitSentences(body: string): Sentence[] {
  const source = writerWords(body)
  if (!source.trim()) return []

  const spans: { start: number; end: number }[] = []
  const re = /[.!?]+(?:["”')\]]+)?(?=\s+|$)|(?:\n\s*\n)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const end = m.index + m[0].length
    pushTrimmed(source, last, end, spans)
    last = end
  }
  if (last < source.length) pushTrimmed(source, last, source.length, spans)

  return spans.map((s, i) => ({
    id: `s${i}`,
    text: source.slice(s.start, s.end),
    start: s.start,
    end: s.end,
  }))
}

function pushTrimmed(
  source: string,
  from: number,
  to: number,
  out: { start: number; end: number }[],
): void {
  const slice = source.slice(from, to)
  if (!slice.trim()) return
  const lead = slice.match(/^\s*/)?.[0].length ?? 0
  const trail = slice.match(/\s*$/)?.[0].length ?? 0
  out.push({ start: from + lead, end: to - trail })
}

export const KIND_RUBRIC = {
  prayer:
    'The sentence is addressed TO God (You / Lord / Jesus / Father / Holy Spirit) — a petition, thanks, confession, praise, lament, or longing spoken to God. Writing ABOUT prayer is not a prayer. A quoted Scripture verse is not the writer\'s prayer. Other people\'s words are not the writer\'s prayer.',
  sense:
    'A clear FIRST-PERSON experience of God speaking, leading, comforting, convicting, or showing the writer something (e.g. "God said to me", "I felt the Lord leading me"). Ordinary "I feel" about mood or weather is not a sense.',
  neither:
    'Narration, plans, self-reflection, what God is doing for other people, passing mentions of church or faith, writing about prayer, quoted Scripture, or anything that is not the writer addressing God or receiving a personal sense.',
} as const

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

export const GATE_PROMPT = `You read entries from one person's private faith journal. For EACH entry decide two things, using these criteria (stated once, apply to every entry):

prayer — ${KIND_RUBRIC.prayer}
sense — ${KIND_RUBRIC.sense}
neither — ${KIND_RUBRIC.neither}

contains_prayer = true if at least one sentence of the entry is a prayer by the criteria above.
contains_sense = true if at least one sentence is a sense by the criteria above.
Answer for every id. Return JSON only.`

export const GATE_SCHEMA = {
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

const GATE_BATCH = 6
const SPAN_BATCH = 3
const CHUNK_CHARS = 4000
const POOL = 3
const PER_ENTRY_CAP = 5

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

export interface GatherHarvestDeps {
  callModel?: typeof callModel
  harvestBatch?: typeof harvestBatch
}

export interface GatherHarvestResult {
  byEntry: Map<string, HarvestedPassage[]>
  failed: string[]
  gate: Map<string, { containsPrayer: boolean; containsSense: boolean }>
}

/**
 * Gate-first harvest used by harvestPrayers when GATHER_MODE=gate.
 *
 * Gate 6 chunks per call (`gather_gate`). Fail-open on a throw or an unanswered
 * id. Span-harvest gate-positive chunks 3 per call via production harvestBatch
 * (log name `altar_harvest`). Verbatim against the full body and writerWords.
 * Cap 5 passages per entry across chunks.
 */
export async function gatherHarvest(
  entries: { id: string; body: string }[],
  deps: GatherHarvestDeps = {},
): Promise<GatherHarvestResult> {
  const call = deps.callModel ?? callModel
  const harvest = deps.harvestBatch ?? harvestBatch
  const chunks: { id: string; entryId: string; body: string }[] = []
  for (const e of entries) {
    const parts = chunkWriterWords(e.body, CHUNK_CHARS)
    parts.forEach((body, k) => chunks.push({ id: parts.length === 1 ? e.id : `${e.id}::${k}`, entryId: e.id, body }))
  }
  const gate = new Map<string, { containsPrayer: boolean; containsSense: boolean }>()
  const failed = new Set<string>()
  const positive = new Set<string>()

  await mapPool(batches(chunks, GATE_BATCH), POOL, async (b) => {
    try {
      const out = await call<{ entries?: { id: string; contains_prayer?: boolean; contains_sense?: boolean }[] }>(
        GATE_PROMPT,
        { entries: b.map((c) => ({ id: c.id, text: c.body })) },
        GATE_SCHEMA as unknown as Record<string, unknown>,
        'gather_gate',
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

  const toHarvest = chunks.filter((c) => positive.has(c.id))
  const byEntry = new Map<string, HarvestedPassage[]>()
  const bodyOf = new Map(entries.map((e) => [e.id, e.body]))
  await mapPool(batches(toHarvest, SPAN_BATCH), POOL, async (b) => {
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

  return { byEntry, failed: [...failed], gate }
}
