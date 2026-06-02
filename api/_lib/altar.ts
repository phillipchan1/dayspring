// The Altar engine: embeds prayers/senses + entries, clusters recurring prayer
// lines into threads, migrates the legacy binary into encounters, and (weekly)
// lays EVIDENCE beside open threads. Runs server-side only (backfill + cron) —
// the client never embeds or calls OpenAI.
//
// Governing principle: light = ENCOUNTER, not transaction. Nothing here ever
// writes an `encounters` row from inference, and the weekly sweep NEVER returns a
// movement label or a verdict — only a quote + a gentle question. Logs counts
// only, never entry/prayer text (§8).

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabaseAdmin'
import { callModel } from './openai'
import { centroid, cosine, embed, toVectorLiteral } from './embeddings'

// ── tuning knobs (cosine similarity of text-embedding-3-small) ───────────────
// Above STRONG: clearly the same prayer line → attach without asking the model.
// In [WEAK, STRONG): borderline → a cheap Nano "same line?" confirm decides.
// Below WEAK: a new thread. Conservative on purpose — a false split (two cairns
// for one prayer) is gentler than a false merge (collapsing distinct cries).
const STRONG = 0.78
const WEAK = 0.62
// Open-thread sweep: cosine DISTANCE (1 - sim); only entries this close are
// even shown to the Nano evidence pass.
const SWEEP_MAX_DISTANCE = 0.45
const PAGE = 1000

// ── shapes ───────────────────────────────────────────────────────────────────
interface ItemRow {
  id: string
  entry_id: string | null
  type: 'prayer' | 'sense'
  content: string
  created_at: string
  resolved_at: string | null
  thread_id: string | null
  embedding: number[] | null
}

interface Member {
  itemId: string
  emb: number[]
  date: string // effective (entry) date
  content: string
}

interface Cluster {
  id: string | null // existing thread id, or null until inserted
  members: Member[]
  centroid: number[]
  dirty: boolean // gained a member this run (existing) — needs an UPDATE
}

// ── small helpers ────────────────────────────────────────────────────────────
function parseVector(v: unknown): number[] | null {
  if (v == null) return null
  if (Array.isArray(v)) return v as number[]
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as number[]
    } catch {
      return null
    }
  }
  return null
}

function recomputeCentroid(c: Cluster): void {
  c.centroid = centroid(c.members.map((m) => m.emb))
}

function seedMember(c: Cluster): Member {
  // Earliest member is the seed (the planted prayer).
  return c.members.reduce((a, b) => (a.date <= b.date ? a : b))
}

