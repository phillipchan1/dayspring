// The gather engine: ONE pass over an entry that does everything the server
// derives from its text — the deterministic derive (fences, Scripture refs), the
// prayer harvest, the concordance extract, the embedding and (GATHER_READ) the
// stored entry read — chosen by "the body changed and the writer has stopped",
// not by the clock.
//
// (`gather.ts` is the gate-first HARVEST variant behind GATHER_MODE. This file is
// the engine that decides WHICH entries get read, and when. docs/GATHER.md.)
//
// ── Why one pass ─────────────────────────────────────────────────────────────
//
// Each of those steps used to keep its own "have I read this?" mark and set it
// once, forever. Three consequences, all of them silent:
//
//   · the 08:00 cron read an entry that was still being written, and never came
//     back for the rest of it;
//   · an entry edited later was never read again — a prayer added the next day
//     never reached the Altar, and a harvested line the writer had since deleted
//     stayed there;
//   · new writing waited up to a day, behind a per-owner daily cap.
//
// Here an entry is PENDING while entries.gathered_hash ≠ entries.body_hash, and
// READY once it has also sat untouched for the settle window. Every step runs on
// the same snapshot of the body, and the entry is stamped with the hash of the
// body that was READ — so an edit landing mid-gather leaves it pending.
//
// ── What a re-read costs ─────────────────────────────────────────────────────
//
//   · An edit that only touched a Scripture fence leaves the writer's own words
//     unchanged (gathered_words_hash), and the model is not called at all.
//   · A first gather honours the old per-step marks, so switching the engine on
//     does not re-read an archive the old scanners already read.
//   · The harvest write is reconcile_scanned_items: a prayer that still stands
//     keeps its row — and its subject tags, embedding and thread — so the tagger
//     is never re-billed for a line that did not change.
//
// ── Failure ──────────────────────────────────────────────────────────────────
//
//   · A model call that fails for SOME entries counts an attempt against each;
//     on its next try an entry is sent alone, so one unreadable page cannot take
//     its batch-mates down with it. At GATHER_MAX_ATTEMPTS it is stamped anyway.
//   · A tick in which NOTHING could be read (the model is down) throws instead:
//     the job backs off, and no entry is charged an attempt for an outage.
//
// Logs counts only, never entry text (§8).

import { createHash } from 'node:crypto'
import { supabaseAdmin } from './supabaseAdmin.js'
import { writerWords } from './writerWords.js'
import { deriveEntries } from './derive.js'
import { embedEntries, harvestEntries } from './altar.js'
import { scanConcordanceEntries } from './concordance.js'
import { readEntries } from './entryRead.js'
import { env } from './env.js'

/** Entries read per tick — sized so harvest + concordance + embed fit one invocation. */
export const GATHER_PER_TICK = 48
/** The same, with the stored read on: one more model call per page (READ_POOL wide). */
export const GATHER_PER_TICK_READ = 24
/** Consecutive failed gathers of one entry before it is stamped and left. */
export const GATHER_MAX_ATTEMPTS = 3

export interface PendingEntry {
  id: string
  created_at: string
  body_markdown: string
  body_hash: string
  gathered_hash: string | null
  gathered_words_hash: string | null
  /** Words hash of the stored read (null: never read). Absent when GATHER_READ is off. */
  read_words_hash?: string | null
  gather_attempts: number
  prayer_scanned: boolean
  concordance_scanned: boolean
  embedded: boolean
}

export interface GatherChunk {
  /** Entries taken off the queue this tick. */
  read: number
  /** Entries stamped as gathered. */
  gathered: number
  /** Entries whose model call failed (an attempt was counted). */
  failed: number
  /** Entries stamped after GATHER_MAX_ATTEMPTS without ever being read. */
  givenUp: number
  /** Entries whose words were unchanged, so the model was never called. */
  modelSkipped: number
  /** Pages whose read was stored (GATHER_READ). */
  readStored: number
  planted: number
  merged: number
  derived: { items: number; refs: number; foreign: number }
}

