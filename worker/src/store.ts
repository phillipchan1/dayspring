/**
 * Owner-scoped queries that replace Supabase RLS.
 * Every SELECT / UPDATE / DELETE that touches a user table must include
 * `owner = ${store.ownerId}` (or `t.owner = ${store.ownerId}` on a join).
 * Isolation tests mutate those filters and must fail if one is removed.
 */
import type { Sql } from './db.ts'
import { jsonParam, textArray } from './db.ts'

export const TRIAL_DAYS = 14
export const TRIAL_EXTENSION_DAYS = 7
export const TRIAL_EXTENDED_FLAG = 'trial_extended'

export interface ConnectedStore {
  sql: Sql
  ownerId: string
}

export function makeStore(sql: Sql, ownerId: string): ConnectedStore {
  return { sql, ownerId }
}

export interface EntryRow {
  id: string
  created_at: string
  updated_at: string
  body_markdown: string
  title: string | null
  mood: string | null
  tags: string[]
  word_count: number
  source: string
  external_id: string | null
  circumstances: unknown
}

/** postgres.js returns Date; JSON/PGlite return strings. Compare epoch ms. */
export function timestampMs(value: unknown): number | null {
  if (value == null) return null
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isFinite(t) ? t : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const t = Date.parse(value)
    return Number.isFinite(t) ? t : null
  }
  return null
}

export function sameTimestamp(left: unknown, right: unknown): boolean {
  const a = timestampMs(left)
  const b = timestampMs(right)
  return a != null && b != null && a === b
}

export async function listEntries(store: ConnectedStore): Promise<EntryRow[]> {
  return store.sql<EntryRow[]>`
    SELECT id, created_at, updated_at, body_markdown, title, mood, tags, word_count, source, external_id, circumstances
    FROM entries
    WHERE owner = ${store.ownerId}
    ORDER BY created_at DESC
  `
}

export async function listEntriesSince(store: ConnectedStore, since: string): Promise<EntryRow[]> {
  return store.sql<EntryRow[]>`
    SELECT id, created_at, updated_at, body_markdown, title, mood, tags, word_count, source, external_id, circumstances
    FROM entries
    WHERE owner = ${store.ownerId}
      AND updated_at > ${since}
    ORDER BY updated_at ASC
  `
}

export async function getEntry(store: ConnectedStore, id: string): Promise<EntryRow | null> {
  const rows = await store.sql<EntryRow[]>`
    SELECT id, created_at, updated_at, body_markdown, title, mood, tags, word_count, source, external_id, circumstances
    FROM entries
    WHERE id = ${id}
      AND owner = ${store.ownerId}
  `
  return rows[0] ?? null
}

export async function insertEntry(
  store: ConnectedStore,
  input: {
    id?: string
    body_markdown: string
    title?: string | null
    tags?: string[]
    word_count: number
    source?: string
    external_id?: string | null
    circumstances?: unknown
    created_at?: string
  },
): Promise<EntryRow> {
  const rows = await store.sql<EntryRow[]>`
    INSERT INTO entries (
      id, owner, body_markdown, title, tags, word_count, source, external_id, circumstances, created_at
    ) VALUES (
      ${input.id ?? crypto.randomUUID()},
      ${store.ownerId},
      ${input.body_markdown},
      ${input.title ?? null},
      ${textArray(store.sql, input.tags ?? [])},
      ${input.word_count},
      ${input.source ?? 'native'},
      ${input.external_id ?? null},
      ${jsonParam(store.sql, input.circumstances ?? {})},
      ${input.created_at ?? new Date().toISOString()}
    )
    RETURNING id, created_at, updated_at, body_markdown, title, mood, tags, word_count, source, external_id, circumstances
  `
  const row = rows[0]
  if (!row) throw new Error('insertEntry returned no row')
  return row
}

