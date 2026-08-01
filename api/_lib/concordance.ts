// The Concordance engine — a hidden, per-user FIDELITY record: the names,
// places, and domain words the writer uses, spelled the way THEY spell them.
//
// Charter (the gate for every line here): does this help REPRODUCE the user,
// or CONCLUDE something about them? Reproduce → keep. Conclude → drop. It
// stores proper nouns, spellings, aliases, and identity-only descriptors —
// never moods, traits, themes, or anything evaluative/predictive.
//
// DARK this phase: nothing reads the Concordance yet. Population only:
//  • seed     — 'concordance' processing job over an imported archive (plus a
//               synchronous pass over the Reveal's month in onboarding/backfill)
//  • maintain — bounded top-up on the daily synthesize heartbeat. NOTE: there
//               is no per-entry on-save LLM hook in this codebase to piggyback
//               on (audited 2026-06-11), so maintenance follows the repo's
//               prose-intelligence pattern instead (harvestPrayers): a
//               watermarked batch pass — no on-save latency, no extra
//               round-trip on any existing call.
//  • confirm  — drawer corrections (client-side under RLS; see src/lib/concordance.ts)
//  • consolidate — weekly (Monday) pass riding the synthesize cron
//
// Derived, not authoritative: every accepted candidate is logged as an
// 'observe' event in concordance_events; user corrections log their own
// events. rebuildConcordance() replays the log into concordance_shadow and
// reports drift — the safety net proving the live table is regenerable.
//
// The LLM only ever PROPOSES candidates; the deterministic merge below is the
// only thing that writes rows. Entry prose is never mutated.

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabaseAdmin.js'
import { callModel } from './openai.js'

// ── CONSTANTS (tune freely — copy & thresholds live here) ────────────────────
// Mirrored in src/lib/concordance.ts for the drawer (the api/ and src/ trees
// don't share modules — same convention as entryLabels.ts).
export const CONCORDANCE = {
  TABLE: 'concordance',
  KINDS: ['person', 'place', 'org', 'project', 'term'] as const, // defer transcription_hint, reference_style

  // promotion / confidence
  SURFACE_MIN_DISTINCT_ENTRIES: 2, // appears in >= N distinct entries to be shown in the drawer
  IMPORT_SEED_CONFIDENCE: 0.5, // seeded items are suggested, never confirmed
  REPETITION_BASE_CONFIDENCE: 0.4,
  EXPLICIT_CONFIDENCE: 1.0, // user adds/confirms in the drawer
  CORRECTION_CONFIDENCE: 1.0, // user corrects a spelling/name

  // decay
  DORMANT_AFTER_DAYS: 365, // no new occurrence in a year -> dormant (not deleted)

  // drawer copy (user-facing)
  DRAWER_TITLE: 'Concordance',
  DRAWER_SUBTITLE: "Names and words I've learned to spell the way you do.",
  DRAWER_EMPTY: "Nothing yet. As you write, I'll quietly learn how you spell your world.",
  // NEVER add a completeness meter or "we know N things about you" string here.
} as const

export type ConcordanceKind = (typeof CONCORDANCE.KINDS)[number]
export type ConcordanceStatus = 'suggested' | 'confirmed' | 'dormant' | 'superseded'
export type ConcordanceSource = 'import' | 'repetition' | 'correction' | 'explicit'

export interface ConcordanceRow {
  id: string
  owner: string
  kind: ConcordanceKind
  canonical: string
  surface_forms: string[]
  descriptor: string | null
  confidence: number
  status: ConcordanceStatus
  source: ConcordanceSource
  occurrence_count: number
  first_seen: string | null
  last_seen: string | null
  effective_start: string | null
  effective_end: string | null
  superseded_by: string | null
}

export interface Candidate {
  kind: ConcordanceKind
  canonical: string
  surface_form: string
  descriptor?: string
}

// ── extraction tuning ────────────────────────────────────────────────────────
const EXTRACT_LLM_BATCH = 8 // entries per model call
const EXTRACT_MAX_CHARS = 4000 // per-entry prose cap sent to the model
const EXTRACT_POOL = 3 // concurrent model calls
const MAX_CANDIDATES_PER_ENTRY = 8
const MAX_SURFACE_FORMS = 12 // per row — consolidation also enforces
const IN_CHUNK = 150 // max ids per .in() filter (URL length)
const PAGE = 1000

