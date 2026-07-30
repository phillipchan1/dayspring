// The per-owner processing engine. The daily synthesize cron is the steady-state
// heartbeat for caught-up users; these jobs are the one-time catch-up that builds
// a freshly-imported archive's reflections + altar in bounded, resumable chunks.
// Triggered on import (api/processing/enqueue.ts), drained by the every-minute
// worker (api/cron/process-tick.ts). See docs/PROCESSING_AND_ONBOARDING.md.

import { waitUntil } from '@vercel/functions'
import { supabaseAdmin } from './supabaseAdmin.js'
import { env } from './env.js'
import type { Period } from './dates.js'
import { weeksInRange, monthsInRange, quartersInRange, yearsInRange } from './dates.js'
import { buildWeekly, buildMonthly, buildQuarterly, buildYearly } from './synthesize.js'
import { harvestPlan, harvestPrayers, embedUnembedded } from './altar.js'
import { tagSubjects, regroupDeclared } from './declared.js'
import { concordancePlan, scanConcordance } from './concordance.js'

export type JobKind =
  | 'reflections'
  | 'scripture'
  | 'altar_harvest'
  | 'altar_embed'
  | 'altar_thread'
  | 'concordance'

export interface Job {
  id: string
  owner: string
  kind: JobKind
  status: 'queued' | 'running' | 'done' | 'failed'
  cursor: ReflectionsCursor | Record<string, never>
  total: number
  completed: number
  attempts: number
}

interface ReflectionsCursor {
  range: Period
  /** Flat index into reflectionsTasks(range) — the recent-first build order. */
  index: number
}

const STAGES = ['weekly', 'monthly', 'quarterly', 'yearly'] as const
type Stage = (typeof STAGES)[number]

interface ReflectionsTask {
  stage: Stage
  period: Period
}

/**
 * The reflections build order: most-recent YEAR first, and within each year its
 * children before its parents (weeks → months → quarters → year), because a
 * monthly rollup reads its weeks, a quarterly reads its months, etc.
 *
 * Recent-first matters for UX: the Ascent's default view is the most recent
 * week/month/quarter/year, so building the recent year's whole subtree first
 * makes every altitude show real content within minutes — instead of staying
 * empty for hours while an oldest-first cascade grinds through ~15 years of
 * weeks before it ever reaches a quarter.
 */
function reflectionsTasks(range: Period): ReflectionsTask[] {
  const years = yearsInRange(range).slice().reverse() // recent year first
  const tasks: ReflectionsTask[] = []
  for (const year of years) {
    // Recent-first WITHIN the year too, so the Ascent's most-recent week / month /
    // quarter (what each altitude actually shows) build before the older ones.
    // Safe for dependencies: every week of the year is built before any month,
    // every month before any quarter — only the order inside each tier reverses.
    for (const w of weeksInRange(year).slice().reverse()) tasks.push({ stage: 'weekly', period: w })
    for (const m of monthsInRange(year).slice().reverse()) tasks.push({ stage: 'monthly', period: m })
    for (const q of quartersInRange(year).slice().reverse()) tasks.push({ stage: 'quarterly', period: q })
    tasks.push({ stage: 'yearly', period: year })
  }
  return tasks
}

// Tuning knobs (chunk = the per-tick budget that keeps each invocation under the
// Vercel timeout). The next tick continues where this one left off.
const REFLECTIONS_PER_TICK = 24 // periods built per tick (concurrently, same-stage)
const REFLECTIONS_POOL = 6 // concurrent builds within a tick — caps model fan-out
const HARVEST_PER_TICK = 60 // entries scanned for prayer cues per tick
const THREAD_PER_TICK = 300 // untagged prayers/senses read by the subject tagger per tick
const CONCORDANCE_PER_TICK = 64 // entries read for concordance candidates per tick
const MAX_ATTEMPTS = 5 // after this many failures, give up (status=failed)

