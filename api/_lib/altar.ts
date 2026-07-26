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
import { supabaseAdmin } from './supabaseAdmin.js'
import { callModel } from './openai.js'
import { centroid, cosine, embed, toVectorLiteral } from './embeddings.js'

// ── clustering knob (cosine similarity of text-embedding-3-small) ────────────
// A prayer attaches to its nearest existing cairn when similarity ≥ this; else it
// starts a new one. PURE THRESHOLD — no per-pair model call (doesn't scale, and
// biased toward over-splitting). This is the recurring-CONCERN bar, not exact-line
// identity: tuned so years of "draw near to God" cries collapse into one tall
// heap rather than a thousand near-singletons. THE key tuning knob — raise it for
// more, smaller cairns; lower it for fewer, taller (riskier) merges.
const MERGE_THRESHOLD = 0.64
// Open-thread sweep: cosine DISTANCE (1 - sim); only entries this close are
// even shown to the Nano evidence pass.
const SWEEP_MAX_DISTANCE = 0.45
const PAGE = 1000
// Max ids in a single `.in('id', [...])` filter. PostgREST puts these in the URL;
// ~1000 uuids (~37 KB) blows the URL length limit → a bare 400 "Bad Request".
const IN_CHUNK = 150
// How many model/DB calls run at once in the bulk passes. The bottleneck was
// long SEQUENTIAL runs (they got killed before finishing); a small pool finishes
// in minutes. Nano's RPM/TPM easily absorbs this.
const POOL = 3

/** Run `fn` over items with bounded concurrency, preserving result order. */
async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    for (;;) {
      const idx = next++
      if (idx >= items.length) return
      out[idx] = await fn(items[idx]!, idx)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return out
}

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

/**
 * Link declared-thread members via the unified thread_members table (spiritual_item_id).
 * Idempotent — already-linked items are skipped via a query-first filter (the dedup
 * index is partial, so it can't be an ON CONFLICT target). Chunked to stay under
 * the PostgREST URL-length limit.
 */
async function linkDeclaredMembers(sb: SupabaseClient, threadId: string, rawItemIds: string[]): Promise<void> {
  // Dedupe within the batch first — the Diarly import stamps every item at noon, so
  // a cluster can carry the same itemId twice; a single INSERT of two identical rows
  // fails atomically on the partial unique index and never commits.
  const itemIds = [...new Set(rawItemIds)]
  if (itemIds.length === 0) return
  // Skip items already linked to this thread. The dedup index
  // (thread_members_item_uniq) is PARTIAL (WHERE spiritual_item_id IS NOT NULL), so
  // it can't be an ON CONFLICT target — a query-first filter is what keeps this
  // idempotent across resumable threadItems runs that re-link a grown cluster.
  const already = new Set<string>()
  for (let i = 0; i < itemIds.length; i += IN_CHUNK) {
    const { data, error } = await sb
      .from('thread_members')
      .select('spiritual_item_id')
      .eq('thread_id', threadId)
      .in('spiritual_item_id', itemIds.slice(i, i + IN_CHUNK))
    if (error) throw error
    for (const r of (data ?? []) as { spiritual_item_id: string }[]) already.add(r.spiritual_item_id)
  }
  const toInsert = itemIds.filter((id) => !already.has(id))
  for (let i = 0; i < toInsert.length; i += IN_CHUNK) {
    const rows = toInsert.slice(i, i + IN_CHUNK).map((id) => ({
      thread_id: threadId,
      spiritual_item_id: id,
      register: 'neutral',
    }))
    const { error } = await sb.from('thread_members').insert(rows)
    if (error) throw error
  }
}

/**
 * All rows of a table for an owner, paginated past PostgREST's ~1000 cap. Pass a
 * smaller `pageSize` for reads that include the `embedding` column — serializing
 * 1000 × 1536-float vectors in one statement blows the Postgres statement timeout
 * (57014); ~250 keeps each page well under it.
 */
async function fetchAll<T>(
  sb: SupabaseClient,
  table: string,
  select: string,
  owner: string,
  refine?: (q: any) => any,
  pageSize: number = PAGE,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    let q = sb.from(table).select(select).eq('owner', owner).range(from, from + pageSize - 1)
    if (refine) q = refine(q)
    const { data, error } = await q
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < pageSize) break
  }
  return out
}