// ── extraction sub-prompt (charter-encoded: both sides) ─────────────────────
const EXTRACT_PROMPT = `You read entries from one person's private journal and index ONLY what is needed to render the writer
faithfully — the proper nouns and domain words they use, spelled the way THEY spell them. You are a
concordance, not a profiler.

EXTRACT (render-me):
 - proper nouns and names: people, places, organizations/communities, projects
 - the writer's exact spelling/alias for them ("Es" for Esther, "NQ", "Frontier")
 - recurring domain vocabulary and shorthand the writer uses as THEIR OWN term (a ticker they trade,
   a product name, an in-group word) — kind "term"
 - an IDENTITY-ONLY descriptor when the entry states one plainly: "wife", "accountant",
   "futures ticker", "my church". A descriptor is a label, never a judgment.

NEVER EXTRACT (conclude-me):
 - feelings, moods, traits, struggles, "themes", spiritual state
 - anything predictive or evaluative, anything about what an entry MEANS
 - generic common nouns that aren't the writer's particular vocabulary
If a candidate is a judgment rather than a label, drop it. If a descriptor would be a judgment, omit
the descriptor (return "") and keep only the name.

HARD RULE: each "surface_form" MUST appear VERBATIM in that entry's text — the writer's own spelling,
exactly as written. "canonical" is the best display form (usually the fullest spelling the writer
uses). Return at most the ${MAX_CANDIDATES_PER_ENTRY} clearest per entry; when in doubt, leave it out.

Return JSON {"entries":[{"id": string, "candidates":[{"kind":"person"|"place"|"org"|"project"|"term",
"canonical": string, "surface_form": string, "descriptor": string}]}]} and nothing else. Use "" for an
unknown descriptor.`

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['entries'],
  properties: {
    entries: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'candidates'],
        properties: {
          id: { type: 'string' },
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['kind', 'canonical', 'surface_form', 'descriptor'],
              properties: {
                kind: { type: 'string', enum: [...CONCORDANCE.KINDS] },
                canonical: { type: 'string' },
                surface_form: { type: 'string' },
                descriptor: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
} as const

// ── deterministic gates ──────────────────────────────────────────────────────

const KIND_SET = new Set<string>(CONCORDANCE.KINDS)

// Descriptor honesty gate: identity labels only. A descriptor that smells like
// a verdict (feeling/trait/theme words) is dropped — the entity itself is kept.
// Belt-and-braces under the prompt; the charter says conclude → drop.
export const EVALUATIVE_DESCRIPTOR =
  /\b(seems?|feel(?:s|ing)?|felt|theme|mood|anxi(?:ous|ety)|afraid|fear(?:ful)?|worr(?:y|ied|ies)|struggl\w*|depress\w*|doubt\w*|lonel\w*|angry|anger|sad(?:ness)?|happy|happiness|joy(?:ful)?|hope(?:ful|less)?|stress\w*|grow(?:th|ing)|heal(?:ing|ed)?|broken|wound\w*|sin(?:ful)?|faith(?:ful|less)?)\b/i

const normalizeWs = (s: string) => s.replace(/\s+/g, ' ').trim()

/** The surface form must be the writer's actual spelling — a (whitespace-tolerant) substring. */
export function isVerbatim(body: string, text: string): boolean {
  if (!text) return false
  if (body.includes(text)) return true
  return normalizeWs(body).includes(normalizeWs(text))
}

/** Validate one model-proposed candidate; returns the cleaned candidate or null. */
export function gateCandidate(body: string, raw: Candidate): Candidate | null {
  if (!KIND_SET.has(raw.kind)) return null
  const canonical = normalizeWs(raw.canonical ?? '')
  const surface = (raw.surface_form ?? '').trim()
  if (!canonical || canonical.length > 80) return null
  if (!surface || surface.length > 80) return null
  if (!isVerbatim(body, surface)) return null // honesty gate: the writer's own spelling only

  let descriptor = normalizeWs(raw.descriptor ?? '')
  if (
    !descriptor ||
    descriptor.length > 60 ||
    descriptor.split(' ').length > 5 ||
    EVALUATIVE_DESCRIPTOR.test(descriptor)
  ) {
    descriptor = '' // drop the descriptor, keep the entity
  }
  return { kind: raw.kind, canonical, surface_form: surface, ...(descriptor ? { descriptor } : {}) }
}

/** Confidence for machine-sourced rows: base by source, nudged by recurrence, capped
 *  below 1.0 — only the user's own confirm/correction ever pins certainty. */
export function machineConfidence(source: ConcordanceSource, distinctEntries: number): number {
  const base =
    source === 'import' ? CONCORDANCE.IMPORT_SEED_CONFIDENCE : CONCORDANCE.REPETITION_BASE_CONFIDENCE
  return Math.min(0.9, base + 0.05 * Math.max(0, distinctEntries - 1))
}

// ── small shared utils ───────────────────────────────────────────────────────

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const worker = async () => {
    for (;;) {
      const idx = next++
      if (idx >= items.length) return
      out[idx] = await fn(items[idx]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
  return out
}

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

async function markScanned(sb: SupabaseClient, ids: string[]): Promise<void> {
  const stamp = new Date().toISOString()
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { error } = await sb
      .from('entries')
      .update({ concordance_scanned_at: stamp })
      .in('id', ids.slice(i, i + IN_CHUNK))
    if (error) throw error
  }
}

const matchKey = (kind: string, name: string) => `${kind}:${name.toLowerCase()}`

function dedupSurfaceForms(canonical: string, forms: string[]): string[] {
  const seen = new Set<string>([canonical.toLowerCase()])
  const out: string[] = []
  for (const f of forms) {
    const t = normalizeWs(f)
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
    if (out.length >= MAX_SURFACE_FORMS) break
  }
  return out
}

// ── merge — deterministic server-side writer (the LLM only proposes) ─────────

interface ActiveRow {
  id: string
  kind: ConcordanceKind
  canonical: string
  surface_forms: string[]
  descriptor: string | null
  confidence: number
  status: ConcordanceStatus
  source: ConcordanceSource
  occurrence_count: number
  first_seen: string | null
  last_seen: string | null
}

interface MergeState {
  /** matchKey(kind, canonical-or-alias) → row. Active = not superseded. */
  index: Map<string, ActiveRow>
}

async function loadMergeState(sb: SupabaseClient, owner: string): Promise<MergeState> {
  const rows = await fetchAll<ActiveRow>(
    sb,
    'concordance',
    'id, kind, canonical, surface_forms, descriptor, confidence, status, source, occurrence_count, first_seen, last_seen',
    owner,
    (q) => q.neq('status', 'superseded'),
  )
  const index = new Map<string, ActiveRow>()
  for (const row of rows) {
    index.set(matchKey(row.kind, row.canonical), row)
    for (const f of row.surface_forms) index.set(matchKey(row.kind, f), row)
  }
  return { index }
}

/**
 * Upsert one entry's accepted candidates into the live Concordance.
 * Deterministic: matches against active rows (canonical OR any alias, per
 * kind), adds novel surface forms, increments occurrence_count ONLY when the
 * occurrences junction accepts a new (row, entry) pair — so distinct entries,
 * never raw mentions — updates first/last_seen from the entry's ORIGINAL date,
 * recomputes confidence, and revives dormant rows. Logs an 'observe' event per
 * accepted candidate (the rebuild's replay source).
 */
async function mergeCandidates(
  sb: SupabaseClient,
  owner: string,
  state: MergeState,
  entry: { id: string; created_at: string },
  candidates: Candidate[],
  source: 'import' | 'repetition',
): Promise<number> {
  let merged = 0
  for (const cand of candidates) {
    // Identity: prefer the candidate's canonical; fall back to its surface form
    // (so "Es" lands on the existing Esther row instead of minting a new one).
    let row =
      state.index.get(matchKey(cand.kind, cand.canonical)) ??
      state.index.get(matchKey(cand.kind, cand.surface_form))

    if (!row) {
      const fresh = {
        owner,
        kind: cand.kind,
        canonical: cand.canonical,
        surface_forms: dedupSurfaceForms(cand.canonical, [cand.surface_form]),
        descriptor: cand.descriptor ?? null,
        confidence: machineConfidence(source, 1),
        status: 'suggested' as const,
        source,
        occurrence_count: 0, // the occurrence insert below sets it to 1
        first_seen: entry.created_at,
        last_seen: entry.created_at,
      }
      const { data, error } = await sb.from('concordance').insert(fresh).select('id').maybeSingle()
      if (error) {
        // 23505 = a concurrent pass minted the same identity; re-read and merge into it.
        if (error.code !== '23505') throw error
        const { data: existing } = await sb
          .from('concordance')
          .select(
            'id, kind, canonical, surface_forms, descriptor, confidence, status, source, occurrence_count, first_seen, last_seen',
          )
          .eq('owner', owner)
          .eq('kind', cand.kind)
          .ilike('canonical', cand.canonical)
          .neq('status', 'superseded')
          .maybeSingle()
        if (!existing) continue
        row = existing as ActiveRow
      } else if (data) {
        row = { ...fresh, id: data.id as string } as ActiveRow
      } else {
        continue
      }
      state.index.set(matchKey(row.kind, row.canonical), row)
      for (const f of row.surface_forms) state.index.set(matchKey(row.kind, f), row)
    }

    // Provenance first: the observe event is what rebuild replays.
    const { error: evErr } = await sb.from('concordance_events').insert({
      owner,
      action: 'observe',
      kind: cand.kind,
      canonical: cand.canonical,
      entry_id: entry.id,
      entry_created_at: entry.created_at,
      payload: {
        surface_form: cand.surface_form,
        ...(cand.descriptor ? { descriptor: cand.descriptor } : {}),
        source,
      },
    })
    if (evErr) throw evErr

    // New DISTINCT entry? The junction's pk answers idempotently.
    const { data: occ, error: occErr } = await sb
      .from('concordance_occurrences')
      .upsert(
        { concordance_id: row.id, entry_id: entry.id, owner, entry_created_at: entry.created_at },
        { onConflict: 'concordance_id,entry_id', ignoreDuplicates: true },
      )
      .select('entry_id')
    if (occErr) throw occErr
    const newDistinctEntry = (occ ?? []).length > 0

    const patch: Record<string, unknown> = {}
    const forms = dedupSurfaceForms(row.canonical, [...row.surface_forms, cand.surface_form])
    if (forms.length !== row.surface_forms.length) {
      patch.surface_forms = forms
      row.surface_forms = forms
      state.index.set(matchKey(row.kind, cand.surface_form), row)
    }
    if (!row.descriptor && cand.descriptor) {
      patch.descriptor = cand.descriptor
      row.descriptor = cand.descriptor
    }
    if (newDistinctEntry) {
      row.occurrence_count += 1
      patch.occurrence_count = row.occurrence_count
      if (!row.first_seen || entry.created_at < row.first_seen) {
        row.first_seen = entry.created_at
        patch.first_seen = entry.created_at
      }
      if (!row.last_seen || entry.created_at > row.last_seen) {
        row.last_seen = entry.created_at
        patch.last_seen = entry.created_at
      }
      if (row.status === 'dormant') {
        // A fresh occurrence revives a dormant row — back to suggested, never
        // auto-confirmed (only the user confirms).
        row.status = 'suggested'
        patch.status = 'suggested'
      }
      if (row.status === 'suggested') {
        const conf = machineConfidence(row.source === 'import' ? 'import' : 'repetition', row.occurrence_count)
        if (conf > row.confidence) {
          row.confidence = conf
          patch.confidence = conf
        }
      }
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await sb.from('concordance').update(patch).eq('id', row.id)
      if (error) throw error
    }
    merged++
  }
  return merged
}

// ── scan — the one extraction pipeline (seed + maintain) ─────────────────────

/** How many entries still await extraction (drives job totals/progress). */
export async function concordancePlan(owner: string): Promise<{ unscanned: number }> {
  const sb = supabaseAdmin()
  const { count, error } = await sb
    .from('entries')
    .select('id', { count: 'exact', head: true })
    .eq('owner', owner)
    .is('concordance_scanned_at', null)
  if (error) throw error
  return { unscanned: count ?? 0 }
}

/**
 * Extract concordance candidates from the prose of entries not yet scanned and
 * merge them in. Idempotent: an entry is read by the model at most once
 * (concordance_scanned_at watermark); a failed batch is left unmarked to retry;
 * the occurrences junction absorbs any racing double-merge. `window` bounds the
 * pool to a created_at range (the Reveal-month synchronous seed); `max` caps
 * how many entries one run touches (the cron top-up / per-tick chunk).
 *
 * first/last_seen always come from entries.created_at — the ORIGINAL entry
 * date (imports backfill old dates) — never row time.
 */
/**
 * The model half of the concordance scan: one batch of entries in, gated
 * candidates out.
 *
 * PURE — reads and writes nothing, so extraction quality can be evaluated on
 * real text without touching the database (mirrors tagTexts in declared.ts and
 * harvestBatch in altar.ts). scripts/recognition-eval.ts scores this against
 * the hand-labeled corpus in src/lib/recognition/.
 *
 * An entry the model returned but proposed nothing for maps to an empty array;
 * an entry it omitted is absent from the map. scanConcordance depends on that
 * distinction — it only merges entries the model actually answered for.
 *
 * Returns null when the model call fails, so the caller leaves the batch
 * unmarked to retry.
 */
export async function extractBatch(
  entries: { id: string; body: string }[],
): Promise<Map<string, Candidate[]> | null> {
  let out: { entries?: { id: string; candidates?: Candidate[] }[] }
  try {
    out = await callModel<{ entries?: { id: string; candidates?: Candidate[] }[] }>(
      EXTRACT_PROMPT,
      { entries: entries.map((e) => ({ id: e.id, text: e.body.slice(0, EXTRACT_MAX_CHARS) })) },
      EXTRACT_SCHEMA as unknown as Record<string, unknown>,
      'concordance_extract',
      'low',
      2000,
    )
  } catch {
    return null
  }

  const byId = new Map(entries.map((e) => [e.id, e]))
  const result = new Map<string, Candidate[]>()
  for (const r of out.entries ?? []) {
    const entry = byId.get(r.id)
    if (!entry) continue
    const accepted: Candidate[] = []
    for (const raw of (r.candidates ?? []).slice(0, MAX_CANDIDATES_PER_ENTRY)) {
      const ok = gateCandidate(entry.body, raw)
      if (ok) accepted.push(ok)
    }
    result.set(entry.id, accepted)
  }
  return result
}

/**
 * extractBatch over an arbitrary number of entries, batched and pooled exactly
 * as scanConcordance does it. Also DB-free.
 */
export async function extractCandidates(
  entries: { id: string; body: string }[],
): Promise<{ byEntry: Map<string, Candidate[]>; failed: string[] }> {
  const batches: { id: string; body: string }[][] = []
  for (let i = 0; i < entries.length; i += EXTRACT_LLM_BATCH) {
    batches.push(entries.slice(i, i + EXTRACT_LLM_BATCH))
  }
  const byEntry = new Map<string, Candidate[]>()
  const failed: string[] = []
  await mapPool(batches, EXTRACT_POOL, async (batch) => {
    const res = await extractBatch(batch)
    if (res === null) {
      failed.push(...batch.map((e) => e.id))
      return
    }
    for (const [id, candidates] of res) byEntry.set(id, candidates)
  })
  return { byEntry, failed }
}

export async function scanConcordance(
  owner: string,
  opts: { max?: number; window?: { fromISO: string; toExclusiveISO: string }; source: 'import' | 'repetition' },
): Promise<{ scanned: number; merged: number }> {
  const sb = supabaseAdmin()

  const pool = await fetchAll<{ id: string; created_at: string; body_markdown: string }>(
    sb,
    'entries',
    'id, created_at, body_markdown',
    owner,
    (q) => {
      let r = q.is('concordance_scanned_at', null).order('created_at', { ascending: true })
      if (opts.window) {
        r = r.gte('created_at', opts.window.fromISO).lt('created_at', opts.window.toExclusiveISO)
      }
      return r
    },
  )
  const slice = opts.max ? pool.slice(0, opts.max) : pool

  // Blank/trivial entries skip the model entirely — just mark them scanned.
  const blank = slice.filter((e) => normalizeWs(e.body_markdown).length < 3)
  await markScanned(sb, blank.map((e) => e.id))
  const candidates = slice.filter((e) => normalizeWs(e.body_markdown).length >= 3)

  const batches: typeof candidates[] = []
  for (let i = 0; i < candidates.length; i += EXTRACT_LLM_BATCH) {
    batches.push(candidates.slice(i, i + EXTRACT_LLM_BATCH))
  }

  // Model calls run pooled; merging is sequential (one shared match state, and
  // a crash mid-merge just leaves that batch unmarked to retry).
  const results = await mapPool(batches, EXTRACT_POOL, (batch) =>
    extractBatch(batch.map((e) => ({ id: e.id, body: e.body_markdown }))),
  )

  const state = await loadMergeState(sb, owner)
  let merged = 0
  let scanned = blank.length
  for (let b = 0; b < batches.length; b++) {
    const batch = batches[b]!
    const out = results[b]
    if (!out) continue
    // Iterate the extraction map, not the batch: Map preserves insertion order,
    // so merges happen in the same order the inline version did them. Merge
    // state is shared and mutated in sequence, so the order is load-bearing.
    const byId = new Map(batch.map((e) => [e.id, e]))
    for (const [entryId, accepted] of out) {
      const entry = byId.get(entryId)
      if (!entry) continue
      merged += await mergeCandidates(sb, owner, state, entry, accepted, opts.source)
    }
    await markScanned(sb, batch.map((e) => e.id))
    scanned += batch.length
  }

  return { scanned, merged }
}

// ── consolidate — weekly pass (Mondays, riding the synthesize cron) ──────────

/**
 * Housekeeping, read-only with respect to user prose: dedup surface forms,
 * merge accidental duplicate active rows (same owner/kind/canonical — possible
 * across historic supersede/revive churn), recompute occurrence stats from the
 * junction (repairs drift from deleted entries), and decay suggested rows with
 * no occurrence in DORMANT_AFTER_DAYS to 'dormant' — never deleted. Confirmed
 * rows never decay: the user vouched for them.
 */
export async function consolidateConcordance(
  owner: string,
): Promise<{ mergedDuplicates: number; decayed: number; cleaned: number }> {
  const sb = supabaseAdmin()
  const rows = await fetchAll<ActiveRow & { created_at: string }>(
    sb,
    'concordance',
    'id, kind, canonical, surface_forms, descriptor, confidence, status, source, occurrence_count, first_seen, last_seen, created_at',
    owner,
    (q) => q.neq('status', 'superseded'),
  )

  // 1) Merge duplicate active identities (keeper = oldest; confirmed wins over age).
  let mergedDuplicates = 0
  const byIdentity = new Map<string, (ActiveRow & { created_at: string })[]>()
  for (const r of rows) {
    const key = matchKey(r.kind, r.canonical)
    byIdentity.set(key, [...(byIdentity.get(key) ?? []), r])
  }
  const retired = new Set<string>()
  for (const group of byIdentity.values()) {
    if (group.length < 2) continue
    const keeper = group
      .slice()
      .sort((a, b) =>
        a.status === 'confirmed' && b.status !== 'confirmed'
          ? -1
          : b.status === 'confirmed' && a.status !== 'confirmed'
            ? 1
            : a.created_at.localeCompare(b.created_at),
      )[0]!
    for (const dup of group) {
      if (dup.id === keeper.id) continue
      // Carry the duplicate's occurrences to the keeper (junction pk dedups),
      // union its aliases, then retire it — supersede, never delete.
      const { data: occs } = await sb
        .from('concordance_occurrences')
        .select('entry_id, entry_created_at')
        .eq('concordance_id', dup.id)
      if (occs && occs.length > 0) {
        const { error } = await sb.from('concordance_occurrences').upsert(
          occs.map((o) => ({
            concordance_id: keeper.id,
            entry_id: o.entry_id as string,
            owner,
            entry_created_at: o.entry_created_at as string,
          })),
          { onConflict: 'concordance_id,entry_id', ignoreDuplicates: true },
        )
        if (error) throw error
      }
      keeper.surface_forms = dedupSurfaceForms(keeper.canonical, [
        ...keeper.surface_forms,
        ...dup.surface_forms,
        dup.canonical,
      ])
      const { error: keepErr } = await sb
        .from('concordance')
        .update({ surface_forms: keeper.surface_forms })
        .eq('id', keeper.id)
      if (keepErr) throw keepErr
      const { error } = await sb
        .from('concordance')
        .update({
          status: 'superseded',
          superseded_by: keeper.id,
          effective_end: new Date().toISOString().slice(0, 10),
        })
        .eq('id', dup.id)
      if (error) throw error
      retired.add(dup.id)
      mergedDuplicates++
    }
  }

  // 2) Recompute occurrence stats from the junction + dedup surface forms + decay.
  const dormantBefore = new Date(Date.now() - CONCORDANCE.DORMANT_AFTER_DAYS * 86_400_000).toISOString()
  let decayed = 0
  let cleaned = 0
  for (const row of rows) {
    if (retired.has(row.id)) continue
    const { data: occs, error } = await sb
      .from('concordance_occurrences')
      .select('entry_created_at')
      .eq('concordance_id', row.id)
    if (error) throw error
    const dates = (occs ?? []).map((o) => o.entry_created_at as string).sort()

    const patch: Record<string, unknown> = {}
    const forms = dedupSurfaceForms(row.canonical, row.surface_forms)
    if (
      forms.length !== row.surface_forms.length ||
      forms.some((f, i) => f !== row.surface_forms[i])
    ) {
      patch.surface_forms = forms
    }
    if (dates.length > 0) {
      if (row.occurrence_count !== dates.length) patch.occurrence_count = dates.length
      if (row.first_seen !== dates[0]) patch.first_seen = dates[0]
      if (row.last_seen !== dates[dates.length - 1]) patch.last_seen = dates[dates.length - 1]
    }
    const lastSeen = (patch.last_seen as string | undefined) ?? row.last_seen
    if (row.status === 'suggested' && lastSeen && lastSeen < dormantBefore) {
      patch.status = 'dormant'
      decayed++
    }
    if (Object.keys(patch).length > 0) {
      const { error: upErr } = await sb.from('concordance').update(patch).eq('id', row.id)
      if (upErr) throw upErr
      cleaned++
    }
  }

  return { mergedDuplicates, decayed, cleaned }
}

// ── rebuild — the derivability safety net ────────────────────────────────────

interface EventRow {
  id: string
  action: 'observe' | 'confirm' | 'edit' | 'forget' | 'add'
  kind: ConcordanceKind
  canonical: string
  entry_id: string | null
  entry_created_at: string | null
  payload: Record<string, unknown>
  created_at: string
}

interface ShadowRow {
  owner: string
  kind: ConcordanceKind
  canonical: string
  surface_forms: string[]
  descriptor: string | null
  confidence: number
  status: ConcordanceStatus
  source: ConcordanceSource
  occurrence_count: number
  first_seen: string | null
  last_seen: string | null
  effective_start: string | null
  effective_end: string | null
  /** in-memory only */
  entries: Set<string>
  seq: number
}

/**
 * Wipe and regenerate the owner's Concordance into concordance_shadow purely by
 * replaying concordance_events (machine observations + user corrections, each
 * traceable to an entry or a drawer action) — proving the live table is
 * derived, not authoritative. Returns a drift summary against the live table;
 * benign drift can come from entries deleted after observation (live
 * consolidation drops their occurrences; the log remembers them).
 */
export async function rebuildConcordance(
  owner: string,
): Promise<{ shadow_rows: number; live_rows: number; mismatches: string[] }> {
  const sb = supabaseAdmin()
  const events = await fetchAll<EventRow>(
    sb,
    'concordance_events',
    'id, action, kind, canonical, entry_id, entry_created_at, payload, created_at',
    owner,
    (q) => q.order('created_at', { ascending: true }).order('id', { ascending: true }),
  )

  // Pure in-memory replay with the same matching semantics as the live merge.
  const all: ShadowRow[] = []
  const index = new Map<string, ShadowRow>() // active rows only
  let seq = 0

  const indexRow = (row: ShadowRow) => {
    index.set(matchKey(row.kind, row.canonical), row)
    for (const f of row.surface_forms) index.set(matchKey(row.kind, f), row)
  }
  const unindexRow = (row: ShadowRow) => {
    for (const [k, v] of index) if (v === row) index.delete(k)
  }

  for (const ev of events) {
    const target =
      index.get(matchKey(ev.kind, ev.canonical)) ??
      (ev.action === 'observe'
        ? index.get(matchKey(ev.kind, String(ev.payload.surface_form ?? '')))
        : undefined)

    if (ev.action === 'observe') {
      const source = (ev.payload.source === 'import' ? 'import' : 'repetition') as ConcordanceSource
      const surface = normalizeWs(String(ev.payload.surface_form ?? ''))
      const descriptor = normalizeWs(String(ev.payload.descriptor ?? '')) || null
      const date = ev.entry_created_at
      let row = target
      if (!row) {
        row = {
          owner,
          kind: ev.kind,
          canonical: ev.canonical,
          surface_forms: surface ? dedupSurfaceForms(ev.canonical, [surface]) : [],
          descriptor,
          confidence: machineConfidence(source, 1),
          status: 'suggested',
          source,
          occurrence_count: 0,
          first_seen: null,
          last_seen: null,
          effective_start: null,
          effective_end: null,
          entries: new Set(),
          seq: seq++,
        }
        all.push(row)
        indexRow(row)
      }
      if (surface) {
        row.surface_forms = dedupSurfaceForms(row.canonical, [...row.surface_forms, surface])
        index.set(matchKey(row.kind, surface), row)
      }
      if (!row.descriptor && descriptor) row.descriptor = descriptor
      if (ev.entry_id && !row.entries.has(ev.entry_id)) {
        row.entries.add(ev.entry_id)
        row.occurrence_count = row.entries.size
        if (date) {
          if (!row.first_seen || date < row.first_seen) row.first_seen = date
          if (!row.last_seen || date > row.last_seen) row.last_seen = date
        }
        if (row.status === 'dormant') row.status = 'suggested'
        if (row.status === 'suggested') {
          row.confidence = Math.max(
            row.confidence,
            machineConfidence(row.source === 'import' ? 'import' : 'repetition', row.occurrence_count),
          )
        }
      }
      continue
    }

    if (ev.action === 'add') {
      if (target) continue // already known — idempotent
      const row: ShadowRow = {
        owner,
        kind: ev.kind,
        canonical: ev.canonical,
        surface_forms: dedupSurfaceForms(
          ev.canonical,
          Array.isArray(ev.payload.surface_forms) ? (ev.payload.surface_forms as string[]) : [],
        ),
        descriptor: normalizeWs(String(ev.payload.descriptor ?? '')) || null,
        confidence: CONCORDANCE.EXPLICIT_CONFIDENCE,
        status: 'confirmed',
        source: 'explicit',
        occurrence_count: 0,
        first_seen: null,
        last_seen: null,
        effective_start: null,
        effective_end: null,
        entries: new Set(),
        seq: seq++,
      }
      all.push(row)
      indexRow(row)
      continue
    }

    if (!target) continue // correction against an unknown identity — no-op

    if (ev.action === 'confirm') {
      target.status = 'confirmed'
      target.confidence = CONCORDANCE.EXPLICIT_CONFIDENCE
      target.source = 'explicit'
    } else if (ev.action === 'forget') {
      target.status = 'superseded' // retire, never hard-delete
      target.effective_end = ev.created_at.slice(0, 10)
      unindexRow(target)
    } else if (ev.action === 'edit') {
      const newCanonical = normalizeWs(String(ev.payload.new_canonical ?? '')) || null
      const newForms = Array.isArray(ev.payload.surface_forms)
        ? (ev.payload.surface_forms as string[])
        : null
      const newDescriptor =
        'descriptor' in ev.payload ? normalizeWs(String(ev.payload.descriptor ?? '')) || null : undefined
      if (newCanonical && newCanonical.toLowerCase() !== target.canonical.toLowerCase()) {
        // A changed fact creates a NEW row and retires the old — the old
        // spelling survives as an alias of the successor.
        const successor: ShadowRow = {
          owner,
          kind: target.kind,
          canonical: newCanonical,
          surface_forms: dedupSurfaceForms(newCanonical, [
            ...(newForms ?? target.surface_forms),
            target.canonical,
          ]),
          descriptor: newDescriptor !== undefined ? newDescriptor : target.descriptor,
          confidence: CONCORDANCE.CORRECTION_CONFIDENCE,
          status: 'confirmed',
          source: 'correction',
          occurrence_count: target.occurrence_count,
          first_seen: target.first_seen,
          last_seen: target.last_seen,
          effective_start: null,
          effective_end: null,
          entries: new Set(target.entries),
          seq: seq++,
        }
        target.status = 'superseded'
        target.effective_end = ev.created_at.slice(0, 10)
        unindexRow(target)
        all.push(successor)
        indexRow(successor)
      } else {
        if (newCanonical) target.canonical = newCanonical // case-only respelling
        if (newForms) target.surface_forms = dedupSurfaceForms(target.canonical, newForms)
        if (newDescriptor !== undefined) target.descriptor = newDescriptor
        target.status = 'confirmed'
        target.confidence = CONCORDANCE.CORRECTION_CONFIDENCE
        target.source = 'correction'
        indexRow(target)
      }
    }
  }

  // Write the shadow.
  const { error: wipeErr } = await sb.from('concordance_shadow').delete().eq('owner', owner)
  if (wipeErr) throw wipeErr
  for (let i = 0; i < all.length; i += IN_CHUNK) {
    const chunk = all.slice(i, i + IN_CHUNK).map(({ entries: _e, seq: _s, ...row }) => row)
    const { error } = await sb.from('concordance_shadow').insert(chunk)
    if (error) throw error
  }

  // Drift report: compare active identities (kind + canonical + status).
  const live = await fetchAll<{ kind: string; canonical: string; status: string }>(
    sb,
    'concordance',
    'kind, canonical, status',
    owner,
    (q) => q.neq('status', 'superseded'),
  )
  const sig = (r: { kind: string; canonical: string; status: string }) =>
    `${r.kind}:${r.canonical.toLowerCase()}:${r.status}`
  const liveSet = new Set(live.map(sig))
  const shadowActive = all.filter((r) => r.status !== 'superseded')
  const shadowSet = new Set(shadowActive.map(sig))
  const mismatches = [
    ...[...shadowSet].filter((s) => !liveSet.has(s)).map((s) => `shadow-only ${s}`),
    ...[...liveSet].filter((s) => !shadowSet.has(s)).map((s) => `live-only ${s}`),
  ].slice(0, 50)

  return { shadow_rows: all.length, live_rows: live.length, mismatches }
}

// ── read API — Phase-2 seam, FAIL OPEN ───────────────────────────────────────

/**
 * The future consumers' read surface (synthesis voice, Altar clustering, Lamp
 * allusion, prompts, search). NO CALLER EXISTS YET — the Concordance is built
 * dark this phase. When consumers land they must treat this as a rendering
 * aid, never a dependency: it returns [] on ANY failure so an empty or errored
 * Concordance can never block a job, and low-confidence rows only ever suggest
 * — they never auto-apply.
 */
export async function getConcordanceForRender(owner: string): Promise<ConcordanceRow[]> {
  try {
    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('concordance')
      .select('*')
      .eq('owner', owner)
      .in('status', ['suggested', 'confirmed'])
      .order('occurrence_count', { ascending: false })
    if (error) return []
    return (data ?? []) as ConcordanceRow[]
  } catch {
    return []
  }
}