const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex')
const interval = (minutes: number) => `${Math.max(0, Math.round(minutes))} minutes`
const isBlank = (body: string) => body.replace(/\s+/g, ' ').trim().length < 3

/** What one pending entry needs. PURE — exported for the tests. */
export function planEntry(
  e: PendingEntry,
  opts: { read?: boolean } = {},
): {
  wordsHash: string
  harvest: boolean
  concordance: boolean
  embed: boolean
  read: boolean
} {
  const wordsHash = md5(writerWords(e.body_markdown))
  // Never gathered: trust the marks the old scanners left, and run only what is
  // missing. Gathered before: this is an EDIT — re-read iff the writer's own
  // words moved (a Scripture fence added or removed changes the body, not them).
  const first = e.gathered_hash === null
  // Queued only for its read (GATHER_READ backfill): the body is exactly what was
  // gathered, so nothing else is re-run — or re-billed.
  const bodyChanged = e.gathered_hash !== e.body_hash
  const wordsChanged = e.gathered_words_hash !== wordsHash
  return {
    wordsHash,
    harvest: bodyChanged && (first ? !e.prayer_scanned : wordsChanged),
    concordance: bodyChanged && (first ? !e.concordance_scanned : wordsChanged),
    // The embedding input is the whole body, so any change re-embeds. A blank
    // page has nothing to embed.
    embed: bodyChanged && !isBlank(e.body_markdown) && (first ? !e.embedded : true),
    // The stored read is keyed to the writer's words: missing or stale → read.
    read: opts.read === true && (e.read_words_hash ?? null) !== wordsHash,
  }
}

// With GATHER_READ off the queue readers are called exactly as before, so the
// engine does not depend on migration 20261004120000 until the read is turned on.
const readArg = (): { p_read?: true } => (env.gatherRead() ? { p_read: true } : {})

/** How many of an owner's entries are ready to gather. */
export async function gatherPendingCount(owner: string, settleMinutes: number): Promise<number> {
  const { data, error } = await supabaseAdmin().rpc('gather_pending_count', {
    p_owner: owner,
    p_settle: interval(settleMinutes),
    ...readArg(),
  })
  if (error) throw error
  return Number(data ?? 0)
}

/** Owners with entries ready to gather, longest-waiting first. */
export async function gatherPendingOwners(
  settleMinutes: number,
  limit: number,
): Promise<{ owner: string; pending: number }[]> {
  const { data, error } = await supabaseAdmin().rpc('gather_pending_owners', {
    p_settle: interval(settleMinutes),
    p_limit: limit,
    ...readArg(),
  })
  if (error) throw error
  return ((data ?? []) as { owner: string; pending: number | string }[]).map((r) => ({
    owner: r.owner,
    pending: Number(r.pending),
  }))
}

/**
 * Gather one tick's worth of an owner's ready entries.
 *
 * `settleMinutes` is how long an entry must have sat untouched (0 for an import:
 * an imported page is finished the moment it lands). `source` is the Concordance
 * provenance for what is extracted ('import' seeds land suggested).
 */