export async function updateEntry(
  store: ConnectedStore,
  id: string,
  patch: { body_markdown?: string; title?: string | null; word_count?: number; circumstances?: unknown },
): Promise<EntryRow | null> {
  const rows = await store.sql<EntryRow[]>`
    UPDATE entries SET
      body_markdown = COALESCE(${patch.body_markdown ?? null}, body_markdown),
      title = COALESCE(${patch.title ?? null}, title),
      word_count = COALESCE(${patch.word_count ?? null}, word_count),
      circumstances = COALESCE(${patch.circumstances == null ? null : jsonParam(store.sql, patch.circumstances)}, circumstances)
    WHERE id = ${id}
      AND owner = ${store.ownerId}
    RETURNING id, created_at, updated_at, body_markdown, title, mood, tags, word_count, source, external_id, circumstances
  `
  return rows[0] ?? null
}

export async function deleteEntry(store: ConnectedStore, id: string): Promise<boolean> {
  const rows = await store.sql<{ id: string }[]>`
    DELETE FROM entries
    WHERE id = ${id}
      AND owner = ${store.ownerId}
    RETURNING id
  `
  return rows.length > 0
}

export async function replaceEntry(
  store: ConnectedStore,
  input: {
    id: string
    created_at: string
    body_markdown: string
    title: string | null
    mood: string | null
    tags: string[]
    word_count: number
    source: string
    external_id: string | null
    circumstances: unknown
    base_updated_at?: string | null
  },
): Promise<EntryRow | null> {
  const baseMs = timestampMs(input.base_updated_at)
  const rows = await store.sql<EntryRow[]>`
    UPDATE entries SET
      created_at = ${input.created_at},
      body_markdown = ${input.body_markdown},
      title = ${input.title},
      mood = ${input.mood},
      tags = ${textArray(store.sql, input.tags)},
      word_count = ${input.word_count},
      source = ${input.source},
      external_id = ${input.external_id},
      circumstances = ${jsonParam(store.sql, input.circumstances ?? {})}
    WHERE id = ${input.id}
      AND owner = ${store.ownerId}
      AND (
        ${baseMs}::bigint IS NULL
        OR (EXTRACT(EPOCH FROM updated_at) * 1000)::bigint = ${baseMs}::bigint
      )
    RETURNING id, created_at, updated_at, body_markdown, title, mood, tags, word_count, source, external_id, circumstances
  `
  return rows[0] ?? null
}

export async function upsertEntryChecked(
  store: ConnectedStore,
  input: {
    id: string
    created_at: string
    body_markdown: string
    title: string | null
    mood: string | null
    tags: string[]
    word_count: number
    source: string
    external_id: string | null
    base_updated_at: string | null
    circumstances: unknown
  },
): Promise<{ conflicted: boolean; entry: EntryRow }> {
  const current = await getEntry(store, input.id)
  if (!current) {
    try {
      const entry = await insertEntry(store, {
        id: input.id,
        body_markdown: input.body_markdown,
        title: input.title,
        tags: input.tags,
        word_count: input.word_count,
        source: input.source,
        external_id: input.external_id,
        circumstances: input.circumstances,
        created_at: input.created_at,
      })
      return { conflicted: false, entry }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: unknown }).code) : ''
      // Only a real unique/PK collision is a sync conflict. Array bind failures
      // and other errors must not look like "conflicted".
      if (code !== '23505' && !/duplicate key|unique constraint/i.test(message)) {
        throw err
      }
      // PK exists on another owner's row — do not leak that row.
      return { conflicted: true, entry: {
        id: input.id,
        created_at: input.created_at,
        updated_at: input.base_updated_at ?? input.created_at,
        body_markdown: input.body_markdown,
        title: input.title,
        mood: input.mood,
        tags: input.tags,
        word_count: input.word_count,
        source: input.source,
        external_id: input.external_id,
        circumstances: input.circumstances,
      } }
    }
  }
  // Atomic OCC: one UPDATE whose WHERE includes the base timestamp at ms
  // precision. Concurrent editors with the same base cannot all land.
  if (timestampMs(input.base_updated_at) == null) {
    return { conflicted: true, entry: current }
  }
  const entry = await replaceEntry(store, input)
  if (!entry) {
    const latest = await getEntry(store, input.id)
    return { conflicted: true, entry: latest ?? current }
  }
  return { conflicted: false, entry }
}