/** Run `fn` over items with bounded concurrency (no extra deps). */
async function runPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<unknown>,
): Promise<void> {
  let next = 0
  const worker = async () => {
    for (;;) {
      const i = next++
      if (i >= items.length) return
      await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
}

function buildStagePeriod(stage: Stage, owner: string, period: Period) {
  switch (stage) {
    case 'weekly':
      return buildWeekly(owner, period)
    case 'monthly':
      return buildMonthly(owner, period)
    case 'quarterly':
      return buildQuarterly(owner, period)
    case 'yearly':
      return buildYearly(owner, period)
  }
}

// ── Enqueue ────────────────────────────────────────────────────────────────

/**
 * Insert the backfill job set for an owner over an import date range. Idempotent:
 * skips a kind that already has an active (queued/running) job. Called on import
 * completion and (no-op) on signup. The altar chain is seeded with altar_harvest;
 * it enqueues altar_embed → altar_thread as each stage finishes.
 *
 * If a reflections job is already active (e.g. the user imported while a previous
 * backfill was still running), we extend its range to cover the new import range
 * rather than silently dropping the new periods.
 */
export async function enqueueBackfill(
  owner: string,
  range: Period,
): Promise<{ enqueued: JobKind[] }> {
  const sb = supabaseAdmin()
  const enqueued: JobKind[] = []

  const reflectionsTotal = reflectionsTasks(range).length
  const reflectionsCursor: ReflectionsCursor = { range, index: 0 }
  if (await insertIfInactive(sb, owner, 'reflections', reflectionsTotal, reflectionsCursor)) {
    enqueued.push('reflections')
  } else {
    // A job is already active — widen its range so the newly-imported periods
    // aren't left unprocessed. The job restarts from scratch with the merged range.
    await extendActiveReflections(sb, owner, range)
  }

  const { unscanned } = await harvestPlan(owner)
  if (await insertIfInactive(sb, owner, 'altar_harvest', unscanned, {})) {
    enqueued.push('altar_harvest')
  }

  // Concordance seed (dark — nothing reads it yet): extract names/spellings
  // across the imported corpus. The Reveal's own month is also seeded
  // synchronously inside /api/onboarding/backfill before the Reveal builds.
  const concordance = await concordancePlan(owner)
  if (await insertIfInactive(sb, owner, 'concordance', concordance.unscanned, {})) {
    enqueued.push('concordance')
  }

  return { enqueued }
}

/**
 * If a reflections job is currently active and the new import range extends
 * beyond it, widen the job to cover both. Resets the cursor to index 0 so the
 * merged range is built from scratch (recent-first, idempotent).
 */
async function extendActiveReflections(
  sb: ReturnType<typeof supabaseAdmin>,
  owner: string,
  newRange: Period,
): Promise<void> {
  const { data: active } = await sb
    .from('processing_jobs')
    .select('id, cursor')
    .eq('owner', owner)
    .eq('kind', 'reflections')
    .in('status', ['queued', 'running'])
    .maybeSingle()
  if (!active) return // completed between the insertIfInactive check and now

  const existing = (active.cursor as ReflectionsCursor).range
  const merged: Period = {
    start: newRange.start < existing.start ? newRange.start : existing.start,
    end: newRange.end > existing.end ? newRange.end : existing.end,
  }
  // Already covers the new range — nothing to do.
  if (merged.start === existing.start && merged.end === existing.end) return

  const tasks = reflectionsTasks(merged)
  await sb
    .from('processing_jobs')
    .update({ cursor: { range: merged, index: 0 }, total: tasks.length, completed: 0 })
    .eq('id', active.id)
}

async function insertIfInactive(
  sb: ReturnType<typeof supabaseAdmin>,
  owner: string,
  kind: JobKind,
  total: number,
  cursor: ReflectionsCursor | Record<string, never>,
): Promise<boolean> {
  const { data: active } = await sb
    .from('processing_jobs')
    .select('id')
    .eq('owner', owner)
    .eq('kind', kind)
    .in('status', ['queued', 'running'])
    .maybeSingle()
  if (active) return false

  const { error } = await sb
    .from('processing_jobs')
    .insert({ owner, kind, total, cursor, status: 'queued' })
  // 23505 = the partial-unique backstop fired (a concurrent enqueue won the race).
  if (error && error.code !== '23505') throw error
  return !error
}

// ── Self-re-arming drain ─────────────────────────────────────────────────────

/**
 * Fire-and-forget nudge to run the next chunk. The engine self-chains (enqueue
 * kicks the first tick; each tick that did work kicks the next) so an imported
 * archive drains in the background WITHOUT a sub-minute cron — Vercel Hobby-safe.
 * `waitUntil` keeps the function alive long enough to dispatch the request.
 */
export function kickWorker(): void {
  try {
    const url = `${env.appUrl()}/api/cron/process-tick`
    waitUntil(
      fetch(url, { headers: { authorization: `Bearer ${env.cronSecret()}` } })
        .then(() => undefined)
        .catch(() => undefined),
    )
  } catch {
    // appUrl/cronSecret unset, or not in a request context — ignore.
  }
}

// ── Drain ────────────────────────────────────────────────────────────────────

/** Claim up to K jobs and advance each by one bounded chunk. */
export async function drain(k: number): Promise<Array<Record<string, unknown>>> {
  const sb = supabaseAdmin()
  const { data: claimed, error } = await sb.rpc('claim_processing_jobs', { k })
  if (error) throw error
  const jobs = (claimed ?? []) as Job[]

  const summaries: Array<Record<string, unknown>> = []
  for (const job of jobs) {
    summaries.push(await runChunk(job))
  }
  return summaries
}

async function runChunk(job: Job): Promise<Record<string, unknown>> {
  const sb = supabaseAdmin()
  try {
    switch (job.kind) {
      case 'reflections':
        return await runReflections(job)
      case 'altar_harvest':
        return await runAltarHarvest(job)
      case 'altar_embed':
        return await runAltarEmbed(job)
      case 'altar_thread':
        return await runAltarThread(job)
      case 'concordance':
        return await runConcordance(job)
      case 'scripture':
        // Scripture is scanned client-side post-import; nothing to do server-side.
        await sb.from('processing_jobs').update({ status: 'done', locked_at: null }).eq('id', job.id)
        return { id: job.id, kind: job.kind, status: 'done', note: 'client-side' }
    }
  } catch (e) {
    // Capture the real error — Supabase throws PostgrestError (a plain object,
    // not an Error), which would otherwise mask as a useless 'chunk failed'.
    const message =
      e instanceof Error
        ? e.message
        : ((e as { message?: string; details?: string } | null)?.message ??
          (e as { details?: string } | null)?.details ??
          (typeof e === 'string' ? e : JSON.stringify(e)?.slice(0, 300)) ??
          'chunk failed')
    // Transient: leave 'running' (locked_at keeps it out of reach for 5 min, a
    // natural backoff) so a later tick reclaims and retries — until we give up.
    const giveUp = job.attempts >= MAX_ATTEMPTS
    await sb
      .from('processing_jobs')
      .update({ error: message, ...(giveUp ? { status: 'failed', locked_at: null } : {}) })
      .eq('id', job.id)
    return { id: job.id, kind: job.kind, status: giveUp ? 'failed' : 'retry', error: message }
  }
}

async function runReflections(job: Job): Promise<Record<string, unknown>> {
  const sb = supabaseAdmin()
  const cursor = job.cursor as ReflectionsCursor & { stage?: Stage }
  const range = cursor.range
  const tasks = reflectionsTasks(range)
  // Old-format cursors (which had a `stage`) predate the recent-first order;
  // restart them at 0 so the recent year's subtree is built first (idempotent).
  let index = cursor.stage !== undefined ? 0 : (cursor.index ?? 0)
  let built = 0

  // Build in concurrent same-stage batches: gather consecutive tasks that share a
  // stage (no intra-stage dependencies — a month only reads its OWN weeks, which
  // a prior batch already built) and run them through a bounded pool. A stage
  // change ends the batch, so a parent is never built alongside its children.
  while (built < REFLECTIONS_PER_TICK && index < tasks.length) {
    const stage = tasks[index]!.stage
    const batch: Period[] = []
    while (
      index < tasks.length &&
      tasks[index]!.stage === stage &&
      batch.length < REFLECTIONS_PER_TICK - built
    ) {
      batch.push(tasks[index]!.period)
      index += 1
    }
    await runPool(batch, REFLECTIONS_POOL, (p) => buildStagePeriod(stage, job.owner, p))
    built += batch.length
  }

  if (index >= tasks.length) {
    await sb
      .from('processing_jobs')
      .update({ status: 'done', completed: tasks.length, locked_at: null })
      .eq('id', job.id)
    return { id: job.id, kind: 'reflections', status: 'done', completed: tasks.length }
  }

  // More to do — persist progress, leave running (clear lock so the next tick
  // picks it straight up rather than waiting out the 5-min stale window).
  await sb
    .from('processing_jobs')
    .update({ cursor: { range, index }, completed: index, locked_at: null })
    .eq('id', job.id)
  return { id: job.id, kind: 'reflections', status: 'running', completed: index, of: job.total }
}

async function runAltarHarvest(job: Job): Promise<Record<string, unknown>> {
  const sb = supabaseAdmin()
  const { scanned } = await harvestPrayers(job.owner, { max: HARVEST_PER_TICK })
  const completed = job.completed + scanned
  const { unscanned } = await harvestPlan(job.owner)

  if (unscanned <= 0) {
    await sb
      .from('processing_jobs')
      .update({ status: 'done', completed, locked_at: null })
      .eq('id', job.id)
    // Chain: embed everything we just harvested, then thread it.
    await insertIfInactive(sb, job.owner, 'altar_embed', 1, {})
    return { id: job.id, kind: 'altar_harvest', status: 'done', completed }
  }

  await sb
    .from('processing_jobs')
    .update({ completed, locked_at: null })
    .eq('id', job.id)
  return { id: job.id, kind: 'altar_harvest', status: 'running', completed, remaining: unscanned }
}

async function runConcordance(job: Job): Promise<Record<string, unknown>> {
  const sb = supabaseAdmin()
  const { scanned } = await scanConcordance(job.owner, {
    max: CONCORDANCE_PER_TICK,
    source: 'import', // archive seed — items land suggested, never confirmed
  })
  const completed = job.completed + scanned
  const { unscanned } = await concordancePlan(job.owner)

  if (unscanned <= 0) {
    await sb
      .from('processing_jobs')
      .update({ status: 'done', completed, locked_at: null })
      .eq('id', job.id)
    return { id: job.id, kind: 'concordance', status: 'done', completed }
  }

  await sb
    .from('processing_jobs')
    .update({ completed, locked_at: null })
    .eq('id', job.id)
  return { id: job.id, kind: 'concordance', status: 'running', completed, remaining: unscanned }
}

async function runAltarEmbed(job: Job): Promise<Record<string, unknown>> {
  const sb = supabaseAdmin()
  const res = await embedUnembedded(job.owner) // batches internally
  await sb
    .from('processing_jobs')
    .update({ status: 'done', completed: 1, total: 1, locked_at: null })
    .eq('id', job.id)
  await insertIfInactive(sb, job.owner, 'altar_thread', 1, {})
  return { id: job.id, kind: 'altar_embed', status: 'done', ...res }
}

async function runAltarThread(job: Job): Promise<Record<string, unknown>> {
  const sb = supabaseAdmin()
  // Bounded per tick — a multi-thousand-prayer archive blew past the function
  // budget in one pass, got killed mid-write, and left the field nearly empty. Tag
  // `THREAD_PER_TICK` lines at a time and re-tick (clear the lock so the next tick
  // claims it straight away) until the archive is drained.
  //
  // Tagging is the priced, per-line step; grouping is deterministic, so it runs
  // once at the end rather than on every tick.
  const res = await tagSubjects(job.owner, { max: THREAD_PER_TICK })
  const completed = job.completed + res.read

  if (res.remaining > 0) {
    await sb
      .from('processing_jobs')
      .update({ completed, total: completed + res.remaining, locked_at: null })
      .eq('id', job.id)
    return { id: job.id, kind: 'altar_thread', status: 'running', completed, remaining: res.remaining }
  }

  // Everything is tagged — build the field.
  const declared = await regroupDeclared(job.owner)
  await sb
    .from('processing_jobs')
    .update({ status: 'done', completed, total: completed, locked_at: null })
    .eq('id', job.id)
  return { id: job.id, kind: 'altar_thread', status: 'done', ...res, declared }
}

/**
 * Ensure an `altar_thread` job exists for an owner with untagged prayer lines —
 * the fast, self-chaining path to drain them. Used by the daily cron as a safety
 * net so any backlog (a pre-engine import, or an archive imported before the
 * subject builder existed) auto-recovers instead of trickling 120/day.
 */
export async function enqueueAltarThread(owner: string): Promise<boolean> {
  const sb = supabaseAdmin()
  return insertIfInactive(sb, owner, 'altar_thread', 1, {})
}