/** All rows of a table for an owner, paginated past PostgREST's ~1000 cap. */
async function fetchAll<T>(
  sb: SupabaseClient,
  table: string,
  select: string,
  owner: string,
  refine?: (q: any) => any,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(table).select(select).eq('owner', owner).range(from, from + PAGE - 1)
    if (refine) q = refine(q)
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

// ── 1. embeddings ─────────────────────────────────────────────────────────────
// One embed pass + one BULK write per batch (set_*_embeddings RPC) — not a
// round-trip per row. The historical backfill embeds thousands of entries, so the
// write strategy, not the OpenAI calls, was the bottleneck.
const EMBED_WRITE_BATCH = 500

/**
 * Write a batch of embeddings in one statement via the bulk RPC. If that RPC
 * isn't present yet (migration 20260602010000 not applied), fall back to per-row
 * updates so a deploy never breaks the cron — applying the migration just makes
 * this fast. Re-check `error.code` rather than assuming the RPC exists.
 */
async function writeEmbeddings(
  sb: SupabaseClient,
  rpc: 'set_entry_embeddings' | 'set_item_embeddings',
  table: 'entries' | 'spiritual_items',
  owner: string,
  rows: { id: string; emb: number[] }[],
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await sb.rpc(rpc, {
    owner_id: owner,
    ids: rows.map((r) => r.id),
    embs: rows.map((r) => toVectorLiteral(r.emb)),
  })
  if (!error) return
  const missing = error.code === 'PGRST202' || /function|does not exist|not find/i.test(error.message ?? '')
  if (!missing) throw error
  console.warn(
    `[altar] ${rpc} not found — applying migration 20260602010000 enables bulk writes. Falling back to per-row updates.`,
  )
  await Promise.all(
    rows.map((r) =>
      sb.from(table).update({ embedding: toVectorLiteral(r.emb) }).eq('id', r.id).eq('owner', owner),
    ),
  )
}

/** Embed any entries / prayer-sense items that don't have an embedding yet. */
export async function embedUnembedded(
  owner: string,
): Promise<{ entries: number; items: number }> {
  const sb = supabaseAdmin()

  // Entries (the sweep searches these). Body text is the embedding input.
  const entries = await fetchAll<{ id: string; body_markdown: string }>(
    sb,
    'entries',
    'id, body_markdown',
    owner,
    (q) => q.is('embedding', null),
  )
  for (let i = 0; i < entries.length; i += EMBED_WRITE_BATCH) {
    const batch = entries.slice(i, i + EMBED_WRITE_BATCH)
    const vecs = await embed(batch.map((e) => e.body_markdown))
    await writeEmbeddings(sb, 'set_entry_embeddings', 'entries', owner, batch.map((e, k) => ({ id: e.id, emb: vecs[k]! })))
  }

  // Prayers + senses (the clustering input).
  const items = await fetchAll<{ id: string; content: string }>(
    sb,
    'spiritual_items',
    'id, content',
    owner,
    (q) => q.in('type', ['prayer', 'sense']).is('embedding', null),
  )
  for (let i = 0; i < items.length; i += EMBED_WRITE_BATCH) {
    const batch = items.slice(i, i + EMBED_WRITE_BATCH)
    const vecs = await embed(batch.map((it) => it.content))
    await writeEmbeddings(sb, 'set_item_embeddings', 'spiritual_items', owner, batch.map((it, k) => ({ id: it.id, emb: vecs[k]! })))
  }

  return { entries: entries.length, items: items.length }
}

// ── 2. clustering into threads ─────────────────────────────────────────────────
const SAME_LINE_PROMPT = `You compare two short notes from one person's private prayer journal.
Decide whether the SECOND is a RETURN to the SAME ongoing prayer as the FIRST — the same concern, the same
person/situation, the same petition carried forward over time — NOT merely the same broad theme.
Two notes about "my anxiety" and "praying for a friend's anxiety" are DIFFERENT lines. Be conservative:
when unsure, answer false. Return JSON {"same_line": boolean} only.`

const SAME_LINE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['same_line'],
  properties: { same_line: { type: 'boolean' } },
} as const

const LABEL_PROMPT = `You are labeling a thread of recurring prayer-journal notes (the same prayer carried over time).
Given the member notes, return JSON {"title": string, "carries": string[]}:
- title: a short, plain, reverent label for what is being prayed (max 6 words). No quotes, no punctuation flourish.
- carries: the specific people or groups being interceded FOR, as they are named in the notes (e.g. "Esther",
  "the kids", "Daniel"). Proper names or concrete groups only. Empty array if the prayer is about the writer
  themselves or names no one. Never invent a name that isn't in the text.`

const LABEL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'carries'],
  properties: {
    title: { type: 'string' },
    carries: { type: 'array', items: { type: 'string' } },
  },
} as const

async function confirmSameLine(a: string, b: string): Promise<boolean> {
  try {
    const out = await callModel<{ same_line: boolean }>(
      SAME_LINE_PROMPT,
      { first: a.slice(0, 600), second: b.slice(0, 600) },
      SAME_LINE_SCHEMA as Record<string, unknown>,
      'altar_same_line',
      'low',
      256,
    )
    return out.same_line === true
  } catch {
    return false // a failed confirm errs toward a new thread (false split), never a merge.
  }
}