// ── 1. embeddings ─────────────────────────────────────────────────────────────
// One embed pass + one BULK write per batch (set_*_embeddings RPC) — not a
// round-trip per row. The historical backfill embeds thousands of entries, so the
// write strategy, not the OpenAI calls, was the bottleneck.
// Small on purpose: a bulk vector UPDATE casting/writing N×1536 floats in one
// statement crosses Postgres's statement timeout (57014) well before you'd think
// — 100 keeps each write light and reliable.
// Small write batches: each set_*_embeddings RPC writes this many 1536-dim
// vectors (plus vector-index maintenance) in one statement. 100 exceeded the
// Postgres statement timeout on a large import; keep it well under.
const EMBED_WRITE_BATCH = 20

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
  const entryBatches: { id: string; body_markdown: string }[][] = []
  for (let i = 0; i < entries.length; i += EMBED_WRITE_BATCH) {
    entryBatches.push(entries.slice(i, i + EMBED_WRITE_BATCH))
  }
  await mapPool(entryBatches, POOL, async (batch) => {
    const vecs = await embed(batch.map((e) => e.body_markdown))
    await writeEmbeddings(sb, 'set_entry_embeddings', 'entries', owner, batch.map((e, k) => ({ id: e.id, emb: vecs[k]! })))
  })

  // Prayers + senses (the clustering input).
  const items = await fetchAll<{ id: string; content: string }>(
    sb,
    'spiritual_items',
    'id, content',
    owner,
    (q) => q.in('type', ['prayer', 'sense']).is('embedding', null),
  )
  const itemBatches: { id: string; content: string }[][] = []
  for (let i = 0; i < items.length; i += EMBED_WRITE_BATCH) {
    itemBatches.push(items.slice(i, i + EMBED_WRITE_BATCH))
  }
  await mapPool(itemBatches, POOL, async (batch) => {
    const vecs = await embed(batch.map((it) => it.content))
    await writeEmbeddings(sb, 'set_item_embeddings', 'spiritual_items', owner, batch.map((it, k) => ({ id: it.id, emb: vecs[k]! })))
  })

  return { entries: entries.length, items: items.length }
}

// ── 2. clustering into threads ─────────────────────────────────────────────────
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
 *
 * Writes to the UNIFIED threads table (kind='declared') + thread_members
 * (spiritual_item_id). The old prayer_threads table is no longer written.
 */
