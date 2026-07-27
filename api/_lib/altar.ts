// The Altar engine: embeds prayers/senses + entries, harvests the prayers written
// in entry prose, migrates the legacy binary into encounters, and (weekly) lays
// EVIDENCE beside open threads. Runs server-side only (backfill + cron) — the
// client never embeds or calls OpenAI.
//
// GROUPING LIVES IN ./declared.ts, not here. This module used to cluster prayer
// lines by embedding similarity (threadItems, MERGE_THRESHOLD 0.64); that measured
// devotional REGISTER rather than subject, and re-averaging each cluster's centroid
// turned the biggest heap into a magnet that swallowed years of unrelated praying.
// It was retired 2026-07-27 in favour of subject tagging. See declared.ts for the
// full autopsy — and do not reintroduce a similarity threshold over raw prayer text.
//
// Governing principle: light = ENCOUNTER, not transaction. Nothing here ever
// writes an `encounters` row from inference, and the weekly sweep NEVER returns a
// movement label or a verdict — only a quote + a gentle question. Logs counts
// only, never entry/prayer text (§8).

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabaseAdmin.js'
import { callModel } from './openai.js'
import { embed, toVectorLiteral } from './embeddings.js'

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

const normalizeWs = (s: string) => s.replace(/\s+/g, ' ').trim()

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
 * Clear the subject tags on every prayer/sense line so the next tagging pass reads
 * the archive fresh. For tuning the tag prompt — expensive (the model re-reads
 * every line), so it is never called from the cron. Threads themselves are left
 * alone; the following regroup rebuilds them.
 */
export async function resetSubjectTags(owner: string): Promise<{ cleared: number }> {
  const sb = supabaseAdmin()
  const { data, error } = await sb
    .from('spiritual_items')
    .update({ subject_tags: null, subject_tagged_at: null })
    .eq('owner', owner)
    .in('type', ['prayer', 'sense'])
    .not('subject_tagged_at', 'is', null)
    .select('id')
  if (error) throw error
  return { cleared: (data ?? []).length }
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

  // Seed text per thread, for the Nano context.
  const seedIds = threads.map((t) => t.seed_item_id).filter((x): x is string => !!x)
  const seedText = new Map<string, string>()
  for (let i = 0; i < seedIds.length; i += IN_CHUNK) {
    const { data } = await sb
      .from('spiritual_items')
      .select('id, content')
      .in('id', seedIds.slice(i, i + IN_CHUNK))
    for (const s of (data ?? []) as { id: string; content: string }[]) seedText.set(s.id, s.content)
  }

  let surfaced = 0
  for (const t of threads) {
    if (encountered.has(t.id)) continue
    const emb = threadCentroid.get(t.id)
    if (!emb) continue // no embedded members yet — skip until threadItems has run
    const lastTouch = threadLastTouch.get(t.id) ?? t.span_end ?? new Date(0).toISOString()
    const label = t.label_user ?? t.label_ai ?? t.label ?? ''

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
        { prayer: { title: label, words: (seedText.get(t.seed_item_id ?? '') ?? '').slice(0, 600) }, later_entry: body.slice(0, 2400) },
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

    // altar_candidates.thread_id references prayer_threads.id (legacy FK).
    // New declared threads live in threads.id — skip writing the candidate for
    // now; the altar_candidates table FK needs migrating before this can land.
    // TODO: migrate altar_candidates.thread_id FK → threads.id and re-enable.
    surfaced++
  }

  return { surfaced }
}