export async function countEntries(store: ConnectedStore): Promise<number> {
  const rows = await store.sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM entries WHERE owner = ${store.ownerId}
  `
  return rows[0]?.n ?? 0
}

export interface ProfileRow {
  id: string
  owner: string
  has_seen_welcome: boolean
  plan: string | null
  plan_source: string | null
  trial_ends_at: string | null
  plan_expires_at: string | null
  settings: unknown
  onboarded_at: string | null
  feature_flags: string[]
  stripe_customer_id: string | null
  apple_original_txn: string | null
}

export async function getProfile(store: ConnectedStore): Promise<ProfileRow | null> {
  const rows = await store.sql<ProfileRow[]>`
    SELECT id, owner, has_seen_welcome, plan, plan_source, trial_ends_at, plan_expires_at, settings, onboarded_at,
           feature_flags, stripe_customer_id, apple_original_txn
    FROM profiles
    WHERE owner = ${store.ownerId}
  `
  return rows[0] ?? null
}

export async function upsertProfile(
  store: ConnectedStore,
  patch: Partial<Pick<ProfileRow, 'has_seen_welcome' | 'plan' | 'plan_source' | 'trial_ends_at' | 'onboarded_at'>>,
): Promise<ProfileRow> {
  const rows = await store.sql<ProfileRow[]>`
    INSERT INTO profiles (owner, has_seen_welcome, plan, plan_source, trial_ends_at, onboarded_at)
    VALUES (
      ${store.ownerId},
      ${patch.has_seen_welcome ?? false},
      ${patch.plan ?? null},
      ${patch.plan_source ?? null},
      ${patch.trial_ends_at ?? null},
      ${patch.onboarded_at ?? null}
    )
    ON CONFLICT (owner) DO UPDATE SET
      has_seen_welcome = COALESCE(${patch.has_seen_welcome ?? null}, profiles.has_seen_welcome),
      plan = COALESCE(${patch.plan ?? null}, profiles.plan),
      plan_source = COALESCE(${patch.plan_source ?? null}, profiles.plan_source),
      trial_ends_at = COALESCE(${patch.trial_ends_at ?? null}, profiles.trial_ends_at),
      onboarded_at = COALESCE(${patch.onboarded_at ?? null}, profiles.onboarded_at)
    RETURNING id, owner, has_seen_welcome, plan, plan_source, trial_ends_at, plan_expires_at, settings, onboarded_at,
              feature_flags, stripe_customer_id, apple_original_txn
  `
  const row = rows[0]
  if (!row) throw new Error('upsertProfile returned no row')
  return row
}

/** Reverse trial only for a brand-new, never-paid account. Never overwrite a plan. */
export function canGrantReverseTrial(profile: ProfileRow | null): boolean {
  if (!profile) return true
  if (profile.plan && profile.plan !== 'none') return false
  if (profile.trial_ends_at) return false
  if (profile.stripe_customer_id) return false
  if (profile.apple_original_txn) return false
  return true
}

export async function ensureProfile(store: ConnectedStore): Promise<ProfileRow> {
  const existing = await getProfile(store)
  if (existing && !canGrantReverseTrial(existing)) return existing
  const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86_400_000).toISOString()
  const profile = await upsertProfile(store, {
    plan: 'trialing',
    trial_ends_at: trialEnds,
  })
  if (!existing) await enrollWelcomeDrip(store, 'signup')
  return profile
}

export type TrialExtendResult =
  | { ok: true; trial_ends_at: string; profile: ProfileRow }
  | { ok: false; status: 404 | 409; error: string }

export function canExtendTrial(profile: ProfileRow): boolean {
  const plan = profile.plan ?? 'none'
  return plan === 'none' || (plan === 'trialing' && !profile.plan_source)
}

export async function extendTrialOnce(store: ConnectedStore): Promise<TrialExtendResult> {
  const rows = await store.sql<ProfileRow[]>`
    UPDATE profiles
    SET plan = 'trialing',
        trial_ends_at = GREATEST(NOW(), COALESCE(trial_ends_at, NOW()))
          + (${TRIAL_EXTENSION_DAYS} * INTERVAL '1 day'),
        feature_flags = array_append(COALESCE(feature_flags, ARRAY[]::text[]), ${TRIAL_EXTENDED_FLAG})
    WHERE owner = ${store.ownerId}
      AND NOT (${TRIAL_EXTENDED_FLAG} = ANY(COALESCE(feature_flags, ARRAY[]::text[])))
      AND (
        plan IS NULL
        OR plan = 'none'
        OR (plan = 'trialing' AND (plan_source IS NULL OR plan_source = ''))
      )
    RETURNING id, owner, has_seen_welcome, plan, plan_source, trial_ends_at, plan_expires_at, settings, onboarded_at,
              feature_flags, stripe_customer_id, apple_original_txn
  `
  const updated = rows[0]
  if (updated) {
    const end = updated.trial_ends_at as string | Date | null
    const trialEnds = end instanceof Date ? end.toISOString() : String(end ?? '')
    return { ok: true, trial_ends_at: trialEnds, profile: updated }
  }
  const profile = await getProfile(store)
  if (!profile) return { ok: false, status: 404, error: 'no profile' }
  const flags = Array.isArray(profile.feature_flags) ? profile.feature_flags : []
  if (flags.includes(TRIAL_EXTENDED_FLAG)) {
    return { ok: false, status: 409, error: 'Trial already extended once.' }
  }
  if (!canExtendTrial(profile)) {
    return { ok: false, status: 409, error: 'This account has a subscription — there is no trial to extend.' }
  }
  return { ok: false, status: 409, error: 'Trial already extended once.' }
}

export async function listInsights(store: ConnectedStore): Promise<Array<{ id: string; type: string }>> {
  return store.sql<{ id: string; type: string }[]>`
    SELECT id, type FROM insights WHERE owner = ${store.ownerId}
  `
}

export async function insertInsight(
  store: ConnectedStore,
  input: { type: string; period_start?: string | null; period_end?: string | null; structured_payload?: unknown },
): Promise<string> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO insights (owner, type, period_start, period_end, structured_payload)
    VALUES (
      ${store.ownerId},
      ${input.type},
      ${input.period_start ?? null},
      ${input.period_end ?? null},
      ${jsonParam(store.sql, input.structured_payload ?? {})}
    )
    RETURNING id
  `
  return rows[0]?.id ?? ''
}