async function labelThread(contents: string[]): Promise<{ title: string; carries: string[] }> {
  const seedFallback = (contents[0] ?? 'A prayer').split('\n')[0]!.slice(0, 60).trim()
  try {
    const out = await callModel<{ title: string; carries: string[] }>(
      LABEL_PROMPT,
      { notes: contents.slice(0, 6).map((c) => c.slice(0, 600)) },
      LABEL_SCHEMA as Record<string, unknown>,
      'altar_label',
      'low',
      400,
    )
    const title = (out.title || '').trim() || seedFallback
    const carries = Array.isArray(out.carries)
      ? out.carries.map((s) => s.trim()).filter(Boolean).slice(0, 8)
      : []
    return { title, carries }
  } catch {
    return { title: seedFallback, carries: [] }
  }
}

/**
 * Place every unthreaded prayer/sense into a thread (existing or new), grow the
 * cairns, (re)label touched threads, and prune any thread left empty. Idempotent:
 * already-threaded items are never re-clustered, so thread ids — and the
 * encounters that reference them — are stable across runs.
 */
export async function threadItems(
  owner: string,
): Promise<{ placed: number; newThreads: number; updatedThreads: number }> {
  const sb = supabaseAdmin()

  const rows = await fetchAll<ItemRow>(
    sb,
    'spiritual_items',
    'id, entry_id, type, content, created_at, resolved_at, thread_id, embedding',
    owner,
    (q) => q.in('type', ['prayer', 'sense']).order('created_at', { ascending: true }),
  )

  // Effective (source) date per item: the entry's date when linked, else the row's.
  const entryIds = [...new Set(rows.map((r) => r.entry_id).filter((x): x is string => !!x))]
  const entryDate = new Map<string, string>()
  for (let i = 0; i < entryIds.length; i += PAGE) {
    const slice = entryIds.slice(i, i + PAGE)
    const { data, error } = await sb.from('entries').select('id, created_at').in('id', slice)
    if (error) throw error
    for (const e of (data ?? []) as { id: string; created_at: string }[]) entryDate.set(e.id, e.created_at)
  }
  const effDate = (r: ItemRow) => (r.entry_id && entryDate.get(r.entry_id)) || r.created_at

  const toMember = (r: ItemRow): Member => ({
    itemId: r.id,
    emb: parseVector(r.embedding)!,
    date: effDate(r),
    content: r.content,
  })

  // Seed in-memory clusters from existing threads (preserve their ids).
  const clusters = new Map<string, Cluster>() // keyed by thread id; new clusters get a temp key
  for (const r of rows) {
    if (!r.thread_id || !parseVector(r.embedding)) continue
    const c = clusters.get(r.thread_id) ?? { id: r.thread_id, members: [], centroid: [], dirty: false }
    c.members.push(toMember(r))
    clusters.set(r.thread_id, c)
  }
  for (const c of clusters.values()) recomputeCentroid(c)

  const newClusters: Cluster[] = []
  const live = (): Cluster[] => [...clusters.values(), ...newClusters]

  // Place unthreaded items oldest-first so the earliest becomes each thread's seed.
  const unthreaded = rows
    .filter((r) => !r.thread_id && parseVector(r.embedding))
    .sort((a, b) => effDate(a).localeCompare(effDate(b)))

  let placed = 0
  for (const r of unthreaded) {
    const m = toMember(r)
    let best: Cluster | null = null
    let bestSim = -1
    for (const c of live()) {
      const sim = cosine(m.emb, c.centroid)
      if (sim > bestSim) {
        bestSim = sim
        best = c
      }
    }

    let target: Cluster | null = null
    if (best && bestSim >= STRONG) {
      target = best
    } else if (best && bestSim >= WEAK) {
      const ok = await confirmSameLine(seedMember(best).content, m.content)
      if (ok) target = best
    }

    if (target) {
      target.members.push(m)
      recomputeCentroid(target)
      if (target.id) target.dirty = true
    } else {
      const fresh: Cluster = { id: null, members: [m], centroid: m.emb.slice(), dirty: true }
      newClusters.push(fresh)
    }
    placed++
  }

  // Persist NEW threads (label, insert, link members).
  let newThreads = 0
  for (const c of newClusters) {
    if (c.members.length === 0) continue
    const seed = seedMember(c)
    const last = c.members.reduce((a, b) => (a.date >= b.date ? a : b))
    const { title, carries } = await labelThread([seed.content, ...c.members.map((m) => m.content)])
    const { data, error } = await sb
      .from('prayer_threads')
      .insert({
        owner,
        title,
        carries,
        planted_at: seed.date,
        last_touch_at: last.date,
        seed_item_id: seed.itemId,
        embedding: toVectorLiteral(c.centroid),
      })
      .select('id')
      .single()
    if (error) throw error
    const id = (data as { id: string }).id
    await sb
      .from('spiritual_items')
      .update({ thread_id: id })
      .in('id', c.members.map((m) => m.itemId))
    newThreads++
  }

  // Persist EXISTING threads that gained members (re-aggregate + relabel).
  let updatedThreads = 0
  for (const c of clusters.values()) {
    if (!c.dirty || !c.id) continue
    const seed = seedMember(c)
    const last = c.members.reduce((a, b) => (a.date >= b.date ? a : b))
    const { title, carries } = await labelThread([seed.content, ...c.members.map((m) => m.content)])
    await sb
      .from('prayer_threads')
      .update({
        title,
        carries,
        planted_at: seed.date,
        last_touch_at: last.date,
        seed_item_id: seed.itemId,
        embedding: toVectorLiteral(c.centroid),
      })
      .eq('id', c.id)
    // Link any members that weren't already attached.
    await sb
      .from('spiritual_items')
      .update({ thread_id: c.id })
      .in('id', c.members.map((m) => m.itemId))
    updatedThreads++
  }

  return { placed, newThreads, updatedThreads }
}