export async function threadItems(
  owner: string,
  opts: { max?: number } = {},
): Promise<{ placed: number; newThreads: number; updatedThreads: number; remaining: number }> {
  const sb = supabaseAdmin()

  const rawRows = await fetchAll<ItemRow>(
    sb,
    'spiritual_items',
    'id, entry_id, type, content, created_at, resolved_at, thread_id, embedding',
    owner,
    // `id` tiebreak keeps pagination STABLE: the Diarly import stamps every item at
    // noon, so ordering by created_at alone is non-deterministic across page
    // boundaries — rows get repeated or skipped, inflating heft and crashing the
    // member insert on duplicates.
    (q) => q.in('type', ['prayer', 'sense']).order('created_at', { ascending: true }).order('id', { ascending: true }),
    150, // small page: this read carries the embedding vector
  )

  // Quick lookup by id (also dedupes any rows a paginated read still repeated).
  const rowById = new Map(rawRows.map((r) => [r.id, r]))
  const rows = [...rowById.values()]

  // Effective (source) date per item: the entry's date when linked, else the row's.
  const entryIds = [...new Set(rows.map((r) => r.entry_id).filter((x): x is string => !!x))]
  const entryDate = new Map<string, string>()
  for (let i = 0; i < entryIds.length; i += IN_CHUNK) {
    const slice = entryIds.slice(i, i + IN_CHUNK)
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

  // Seed in-memory clusters from EXISTING declared threads in the unified threads table.
  // An item is already-threaded if it appears in thread_members.spiritual_item_id.
  // BOTH reads paginate (ordered for stability): a caught-up owner can have
  // thousands of declared threads, and one large cluster alone can exceed
  // PostgREST's 1000-row default — a truncated seed read would drop members from
  // linkedItemIds and re-thread them into DUPLICATE threads on the next resumable
  // tick (the bug that put items into 2+ threads).
  const declaredThreadIds = (
    await fetchAll<{ id: string }>(sb, 'threads', 'id', owner, (q) =>
      q.eq('kind', 'declared').eq('dismissed', false).order('id', { ascending: true }),
    )
  ).map((t) => t.id)
  const clusters = new Map<string, Cluster>()
  const linkedItemIds = new Set<string>() // spiritual_item_ids already in a declared thread_member

  for (let i = 0; i < declaredThreadIds.length; i += IN_CHUNK) {
    const ids = declaredThreadIds.slice(i, i + IN_CHUNK)
    for (let from = 0; ; from += PAGE) {
      const { data: mdata, error: merr } = await sb
        .from('thread_members')
        .select('id, thread_id, spiritual_item_id')
        .in('thread_id', ids)
        .not('spiritual_item_id', 'is', null)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (merr) throw merr
      const batch = (mdata ?? []) as { thread_id: string; spiritual_item_id: string }[]
      for (const m of batch) {
        linkedItemIds.add(m.spiritual_item_id)
        const row = rowById.get(m.spiritual_item_id)
        if (!row || !parseVector(row.embedding)) continue
        const c = clusters.get(m.thread_id) ?? { id: m.thread_id, members: [], centroid: [], dirty: false }
        c.members.push(toMember(row))
        clusters.set(m.thread_id, c)
      }
      if (batch.length < PAGE) break
    }
  }
  for (const c of clusters.values()) recomputeCentroid(c)

  const newClusters: Cluster[] = []
  const live = (): Cluster[] => [...clusters.values(), ...newClusters]

  // Place unthreaded items oldest-first so the earliest becomes each thread's seed.
  const allUnthreaded = rows
    .filter((r) => !linkedItemIds.has(r.id) && parseVector(r.embedding))
    .sort((a, b) => effDate(a).localeCompare(effDate(b)))

  // Bounded per call so a large archive (thousands of prayers) can never exceed the
  // function budget — the unbounded all-at-once pass timed out mid-insert and left
  // the field nearly empty. We place the OLDEST `max` first (earliest = each
  // thread's seed); the caller re-runs until `remaining` hits 0, re-seeding from the
  // threads this run created. Resumable by construction: already-linked items fall
  // out of `unthreaded` on the next run, so progress never repeats or regresses.
  const unthreaded = opts.max ? allUnthreaded.slice(0, opts.max) : allUnthreaded
  const remaining = allUnthreaded.length - unthreaded.length

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

    const target: Cluster | null = best && bestSim >= MERGE_THRESHOLD ? best : null

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

  // ── Phase 1: insert threads + members with seed titles — NO LLM calls.
  // This is fast (pure DB) and handles any archive size without timing out.
  // LLM relabeling of multi-member threads happens in relabelDeclaredThreads(),
  // called separately with a bounded per-run cap so it can never time out.
  const fresh = newClusters.filter((c) => c.members.length > 0)
  // Sequential to avoid overwhelming Postgres with hundreds of concurrent inserts.
  for (const c of fresh) {
    const seed = seedMember(c)
    const seedRow = rowById.get(seed.itemId)
    const title = seedTitle(seed.content)
    const { data, error } = await sb
      .from('threads')
      .insert({
        owner,
        label: title,
        label_ai: null,   // null = needs LLM relabeling; relabelDeclaredThreads() fills this
        kind: 'declared',
        type: seedRow?.type ?? 'prayer',
        seed_item_id: seed.itemId,
        dismissed: false,
        private: false,
      })
      .select('id')
      .single()
    if (error) throw error
    const id = (data as { id: string }).id
    await linkDeclaredMembers(sb, id, c.members.map((m) => m.itemId))
  }

  // Persist EXISTING threads that gained new members — just link, don't relabel here.
  // relabelDeclaredThreads() will update the label if the cluster has grown.
  const dirty = [...clusters.values()].filter((c) => c.dirty && c.id)
  for (const c of dirty) {
    // linkDeclaredMembers is idempotent — already-linked items are silently skipped.
    await linkDeclaredMembers(sb, c.id!, c.members.map((m) => m.itemId))
  }

  return { placed, newThreads: fresh.length, updatedThreads: dirty.length, remaining }
}

/**
 * LLM relabeling pass — give each multi-member declared thread a proper AI
 * label. Bounded by `max` so this can never time out. Threads with label_ai
 * already set are skipped; threads that grow (more members since last label)
 * are eligible again once label_ai is cleared by clearing it to null.
 *
 * Called daily from synthesize.ts after threadItems.
 */
export async function relabelDeclaredThreads(
  owner: string,
  opts: { max?: number } = {},
): Promise<{ relabeled: number }> {
  const sb = supabaseAdmin()

  // Threads that need labeling: label_ai is null AND they have ≥ LABEL_MIN_MEMBERS members.
  const { data: threadData } = await sb
    .from('threads')
    .select('id, seed_item_id')
    .eq('owner', owner)
    .eq('kind', 'declared')
    .eq('dismissed', false)
    .is('label_ai', null)
  if (!threadData || threadData.length === 0) return { relabeled: 0 }

  // Load member content for each candidate thread.
  type ThreadMeta = { id: string; seed_item_id: string | null }
  const candidates = (threadData as ThreadMeta[])
  const pool = opts.max ? candidates.slice(0, opts.max) : candidates

  let relabeled = 0
  await mapPool(pool, POOL, async (t) => {
    const { data: mdata } = await sb
      .from('thread_members')
      .select('spiritual_items(content, created_at)')
      .eq('thread_id', t.id)
      .not('spiritual_item_id', 'is', null)
    type MRow = { spiritual_items: { content: string; created_at: string } | null }
    const members = ((mdata ?? []) as unknown as MRow[])
      .map((m) => m.spiritual_items)
      .filter((x): x is { content: string; created_at: string } => !!x)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))

    if (members.length < LABEL_MIN_MEMBERS) {
      // Not enough members — use seed title and mark as done (set label_ai = label).
      const { data: seedRow } = await sb.from('spiritual_items').select('content').eq('id', t.seed_item_id ?? '').maybeSingle()
      const title = seedRow ? seedTitle((seedRow as { content: string }).content) : 'A prayer'
      await sb.from('threads').update({ label: title, label_ai: title }).eq('id', t.id).eq('owner', owner)
      relabeled++
      return
    }

    const memberObjs: Member[] = members.map((m) => ({ itemId: '', emb: [], date: m.created_at, content: m.content }))
    const { title } = await labelFor(memberObjs)
    await sb.from('threads').update({ label: title, label_ai: title }).eq('id', t.id).eq('owner', owner)
    relabeled++
  })

  return { relabeled }
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
// At most this many per entry — keeps an entry from spraying the field with
// fragments; the model is also told to return only the clearest.
const HARVEST_PER_ENTRY_CAP = 5