export async function deleteInsight(store: ConnectedStore, id: string): Promise<boolean> {
  const rows = await store.sql<{ id: string }[]>`
    DELETE FROM insights WHERE id = ${id} AND owner = ${store.ownerId} RETURNING id
  `
  return rows.length > 0
}

export async function listSpiritualItems(store: ConnectedStore): Promise<Array<{ id: string; content: string }>> {
  return store.sql<{ id: string; content: string }[]>`
    SELECT id, content FROM spiritual_items WHERE owner = ${store.ownerId}
  `
}

export async function insertSpiritualItem(
  store: ConnectedStore,
  input: { type: string; content: string; entry_id?: string | null },
): Promise<string> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO spiritual_items (owner, type, content, entry_id)
    VALUES (${store.ownerId}, ${input.type}, ${input.content}, ${input.entry_id ?? null})
    RETURNING id
  `
  return rows[0]?.id ?? ''
}

export async function deleteSpiritualItem(store: ConnectedStore, id: string): Promise<boolean> {
  const rows = await store.sql<{ id: string }[]>`
    DELETE FROM spiritual_items WHERE id = ${id} AND owner = ${store.ownerId} RETURNING id
  `
  return rows.length > 0
}

export async function listReminders(store: ConnectedStore): Promise<Array<{ id: string; content: string }>> {
  return store.sql<{ id: string; content: string }[]>`
    SELECT id, content FROM reminders WHERE owner = ${store.ownerId}
  `
}

export async function insertReminder(
  store: ConnectedStore,
  input: { content: string; remind_at: string; entry_id?: string | null },
): Promise<string> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO reminders (owner, content, remind_at, entry_id)
    VALUES (${store.ownerId}, ${input.content}, ${input.remind_at}, ${input.entry_id ?? null})
    RETURNING id
  `
  return rows[0]?.id ?? ''
}