// ── 3. migrate the legacy binary → encounters ──────────────────────────────────
/**
 * One-time: every prayer marked answered the OLD way (spiritual_items.resolved_at)
 * becomes an `answered` encounter on its thread, dated to when it was marked. Then
 * the binary is retired in code. Idempotent — threads that already have an
 * encounter are left alone (one encounter per thread).
 */
export async function migrateLegacyAnswered(owner: string): Promise<{ migrated: number }> {
  const sb = supabaseAdmin()
  const resolved = await fetchAll<{
    entry_id: string | null
    resolved_at: string | null
    thread_id: string | null
  }>(
    sb,
    'spiritual_items',
    'entry_id, resolved_at, thread_id',
    owner,
    (q) => q.eq('type', 'prayer').not('resolved_at', 'is', null),
  )

  const existing = await fetchAll<{ thread_id: string }>(sb, 'encounters', 'thread_id', owner)
  const taken = new Set(existing.map((e) => e.thread_id))

  let migrated = 0
  for (const r of resolved) {
    if (!r.thread_id || taken.has(r.thread_id)) continue
    const { error } = await sb.from('encounters').insert({
      owner,
      thread_id: r.thread_id,
      movement: 'answered',
      named_at: r.resolved_at,
      source_entry_id: r.entry_id,
    })
    if (error) throw error
    taken.add(r.thread_id)
    migrated++
  }
  return { migrated }
}

// ── 3b. prayer harvest — surface prayers written in entry PROSE ────────────────
// The Altar is otherwise fed only by explicit /pray, /sense slash-commands, so a
// journal imported from elsewhere (never typed through the editor) shows almost
// nothing. This reads the prose and lays the prayers already there onto the
// altar — the writer's own VERBATIM words, never paraphrased. Auto-planted, easy
// to remove. Mirrors the Lamp's prose scan. Cost-bounded by a cue prefilter + a
// per-entry watermark (prayer_scanned_at) so an entry is read by the model once.