export async function gatherChunk(
  owner: string,
  opts: { settleMinutes: number; max?: number; source: 'import' | 'repetition' },
): Promise<GatherChunk> {
  const sb = supabaseAdmin()
  const reading = env.gatherRead()
  const { data, error } = await sb.rpc('gather_pending_entries', {
    p_owner: owner,
    p_settle: interval(opts.settleMinutes),
    p_limit: opts.max ?? (reading ? GATHER_PER_TICK_READ : GATHER_PER_TICK),
    ...readArg(),
  })
  if (error) throw error
  const pending = ((data ?? []) as PendingEntry[]).map((e) => ({
    ...e,
    body_markdown: e.body_markdown ?? '',
  }))

  const out: GatherChunk = {
    read: pending.length,
    gathered: 0,
    failed: 0,
    givenUp: 0,
    modelSkipped: 0,
    readStored: 0,
    planted: 0,
    merged: 0,
    derived: { items: 0, refs: 0, foreign: 0 },
  }
  if (pending.length === 0) return out

  const plans = new Map(pending.map((e) => [e.id, planEntry(e, { read: reading })]))
  const needs = (step: 'harvest' | 'concordance' | 'embed' | 'read') =>
    pending.filter((e) => plans.get(e.id)![step])

  // 1. Deterministic derive — no model. Everything pending, every time: it is
  //    idempotent, and it is what makes an imported page read like a typed one.
  out.derived = await deriveEntries(sb, owner, pending)

  // 2. Embedding first among the priced steps: it is the cheapest and it throws
  //    on failure, so if it is going to fail the chunk, nothing has been paid.
  await embedEntries(owner, needs('embed'))

  // 3. The model reads, side by side (different tables, no shared state).
  //    An entry on a retry is sent ALONE so a page the model cannot read fails by
  //    itself rather than with its five batch-mates.
  const failed = new Set<string>()
  const split = (list: PendingEntry[]) => ({
    fresh: list.filter((e) => e.gather_attempts === 0),
    retry: list.filter((e) => e.gather_attempts > 0),
  })
  const toHarvest = split(needs('harvest'))
  const toExtract = split(needs('concordance'))
  // The stored read is one call per page already, so a retry is alone by nature.
  const toRead = needs('read')

  await Promise.all([
    (async () => {
      for (const group of [toHarvest.fresh, ...toHarvest.retry.map((e) => [e])]) {
        if (group.length === 0) continue
        const run = await harvestEntries(owner, group)
        out.planted += run.planted
        for (const id of run.failedIds) failed.add(id)
      }
    })(),
    (async () => {
      // Sequential: merges share one match state per call.
      for (const group of [toExtract.fresh, ...toExtract.retry.map((e) => [e])]) {
        if (group.length === 0) continue
        const run = await scanConcordanceEntries(owner, group, opts.source)
        out.merged += run.merged
        for (const id of run.failedIds) failed.add(id)
      }
    })(),
    (async () => {
      if (toRead.length === 0) return
      const run = await readEntries(
        sb,
        owner,
        toRead.map((e) => ({ ...e, wordsHash: plans.get(e.id)!.wordsHash })),
      )
      out.readStored += run.read
      for (const id of run.failedIds) failed.add(id)
    })(),
  ])

  const asked = pending.filter((e) => {
    const p = plans.get(e.id)!
    return p.harvest || p.concordance || p.read
  })
  out.modelSkipped = pending.length - asked.length
  out.failed = failed.size
  const outage = asked.length > 0 && asked.every((e) => failed.has(e.id))

  // 4. Stamp. `ok` rows record the hash of the body that was READ. Failed rows
  //    count an attempt — unless nothing at all could be read, which is an
  //    outage, not a verdict on any one page. `read_hash` is sent only for a page
  //    whose read was asked for, so with GATHER_READ off the stamp is unchanged.
  const rows = pending
    .filter((e) => !(outage && failed.has(e.id)))
    .map((e) => {
      const plan = plans.get(e.id)!
      return {
        id: e.id,
        body_hash: e.body_hash,
        words_hash: plan.wordsHash,
        ...(plan.read ? { read_hash: plan.wordsHash } : {}),
        ok: !failed.has(e.id),
      }
    })
  if (rows.length > 0) {
    const { data: givenUp, error: stampErr } = await sb.rpc('gather_stamp', {
      p_owner: owner,
      p_rows: rows,
      p_max_attempts: GATHER_MAX_ATTEMPTS,
    })
    if (stampErr) throw stampErr
    out.givenUp = Number(givenUp ?? 0)
  }
  out.gathered = rows.filter((r) => r.ok).length

  if (outage) {
    throw new Error(`gather: model call failed for all ${asked.length} entries it was asked to read`)
  }
  if (out.givenUp > 0) {
    console.warn(`[gather] gave up on ${out.givenUp} entries after ${GATHER_MAX_ATTEMPTS} attempts (owner ${owner})`)
  }
  return out
}