export async function fireReminder(store: ConnectedStore, id: string): Promise<boolean> {
  const rows = await store.sql<{ id: string }[]>`
    UPDATE reminders SET fired = TRUE
    WHERE id = ${id} AND owner = ${store.ownerId}
    RETURNING id
  `
  return rows.length > 0
}

export async function getAttachment(store: ConnectedStore, hash: string): Promise<{ id: string; storage_key: string } | null> {
  const rows = await store.sql<{ id: string; storage_key: string }[]>`
    SELECT id, storage_key FROM attachments
    WHERE hash = ${hash} AND owner = ${store.ownerId}
  `
  return rows[0] ?? null
}

export async function upsertAttachment(
  store: ConnectedStore,
  input: { hash: string; storage_key: string; mime?: string | null; bytes?: number | null },
): Promise<string> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO attachments (owner, hash, storage_key, mime, bytes)
    VALUES (${store.ownerId}, ${input.hash}, ${input.storage_key}, ${input.mime ?? null}, ${input.bytes ?? null})
    ON CONFLICT (owner, hash) DO UPDATE SET storage_key = EXCLUDED.storage_key
    RETURNING id
  `
  return rows[0]?.id ?? ''
}

export async function listAttachments(store: ConnectedStore): Promise<Array<{ id: string; hash: string }>> {
  return store.sql<{ id: string; hash: string }[]>`
    SELECT id, hash FROM attachments WHERE owner = ${store.ownerId}
  `
}

export async function deleteAttachment(store: ConnectedStore, id: string): Promise<boolean> {
  const rows = await store.sql<{ id: string }[]>`
    DELETE FROM attachments WHERE id = ${id} AND owner = ${store.ownerId} RETURNING id
  `
  return rows.length > 0
}

export async function listMarks(store: ConnectedStore): Promise<Array<{ id: string; quote: string }>> {
  return store.sql<{ id: string; quote: string }[]>`
    SELECT id, quote FROM marks WHERE owner = ${store.ownerId}
  `
}

export async function upsertMark(
  store: ConnectedStore,
  input: { entry_id: string; quote: string; kind?: string | null },
): Promise<string> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO marks (owner, entry_id, quote, kind)
    VALUES (${store.ownerId}, ${input.entry_id}, ${input.quote}, ${input.kind ?? null})
    ON CONFLICT (entry_id, quote) DO UPDATE SET kind = EXCLUDED.kind
    WHERE marks.owner = ${store.ownerId}
    RETURNING id
  `
  return rows[0]?.id ?? ''
}

export async function deleteMark(store: ConnectedStore, id: string): Promise<boolean> {
  const rows = await store.sql<{ id: string }[]>`
    DELETE FROM marks WHERE id = ${id} AND owner = ${store.ownerId} RETURNING id
  `
  return rows.length > 0
}

export async function listKeptSubjects(store: ConnectedStore): Promise<Array<{ id: string; subject_key: string }>> {
  return store.sql<{ id: string; subject_key: string }[]>`
    SELECT id, subject_key FROM kept_subjects WHERE owner = ${store.ownerId}
  `
}

export async function upsertKeptSubject(
  store: ConnectedStore,
  input: { subject_key: string; label: string; terms?: string[]; kind?: string | null },
): Promise<string> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO kept_subjects (owner, subject_key, label, terms, kind)
    VALUES (${store.ownerId}, ${input.subject_key}, ${input.label}, ${textArray(store.sql, input.terms ?? [])}, ${input.kind ?? null})
    ON CONFLICT (owner, subject_key) DO UPDATE SET label = EXCLUDED.label
    RETURNING id
  `
  return rows[0]?.id ?? ''
}

export async function deleteKeptSubject(store: ConnectedStore, id: string): Promise<boolean> {
  const rows = await store.sql<{ id: string }[]>`
    DELETE FROM kept_subjects WHERE id = ${id} AND owner = ${store.ownerId} RETURNING id
  `
  return rows.length > 0
}

export async function listThreads(store: ConnectedStore): Promise<Array<{ id: string; title: string | null }>> {
  return store.sql<{ id: string; title: string | null }[]>`
    SELECT id, title FROM threads WHERE owner = ${store.ownerId}
  `
}

export async function insertThread(store: ConnectedStore, title: string): Promise<string> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO threads (owner, title) VALUES (${store.ownerId}, ${title}) RETURNING id
  `
  return rows[0]?.id ?? ''
}