const HARVEST_PROMPT = `You read entries from one person's private faith journal and surface ONLY genuine PRAYERS and SENSES OF GOD
— the writer's own words — so they can be remembered. Be SELECTIVE. Precision matters far more than coverage.

Extract, as type "prayer": a passage ADDRESSED TO GOD (to You / Lord / Jesus / Father / Holy Spirit) — a
petition, intercession, confession, thanksgiving, praise, or longing directed to God.

Extract, as type "sense": a clear FIRST-PERSON experience of God speaking, leading, comforting, convicting, or
showing the writer something (e.g. "God said to me…", "I felt the Lord leading me to…").

Do NOT extract (leave these out entirely):
 - plain narration of events, people, or feelings ("then he walked out", "there was such an amazing energy there")
 - general self-reflection, plans, or resolutions NOT addressed to God ("i think i need to grow up and enjoy being here")
 - what God is doing for, or saying to, OTHER people; or others' words
 - passing mentions of God / church / faith that aren't themselves a prayer or a personal sense

Return only what is UNMISTAKABLY a prayer or a personal sense of God — at most the 5 clearest per entry. When
in doubt, leave it out.

HARD RULE: each "text" MUST be copied VERBATIM (exact characters) from THAT entry — a contiguous span of the
writer's own words. Never paraphrase, summarize, translate, or invent. If an entry contains none, return an
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

// Only recurring cairns (≥ this many touches) earn an LLM-generated title; a lone
// prayer IS its own label, so we derive its title from the seed text — no model
// call. Keeps labeling cost proportional to the (few) heaps, not every singleton.
const LABEL_MIN_MEMBERS = 2

const normalizeWs = (s: string) => s.replace(/\s+/g, ' ').trim()

/** A title for a single-prayer cairn: the seed's first line, trimmed. No model call. */
function seedTitle(content: string): string {
  const first = content.split('\n').find((l) => l.trim()) ?? content
  const t = normalizeWs(first)
  return t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t || 'A prayer'
}

/** Label a cluster — LLM only for recurring heaps; seed-derived for singletons. */
async function labelFor(members: Member[]): Promise<{ title: string; carries: string[] }> {
  const seed = members.reduce((a, b) => (a.date <= b.date ? a : b))
  if (members.length < LABEL_MIN_MEMBERS) return { title: seedTitle(seed.content), carries: [] }
  return labelThread([seed.content, ...members.map((m) => m.content)])
}

/** The extracted passage must be the writer's actual words — a (whitespace-tolerant) substring. */
function isVerbatim(body: string, text: string): boolean {
  if (!text) return false
  if (body.includes(text)) return true
  return normalizeWs(body).includes(normalizeWs(text))
}

async function markScanned(sb: SupabaseClient, ids: string[]): Promise<void> {
  const stamp = new Date().toISOString()
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { error } = await sb
      .from('entries')
      .update({ prayer_scanned_at: stamp })
      .in('id', ids.slice(i, i + IN_CHUNK))
    if (error) throw error
  }
}

/**
 * Undo a harvest: delete every scanned prayer/sense (NOT the explicit /pray
 * 'command' items, which are tied to editor fences) and clear the scan watermark
 * so the next harvest reads the whole archive fresh. Safe because scanned items
 * are never threaded until after harvest completes — here they're orphans.
 */
export async function resetHarvest(owner: string): Promise<{ deleted: number }> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('spiritual_items')
    .delete()
    .eq('owner', owner)
    .eq('source', 'scanned')
    .select('id')
  if (error) throw error

  // Sweep up cairns left memberless by that delete (preserve any still referenced
  // by a remaining explicit /pray item — and their encounters). Then re-cluster
  // from a clean slate on the next harvest.
  const { data: refd } = await sb
    .from('spiritual_items')
    .select('thread_id')
    .eq('owner', owner)
    .not('thread_id', 'is', null)
  const keep = [...new Set(((refd ?? []) as { thread_id: string }[]).map((r) => r.thread_id))]
  let del = sb.from('prayer_threads').delete().eq('owner', owner)
  if (keep.length) del = del.not('id', 'in', `(${keep.join(',')})`)
  const { error: delThreadsErr } = await del
  if (delThreadsErr) throw delThreadsErr

  const { error: clrErr } = await sb
    .from('entries')
    .update({ prayer_scanned_at: null })
    .eq('owner', owner)
    .not('prayer_scanned_at', 'is', null)
  if (clrErr) throw clrErr
  return { deleted: (data ?? []).length }
}

/**
 * Clear all thread assignments + delete threads (except any the user has named an
 * encounter on) so the next threadItems re-clusters from scratch — cheap, since
 * embeddings are kept (no re-harvest, no re-embed). For tuning MERGE_THRESHOLD.
 */
export async function resetThreads(owner: string): Promise<{ deletedThreads: number }> {
  const sb = supabaseAdmin()
  const enc = await fetchAll<{ thread_id: string }>(sb, 'encounters', 'thread_id', owner)
  const keep = [...new Set(enc.map((e) => e.thread_id))]

  let unlink = sb.from('spiritual_items').update({ thread_id: null }).eq('owner', owner).not('thread_id', 'is', null)
  if (keep.length) unlink = unlink.not('thread_id', 'in', `(${keep.join(',')})`)
  const { error } = await unlink
  if (error) throw error

  let del = sb.from('prayer_threads').delete().eq('owner', owner).select('id')
  if (keep.length) del = del.not('id', 'in', `(${keep.join(',')})`)
  const { data, error: delErr } = await del
  if (delErr) throw delErr
  return { deletedThreads: (data ?? []).length }
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

  // Batches run with bounded concurrency so the whole archive finishes in minutes
  // (a long sequential run kept getting killed before it could complete).
  const batches: typeof candidates[] = []
  for (let i = 0; i < candidates.length; i += HARVEST_LLM_BATCH) {
    batches.push(candidates.slice(i, i + HARVEST_LLM_BATCH))
  }

  const planted = (
    await mapPool(batches, POOL, async (batch) => {
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
        return 0 // leave this batch unmarked so it retries next run
      }

      const byId = new Map(batch.map((e) => [e.id, e]))
      const rows: Record<string, unknown>[] = []
      for (const r of out.entries ?? []) {
        const e = byId.get(r.id)
        if (!e) continue
        for (const p of (r.prayers ?? []).slice(0, HARVEST_PER_ENTRY_CAP)) {
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
      }
      await markScanned(sb, batch.map((e) => e.id))
      return rows.length
    })
  ).reduce((a, b) => a + b, 0)

  return { scanned: pool.length, candidates: candidates.length, planted }
}

// ── 3c. subjects — group prayers by what they're ABOUT (Altar v2) ──────────────
// A cairn is a SUBJECT (a person/place/theme you bring to God), not a text
// cluster. Each prayer is tagged with up to 3 subjects; subjects are canonicalized
// (so "trading discipline" + "playbook" become one) and become prayer_threads
// rows. Membership is many-to-many via item_subjects. A cairn's height in any
// season window = how many of its prayers fall in that window (computed by the
// altar_field RPC), so the same subject rises across all-time and settles in a
// season.

const SUBJECT_TAG_BATCH = 6
// Cosine bar for merging two subject LABELS into one canonical cairn. Labels are
// short, so they cluster much tighter than full prayers — a higher bar is safe.
const SUBJECT_MERGE = 0.62
const MAX_SUBJECTS_PER_PRAYER = 3

const TAG_PROMPT = `You read short prayers/notes from one person's private faith journal and identify what each is ABOUT — the
person(s), place(s), or recurring theme(s) it concerns — so prayers about the same thing gather into one cairn.