// Wide net: a journal entry with NONE of these almost never contains a prayer, so
// it skips the model entirely (marked scanned). Generous on purpose.
const HARVEST_CUE =
  /\b(lord|god|jesus|christ|holy spirit|pray(?:ing|ed|er|ers)?|amen|faith|bless(?:ed|ing|ings)?|forgive|forgiveness|grace|mercy|worship|hallelujah|hosanna|intercede|interceding|intercession|scripture|i feel like (?:god|the lord|he|you)|i sense|impression|he(?:'s| is) (?:saying|leading|showing|telling)|on my heart|cry out|petition|guide me|help me)\b/i

const HARVEST_LLM_BATCH = 6
const HARVEST_MAX_CHARS = 4000

const HARVEST_PROMPT = `You read entries from one person's private faith journal and surface the PRAYERS and SPIRITUAL
IMPRESSIONS already written in them — so they can be remembered, never judged.
For each given entry, extract every distinct:
 - prayer / petition / intercession — anything addressed to God, or asking / longing / interceding (for
   themselves or others) — type "prayer".
 - sense / impression / leading — a felt sense that God is speaking, prompting, comforting, or showing
   something — type "sense".
Cast a WIDE net: include brief prayers, implicit ones, and prayers woven into ordinary reflection. When in
doubt, include it.
HARD RULE: each "text" MUST be copied VERBATIM (exact characters) from THAT entry — a contiguous span of the
person's own words. Never paraphrase, summarize, translate, or invent. If an entry contains none, return an
empty prayers array for it.
Return JSON {"entries":[{"id": string, "prayers":[{"type":"prayer"|"sense","text": string}]}]}.`

const HARVEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['entries'],
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'prayers'],
        properties: {
          id: { type: 'string' },
          prayers: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['type', 'text'],
              properties: {
                type: { type: 'string', enum: ['prayer', 'sense'] },
                text: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const

const normalizeWs = (s: string) => s.replace(/\s+/g, ' ').trim()

/** The extracted passage must be the writer's actual words — a (whitespace-tolerant) substring. */
function isVerbatim(body: string, text: string): boolean {
  if (!text) return false
  if (body.includes(text)) return true
  return normalizeWs(body).includes(normalizeWs(text))
}

async function markScanned(sb: SupabaseClient, ids: string[]): Promise<void> {
  const stamp = new Date().toISOString()
  for (let i = 0; i < ids.length; i += 500) {
    const { error } = await sb
      .from('entries')
      .update({ prayer_scanned_at: stamp })
      .in('id', ids.slice(i, i + 500))
    if (error) throw error
  }
}

/** Dry-run plan: how many entries are unscanned, and how many clear the cue prefilter. */
export async function harvestPlan(owner: string): Promise<{ unscanned: number; candidates: number }> {
  const sb = supabaseAdmin()
  const all = await fetchAll<{ id: string; body_markdown: string }>(
    sb,
    'entries',
    'id, body_markdown',
    owner,
    (q) => q.is('prayer_scanned_at', null),
  )
  const candidates = all.filter((e) => HARVEST_CUE.test(e.body_markdown)).length
  return { unscanned: all.length, candidates }
}

/**
 * Harvest prayers/senses from the prose of entries not yet scanned. Creates
 * spiritual_items (source='scanned') dated to the entry, so the existing
 * embed→thread pipeline turns them into cairns. Idempotent: an entry is read by
 * the model at most once (prayer_scanned_at watermark); a failed batch is left
 * unmarked to retry. `opts.max` caps how many entries this run touches.
 */
export async function harvestPrayers(
  owner: string,
  opts: { max?: number } = {},
): Promise<{ scanned: number; candidates: number; planted: number }> {
  const sb = supabaseAdmin()

  const all = await fetchAll<{ id: string; created_at: string; body_markdown: string }>(
    sb,
    'entries',
    'id, created_at, body_markdown',
    owner,
    (q) => q.is('prayer_scanned_at', null).order('created_at', { ascending: true }),
  )
  const pool = opts.max ? all.slice(0, opts.max) : all

  const candidates = pool.filter((e) => HARVEST_CUE.test(e.body_markdown))
  const noncandidates = pool.filter((e) => !HARVEST_CUE.test(e.body_markdown))

  // Entries with no prayer cue: nothing to read, just mark them scanned.
  await markScanned(sb, noncandidates.map((e) => e.id))

  let planted = 0
  for (let i = 0; i < candidates.length; i += HARVEST_LLM_BATCH) {
    const batch = candidates.slice(i, i + HARVEST_LLM_BATCH)
    let out: { entries?: { id: string; prayers?: { type: string; text: string }[] }[] }
    try {
      out = await callModel(
        HARVEST_PROMPT,
        { entries: batch.map((e) => ({ id: e.id, text: e.body_markdown.slice(0, HARVEST_MAX_CHARS) })) },
        HARVEST_SCHEMA as Record<string, unknown>,
        'altar_harvest',
        'low',
        2000,
      )
    } catch {
      continue // leave this batch unmarked so it retries next run
    }

    const byId = new Map(batch.map((e) => [e.id, e]))
    const rows: Record<string, unknown>[] = []
    for (const r of out.entries ?? []) {
      const e = byId.get(r.id)
      if (!e) continue
      for (const p of r.prayers ?? []) {
        const text = (p.text || '').trim()
        if (!isVerbatim(e.body_markdown, text)) continue // honesty gate: the writer's own words only
        rows.push({
          owner,
          entry_id: e.id,
          type: p.type === 'sense' ? 'sense' : 'prayer',
          content: text,
          source: 'scanned',
          created_at: e.created_at, // date the cairn to when it was prayed, not now
        })
      }
    }
    if (rows.length > 0) {
      const { error } = await sb.from('spiritual_items').insert(rows)
      if (error) throw error
      planted += rows.length
    }
    await markScanned(sb, batch.map((e) => e.id))
  }

  return { scanned: pool.length, candidates: candidates.length, planted }
}

// ── 4. weekly open-thread evidence sweep (P2) ──────────────────────────────────
const CANDIDATE_PROMPT = `You help someone remember, with care. You are given one ongoing, still-open prayer (its title + the
original words) and ONE later journal entry that a similarity search flagged as possibly related.
Your ONLY job: decide if something in the later entry seems to STIR in relation to the prayer — worth the
writer pausing to look at — and pull the single most resonant VERBATIM sentence from the entry.
Hard rules:
- You NEVER decide whether the prayer was "answered" or how God moved. No verdict, no outcome, no movement word.
- "quote" MUST be copied character-for-character from the entry text. If nothing genuinely resonates, set
  is_movement=false and return an empty quote.
- one_line_reason: a soft observation ("something here seems to echo what you asked"), never a conclusion.
- gentle_question: an invitation to look ("Want to sit with this one?"), never "Was this answered?".
Return JSON {"is_movement": boolean, "quote": string, "one_line_reason": string, "gentle_question": string}.`

const CANDIDATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['is_movement', 'quote', 'one_line_reason', 'gentle_question'],
  properties: {
    is_movement: { type: 'boolean' },
    quote: { type: 'string' },
    one_line_reason: { type: 'string' },
    gentle_question: { type: 'string' },
  },
} as const

/**
 * For each OPEN (unencountered) thread: similarity-sweep entries written since the
 * thread's last touch, and let a cheap Nano pass lay one quote + gentle question
 * beside it as EVIDENCE. Never a verdict. One open candidate per thread.
 */
export async function sweepOpenThreads(owner: string): Promise<{ surfaced: number }> {
  const sb = supabaseAdmin()

  const threads = await fetchAll<{
    id: string
    title: string
    last_touch_at: string
    seed_item_id: string | null
    embedding: number[] | null
  }>(sb, 'prayer_threads', 'id, title, last_touch_at, seed_item_id, embedding', owner)

  const encountered = new Set(
    (await fetchAll<{ thread_id: string }>(sb, 'encounters', 'thread_id', owner)).map((e) => e.thread_id),
  )

  // Member entry_ids per thread (so a thread never "discovers" its own writing).
  const items = await fetchAll<{ thread_id: string | null; entry_id: string | null }>(
    sb,
    'spiritual_items',
    'thread_id, entry_id',
    owner,
    (q) => q.not('thread_id', 'is', null),
  )
  const memberEntries = new Map<string, Set<string>>()
  for (const it of items) {
    if (!it.thread_id || !it.entry_id) continue
    ;(memberEntries.get(it.thread_id) ?? memberEntries.set(it.thread_id, new Set()).get(it.thread_id)!).add(
      it.entry_id,
    )
  }

  const dismissed = new Set(
    (
      await fetchAll<{ thread_id: string; entry_id: string }>(
        sb,
        'altar_candidate_dismissals',
        'thread_id, entry_id',
        owner,
      )
    ).map((d) => `${d.thread_id}:${d.entry_id}`),
  )

  // Seed text per thread, for the Nano context.
  const seedIds = threads.map((t) => t.seed_item_id).filter((x): x is string => !!x)
  const seedText = new Map<string, string>()
  for (let i = 0; i < seedIds.length; i += PAGE) {
    const { data } = await sb
      .from('spiritual_items')
      .select('id, content')
      .in('id', seedIds.slice(i, i + PAGE))
    for (const s of (data ?? []) as { id: string; content: string }[]) seedText.set(s.id, s.content)
  }

  let surfaced = 0
  for (const t of threads) {
    if (encountered.has(t.id)) continue
    const emb = parseVector(t.embedding)
    if (!emb) continue

    const { data: matches, error } = await sb.rpc('match_entries_for_thread', {
      query_embedding: toVectorLiteral(emb),
      owner_id: owner,
      since: t.last_touch_at,
      match_count: 8,
    })
    if (error) throw error

    const own = memberEntries.get(t.id) ?? new Set<string>()
    const candidate = ((matches ?? []) as { entry_id: string; distance: number }[]).find(
      (m) => m.distance <= SWEEP_MAX_DISTANCE && !own.has(m.entry_id) && !dismissed.has(`${t.id}:${m.entry_id}`),
    )
    if (!candidate) continue

    const { data: entryRow } = await sb
      .from('entries')
      .select('body_markdown, created_at')
      .eq('id', candidate.entry_id)
      .maybeSingle()
    const body = (entryRow as { body_markdown: string; created_at: string } | null)?.body_markdown
    const createdAt = (entryRow as { created_at: string } | null)?.created_at
    if (!body || !createdAt) continue

    let out: { is_movement: boolean; quote: string; one_line_reason: string; gentle_question: string }
    try {
      out = await callModel(
        CANDIDATE_PROMPT,
        { prayer: { title: t.title, words: (seedText.get(t.seed_item_id ?? '') ?? '').slice(0, 600) }, later_entry: body.slice(0, 2400) },
        CANDIDATE_SCHEMA as Record<string, unknown>,
        'altar_candidate',
        'low',
        512,
      )
    } catch {
      continue
    }
    if (!out.is_movement || !out.quote) continue
    const at = body.indexOf(out.quote) // verbatim gate — drop fabricated quotes.
    if (at < 0) continue

    await sb.from('altar_candidates').upsert(
      {
        owner,
        thread_id: t.id,
        source_entry_id: candidate.entry_id,
        entry_date: createdAt.slice(0, 10),
        quote: out.quote,
        char_start: at,
        char_end: at + out.quote.length,
        one_line_reason: out.one_line_reason,
        gentle_question: out.gentle_question,
      },
      { onConflict: 'thread_id' },
    )
    surfaced++
  }

  return { surfaced }
}