export async function deleteThread(store: ConnectedStore, id: string): Promise<boolean> {
  const rows = await store.sql<{ id: string }[]>`
    DELETE FROM threads WHERE id = ${id} AND owner = ${store.ownerId} RETURNING id
  `
  return rows.length > 0
}

export async function listRopes(store: ConnectedStore): Promise<Array<{ id: string }>> {
  return store.sql<{ id: string }[]>`
    SELECT id FROM ropes WHERE owner = ${store.ownerId}
  `
}

export async function insertRope(store: ConnectedStore, label: string): Promise<string> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO ropes (owner, label) VALUES (${store.ownerId}, ${label}) RETURNING id
  `
  return rows[0]?.id ?? ''
}

export async function listThreadMembers(
  store: ConnectedStore,
  threadId: string,
): Promise<Array<{ id: string; entry_id: string | null }>> {
  return store.sql<{ id: string; entry_id: string | null }[]>`
    SELECT m.id, m.entry_id
    FROM thread_members m
    JOIN threads t ON t.id = m.thread_id
    WHERE m.thread_id = ${threadId}
      AND t.owner = ${store.ownerId}
  `
}

export async function insertThreadMember(
  store: ConnectedStore,
  threadId: string,
  entryId: string,
): Promise<string | null> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO thread_members (thread_id, entry_id)
    SELECT ${threadId}, ${entryId}
    FROM threads t
    WHERE t.id = ${threadId}
      AND t.owner = ${store.ownerId}
    RETURNING id
  `
  return rows[0]?.id ?? null
}

export async function listProcessingJobs(store: ConnectedStore): Promise<Array<{ id: string; kind: string; status: string }>> {
  return store.sql<{ id: string; kind: string; status: string }[]>`
    SELECT id, kind, status FROM processing_jobs WHERE owner = ${store.ownerId}
  `
}

export async function enqueueJob(store: ConnectedStore, kind: string): Promise<string> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO processing_jobs (owner, kind, status)
    VALUES (${store.ownerId}, ${kind}, 'queued')
    RETURNING id
  `
  return rows[0]?.id ?? ''
}

export async function listConcordance(store: ConnectedStore): Promise<Array<{ id: string; term: string }>> {
  return store.sql<{ id: string; term: string }[]>`
    SELECT id, term FROM concordance WHERE owner = ${store.ownerId}
  `
}

export async function insertConcordanceEvent(
  store: ConnectedStore,
  input: { kind: string; payload?: unknown },
): Promise<string> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO concordance_events (owner, kind, payload)
    VALUES (${store.ownerId}, ${input.kind}, ${jsonParam(store.sql, input.payload ?? {})})
    RETURNING id
  `
  return rows[0]?.id ?? ''
}

export async function listScriptureRefs(store: ConnectedStore): Promise<Array<{ id: string; canonical: string }>> {
  return store.sql<{ id: string; canonical: string }[]>`
    SELECT id, canonical FROM scripture_refs WHERE owner = ${store.ownerId}
  `
}