For each note return up to 3 subjects as {label, kind}:
 - kind "person": a specific person or group prayed for — use their NAME if the note names them ("Esther",
   "Daniel"); otherwise the relationship ("my wife", "the kids").
 - kind "place": a place / community / work context ("Frontier", "trading", "our home").
 - kind "theme": a recurring spiritual theme ("drawing near to God", "surrender", "patience", "anxiety").
Use SHORT canonical labels (1–4 words), lowercase except proper names, and REUSE the same label across notes
for the same thing.

Set keep=false with empty subjects when the note is NOT a substantive, specific prayer or sense — generic
devotional filler with no real subject ("make a way Lord"), or ordinary narration ("wearing new headphones,
feels good"). A "sense" only counts if it is a genuine sense of GOD speaking / leading / showing something
(never merely because the word "feel" appears).

Return JSON {"notes":[{"id":string,"keep":boolean,"subjects":[{"label":string,"kind":"person"|"place"|"theme"}]}]}.`

const TAG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['notes'],
  properties: {
    notes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'keep', 'subjects'],
        properties: {
          id: { type: 'string' },
          keep: { type: 'boolean' },
          subjects: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'kind'],
              properties: {
                label: { type: 'string' },
                kind: { type: 'string', enum: ['person', 'place', 'theme'] },
              },
            },
          },
        },
      },
    },
  },
} as const

interface RawTag {
  label: string
  kind: string
}

/**
 * Regroup every harvested prayer/sense by SUBJECT. Tags each prayer (filtering
 * filler + fixing "sense"), canonicalizes the subject vocabulary by embedding the
 * labels and merging near-duplicates, then rebuilds prayer_threads (subjects) +
 * item_subjects (membership). Idempotent: wipes prior subjects (those without an
 * encounter) and rebuilds. Assumes prayers are already embedded.
 */
export async function regroupSubjects(
  owner: string,
): Promise<{ tagged: number; kept: number; subjects: number; memberships: number }> {
  const sb = supabaseAdmin()

  const items = await fetchAll<ItemRow>(
    sb,
    'spiritual_items',
    'id, entry_id, type, content, created_at, resolved_at, thread_id, embedding',
    owner,
    (q) => q.in('type', ['prayer', 'sense']),
    150,
  )
  // Effective (source) date + embedding per item.
  const entryIds = [...new Set(items.map((r) => r.entry_id).filter((x): x is string => !!x))]
  const entryDate = new Map<string, string>()
  for (let i = 0; i < entryIds.length; i += IN_CHUNK) {
    const { data } = await sb.from('entries').select('id, created_at').in('id', entryIds.slice(i, i + IN_CHUNK))
    for (const e of (data ?? []) as { id: string; created_at: string }[]) entryDate.set(e.id, e.created_at)
  }
  const dateOf = (r: ItemRow) => (r.entry_id && entryDate.get(r.entry_id)) || r.created_at
  const embOf = new Map<string, number[]>()
  for (const r of items) {
    const e = parseVector(r.embedding)
    if (e) embOf.set(r.id, e)
  }

  // 1. Tag each prayer with its subjects (filter filler; fix sense).
  const batches: ItemRow[][] = []
  for (let i = 0; i < items.length; i += SUBJECT_TAG_BATCH) batches.push(items.slice(i, i + SUBJECT_TAG_BATCH))
  const itemTags = new Map<string, RawTag[]>() // itemId → raw subject tags
  await mapPool(batches, POOL, async (batch) => {
    let out: { notes?: { id: string; keep: boolean; subjects?: RawTag[] }[] }
    try {
      out = await callModel(
        TAG_PROMPT,
        { notes: batch.map((r) => ({ id: r.id, text: r.content.slice(0, 600) })) },
        TAG_SCHEMA as Record<string, unknown>,
        'altar_tag',
        'low',
        1200,
      )
    } catch {
      return
    }
    for (const n of out.notes ?? []) {
      if (!n.keep) continue
      const tags = (n.subjects ?? [])
        .map((s) => ({ label: (s.label || '').trim(), kind: s.kind }))
        .filter((s) => s.label)
        .slice(0, MAX_SUBJECTS_PER_PRAYER)
      if (tags.length) itemTags.set(n.id, tags)
    }
  })

  // 2. Canonicalize the subject vocabulary: embed distinct labels, greedily merge
  // near-duplicates into canonical subjects.
  const labelInfo = new Map<string, { orig: string; kind: Record<string, number>; count: number }>()
  for (const tags of itemTags.values()) {
    for (const t of tags) {
      const key = t.label.toLowerCase()
      const info = labelInfo.get(key) ?? { orig: t.label, kind: {}, count: 0 }
      info.count++
      info.kind[t.kind] = (info.kind[t.kind] ?? 0) + 1
      labelInfo.set(key, info)
    }
  }
  const labels = [...labelInfo.keys()].sort((a, b) => labelInfo.get(b)!.count - labelInfo.get(a)!.count)
  const labelVecs = new Map<string, number[]>()
  {
    const vecs = await embed(labels.map((l) => labelInfo.get(l)!.orig))
    labels.forEach((l, i) => labelVecs.set(l, vecs[i]!))
  }
  interface Canon {
    name: string
    kind: string
    centroid: number[]
    n: number
    members: string[] // lowercased labels in this canonical group
  }
  const canons: Canon[] = []
  const labelToCanon = new Map<string, number>()
  for (const l of labels) {
    const v = labelVecs.get(l)!
    let best = -1
    let bestSim = -1
    for (let i = 0; i < canons.length; i++) {
      const sim = cosine(v, canons[i]!.centroid)
      if (sim > bestSim) {
        bestSim = sim
        best = i
      }
    }
    const info = labelInfo.get(l)!
    if (best >= 0 && bestSim >= SUBJECT_MERGE) {
      const c = canons[best]!
      for (let d = 0; d < v.length; d++) c.centroid[d] = (c.centroid[d]! * c.n + v[d]!) / (c.n + 1)
      c.n++
      c.members.push(l)
      labelToCanon.set(l, best)
    } else {
      const kind = Object.entries(info.kind).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'theme'
      canons.push({ name: info.orig, kind, centroid: v.slice(), n: 1, members: [l] })
      labelToCanon.set(l, canons.length - 1)
    }
  }

  // 3. Assign each item to its canonical subjects (deduped).
  const itemCanons = new Map<string, Set<number>>()
  const canonItems = new Map<number, Set<string>>()
  for (const [itemId, tags] of itemTags) {
    const set = new Set<number>()
    for (const t of tags) {
      const ci = labelToCanon.get(t.label.toLowerCase())
      if (ci != null) set.add(ci)
    }
    if (!set.size) continue
    itemCanons.set(itemId, set)
    for (const ci of set) (canonItems.get(ci) ?? canonItems.set(ci, new Set()).get(ci)!).add(itemId)
  }

  // 4. Wipe prior subjects (those without an encounter) + their memberships, then rebuild.
  const enc = await fetchAll<{ thread_id: string }>(sb, 'encounters', 'thread_id', owner)
  const keepEnc = new Set(enc.map((e) => e.thread_id))
  await sb.from('item_subjects').delete().eq('owner', owner)
  {
    let del = sb.from('prayer_threads').delete().eq('owner', owner)
    if (keepEnc.size) del = del.not('id', 'in', `(${[...keepEnc].join(',')})`)
    const { error } = await del
    if (error) throw error
  }

  // 5. Insert subjects, then memberships.
  let memberships = 0
  const subjectIds = await mapPool([...canonItems.keys()], POOL, async (ci) => {
    const memberIds = [...canonItems.get(ci)!]
    const dates = memberIds.map((id) => dateOf(items.find((r) => r.id === id)!))
    const member_embs = memberIds.map((id) => embOf.get(id)).filter((x): x is number[] => !!x)
    const c = canons[ci]!
    const { data, error } = await sb
      .from('prayer_threads')
      .insert({
        owner,
        title: c.name,
        kind: c.kind,
        carries: c.kind === 'person' ? [c.name] : [],
        planted_at: dates.reduce((a, b) => (a <= b ? a : b)),
        last_touch_at: dates.reduce((a, b) => (a >= b ? a : b)),
        seed_item_id: null,
        embedding: member_embs.length ? toVectorLiteral(centroid(member_embs)) : null,
      })
      .select('id')
      .single()
    if (error) throw error
    const subjectId = (data as { id: string }).id
    const rows = memberIds.map((item_id) => ({ owner, item_id, subject_id: subjectId }))
    for (let i = 0; i < rows.length; i += 500) {
      const { error: e2 } = await sb.from('item_subjects').insert(rows.slice(i, i + 500))
      if (e2) throw e2
    }
    memberships += rows.length
    return subjectId
  })

  return {
    tagged: items.length,
    kept: itemTags.size,
    subjects: subjectIds.length,
    memberships,
  }
}

// ── 4. weekly open-thread evidence sweep (P2) ──────────────────────────────────
// Exported (not module-private) purely so the disabled evidence pass in
// sweepOpenThreads keeps its prompt under version control until the
// altar_candidates FK migration lets it write again. Nothing calls it today.
export const CANDIDATE_PROMPT = `You help someone remember, with care. You are given one ongoing, still-open prayer (its title + the
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

export const CANDIDATE_SCHEMA = {
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

  // Read declared threads from the unified threads table. We need the centroid
  // embedding for similarity search; threads that haven't been threaded yet (no
  // embedding) are skipped gracefully.
  const { data: threadData, error: threadErr } = await sb
    .from('threads')
    .select('id, label, label_ai, label_user, seed_item_id, span_end')
    .eq('owner', owner)
    .eq('kind', 'declared')
    .eq('dismissed', false)
  if (threadErr) throw threadErr

  // Build centroid embedding per thread from its members' embeddings (lazily, only
  // for threads that have members with embeddings — avoids an extra embed call).
  const threadIds = ((threadData ?? []) as { id: string }[]).map((t) => t.id)
  const threadCentroid = new Map<string, number[]>()
  const threadLastTouch = new Map<string, string>()

  if (threadIds.length > 0) {
    for (let i = 0; i < threadIds.length; i += IN_CHUNK) {
      const { data: mdata } = await sb
        .from('thread_members')
        .select('thread_id, spiritual_item_id, spiritual_items(embedding, created_at)')
        .in('thread_id', threadIds.slice(i, i + IN_CHUNK))
        .not('spiritual_item_id', 'is', null)
      type MemberEmbRow = { thread_id: string; spiritual_items: { embedding: unknown; created_at: string } | null }
      for (const m of (mdata ?? []) as unknown as MemberEmbRow[]) {
        if (!m.spiritual_items) continue
        const emb = parseVector(m.spiritual_items.embedding)
        if (!emb) continue
        const prev = threadCentroid.get(m.thread_id) ?? new Array(emb.length).fill(0)
        threadCentroid.set(m.thread_id, prev.map((v: number, i: number) => v + emb[i]!))
        const prevTouch = threadLastTouch.get(m.thread_id) ?? ''
        if (m.spiritual_items.created_at > prevTouch) threadLastTouch.set(m.thread_id, m.spiritual_items.created_at)
      }
    }
    // Normalize sum → centroid
    for (const [id, sumVec] of threadCentroid) {
      const n = sumVec.reduce((a: number, b: number) => a + (b !== 0 ? 1 : 0), 0) || 1
      threadCentroid.set(id, sumVec.map((v: number) => v / n))
    }
  }

  type ThreadRow = { id: string; label: string | null; label_ai: string | null; label_user: string | null; seed_item_id: string | null; span_end: string | null }
  const threads = (threadData ?? []) as ThreadRow[]

  // Encountered via thread_ref (the unified threads FK added by altar_converge).
  const encountered = new Set(
    (await fetchAll<{ thread_ref: string | null }>(sb, 'encounters', 'thread_ref', owner))
      .map((e) => e.thread_ref)
      .filter((x): x is string => !!x),
  )

  // Member entry_ids per thread (via thread_members → spiritual_items.entry_id).
  // Prevents a thread from "discovering" its own source entries.
  const memberEntries = new Map<string, Set<string>>()
  if (threadIds.length > 0) {
    for (let i = 0; i < threadIds.length; i += IN_CHUNK) {
      const { data: mdata } = await sb
        .from('thread_members')
        .select('thread_id, spiritual_items(entry_id)')
        .in('thread_id', threadIds.slice(i, i + IN_CHUNK))
        .not('spiritual_item_id', 'is', null)
      type MemberEntryRow = { thread_id: string; spiritual_items: { entry_id: string | null } | null }
      for (const m of (mdata ?? []) as unknown as MemberEntryRow[]) {
        const entryId = m.spiritual_items?.entry_id
        if (!entryId) continue
        ;(memberEntries.get(m.thread_id) ?? memberEntries.set(m.thread_id, new Set()).get(m.thread_id)!).add(entryId)
      }
    }
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

  // NOTE: the per-thread seed-text read that used to live here fed the disabled
  // evidence pass only. Restore it alongside the CANDIDATE_PROMPT call.

  let surfaced = 0
  for (const t of threads) {
    if (encountered.has(t.id)) continue
    const emb = threadCentroid.get(t.id)
    if (!emb) continue // no embedded members yet — skip until threadItems has run
    const lastTouch = threadLastTouch.get(t.id) ?? t.span_end ?? new Date(0).toISOString()

    const { data: matches, error } = await sb.rpc('match_entries_for_thread', {
      query_embedding: toVectorLiteral(emb),
      owner_id: owner,
      since: lastTouch,
      match_count: 8,
    })
    if (error) throw error

    const own = memberEntries.get(t.id) ?? new Set<string>()
    const candidate = ((matches ?? []) as { entry_id: string; distance: number }[]).find(
      (m) => m.distance <= SWEEP_MAX_DISTANCE && !own.has(m.entry_id) && !dismissed.has(`${t.id}:${m.entry_id}`),
    )
    if (!candidate) continue

    // The evidence pass is DISABLED, not just its write. altar_candidates.thread_id
    // still references prayer_threads.id (legacy FK), while declared threads now
    // live in threads.id — so nothing here can be persisted yet. Running the Nano
    // pass anyway billed one model call (plus one entry read) per open thread every
    // Monday and discarded every result: pure cost, zero product. The similarity
    // search above is free (a pgvector RPC), so the sweep still reports honestly
    // how many threads WOULD have evidence laid beside them.
    // TODO: migrate altar_candidates.thread_id FK → threads.id, then restore the
    // entry read + CANDIDATE_PROMPT pass here and write the row.
    surfaced++
  }

  return { surfaced }
}