export async function insertScriptureRef(
  store: ConnectedStore,
  input: { canonical: string; entry_id?: string | null },
): Promise<string> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO scripture_refs (owner, canonical, entry_id)
    VALUES (${store.ownerId}, ${input.canonical}, ${input.entry_id ?? null})
    RETURNING id
  `
  return rows[0]?.id ?? ''
}

export async function listEchoCandidates(store: ConnectedStore): Promise<Array<{ owner: string; entry_id: string | null }>> {
  return store.sql<{ owner: string; entry_id: string | null }[]>`
    SELECT owner, entry_id FROM echo_candidates WHERE owner = ${store.ownerId}
  `
}

export async function upsertEchoCandidate(store: ConnectedStore, entryId: string): Promise<void> {
  await store.sql`
    INSERT INTO echo_candidates (owner, entry_id)
    VALUES (${store.ownerId}, ${entryId})
    ON CONFLICT (owner) DO UPDATE SET entry_id = EXCLUDED.entry_id
  `
}

export async function insertEchoDismissal(store: ConnectedStore, entryId: string): Promise<string> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO echo_dismissals (owner, entry_id)
    VALUES (${store.ownerId}, ${entryId})
    RETURNING id
  `
  return rows[0]?.id ?? ''
}

export async function listPrayerThreads(store: ConnectedStore): Promise<Array<{ id: string; label: string | null }>> {
  return store.sql<{ id: string; label: string | null }[]>`
    SELECT id, label FROM prayer_threads WHERE owner = ${store.ownerId}
  `
}

export async function insertPrayerThread(store: ConnectedStore, label: string): Promise<string> {
  const rows = await store.sql<{ id: string }[]>`
    INSERT INTO prayer_threads (owner, label) VALUES (${store.ownerId}, ${label}) RETURNING id
  `
  return rows[0]?.id ?? ''
}

export async function deletePrayerThread(store: ConnectedStore, id: string): Promise<boolean> {
  const rows = await store.sql<{ id: string }[]>`
    DELETE FROM prayer_threads WHERE id = ${id} AND owner = ${store.ownerId} RETURNING id
  `
  return rows.length > 0
}

export async function enrollWelcomeDrip(store: ConnectedStore, source: string): Promise<void> {
  await store.sql`
    INSERT INTO welcome_drip_enrollments (owner, source, status, steps)
    VALUES (${store.ownerId}, ${source}, 'active', '{}'::jsonb)
    ON CONFLICT (owner) DO NOTHING
  `
}

export async function getWelcomeDrip(store: ConnectedStore): Promise<{ owner: string; status: string } | null> {
  const rows = await store.sql<{ owner: string; status: string }[]>`
    SELECT owner, status FROM welcome_drip_enrollments WHERE owner = ${store.ownerId}
  `
  return rows[0] ?? null
}

export async function listDueReminders(store: ConnectedStore, nowIso: string): Promise<Array<{ id: string; content: string }>> {
  return store.sql<{ id: string; content: string }[]>`
    SELECT id, content FROM reminders
    WHERE owner = ${store.ownerId}
      AND fired = FALSE
      AND remind_at <= ${nowIso}
  `
}

/** Account delete: wipe this owner's rows and Better Auth identity in one transaction. */
export async function deleteOwnedAccount(store: ConnectedStore): Promise<void> {
  await store.sql.begin(async (sql) => {
    await sql`DELETE FROM welcome_drip_enrollments WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM marks WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM kept_subjects WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM attachments WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM concordance_events WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM concordance_occurrences WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM concordance_shadow WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM concordance WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM processing_jobs WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM echo_dismissals WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM echo_candidates WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM resurface_dismissals WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM altar_candidate_dismissals WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM altar_candidates WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM encounters WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM item_subjects WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM spiritual_items WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM scripture_refs WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM reminders WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM insights WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM thread_members WHERE thread_id IN (SELECT id FROM threads WHERE owner = ${store.ownerId})`
    await sql`DELETE FROM threads WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM ropes WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM prayer_threads WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM entries WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM profiles WHERE owner = ${store.ownerId}`
    await sql`DELETE FROM session WHERE user_id = ${store.ownerId}`
    await sql`DELETE FROM account WHERE user_id = ${store.ownerId}`
    await sql`
      DELETE FROM verification
      WHERE identifier IN (
        SELECT email FROM "user" WHERE id = ${store.ownerId}
        UNION ALL
        SELECT 'sign-in-otp-' || email FROM "user" WHERE id = ${store.ownerId}
      )
    `
    await sql`DELETE FROM "user" WHERE id = ${store.ownerId}`
  })
}
