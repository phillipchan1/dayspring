/**
 * Threads & Ropes data seam — real adapters.
 *
 * Queries:  ropes / threads / thread_members → entries
 * Parked:   connection candidates (mock), encounter naming (mock)
 */

import { requireSupabase } from '@/lib/supabase'
import type {
  Horizon, FieldItem, ThreadItem, ThreadDetail, EntryDetail,
  MomentItem, Register,
} from './types'

// ── horizon → days back ───────────────────────────────────────────────────────

const HORIZON_DAYS: Record<Horizon, number | null> = {
  0: 7,
  1: 31,
  2: 91,
  3: 365,
  4: null,
}

// ── deterministic reframe line ────────────────────────────────────────────────

function reframeFor(spanStart: string, spanEnd: string, memberCount: number, hasMeeting: boolean): string {
  const ms = new Date(spanEnd).getTime() - new Date(spanStart).getTime()
  const days = ms / 86_400_000
  const years = Math.floor(days / 365)
  const months = Math.floor(days / 30)

  const meetingSuffix = hasMeeting ? ' — and you weren\'t the only one who kept showing up.' : '.'

  if (days < 60)  return 'A current weight — recent, still being carried.'
  if (days < 180) return `You've returned here across ${months} months. Each return is the thread.`
  if (years < 1)  return `${months} months of returning to this. The thread is the returning${meetingSuffix}`
  if (years < 3)  return `You've returned here across ${years === 1 ? 'a year' : `${years} years`}. Each time the thread stayed.`
  return `You've come back to this for ${years} years. The returning is its own faithfulness${meetingSuffix}`
}

function resolveLabel(row: { label?: string | null; label_ai?: string | null; label_user?: string | null }): string {
  return row.label_user ?? row.label_ai ?? row.label ?? ''
}

// ── field ─────────────────────────────────────────────────────────────────────

export async function loadField(horizon: Horizon): Promise<FieldItem[]> {
  const sb = requireSupabase()
  const days = HORIZON_DAYS[horizon]
  const windowStart = days !== null
    ? new Date(Date.now() - days * 24 * 3600_000).toISOString()
    : null

  // Load ropes (groups of threads).
  const ropeQ = sb.from('ropes').select('id, label, label_user, domain, span_start, span_end')
  const { data: ropeData } = await ropeQ
  const ropeRows = (ropeData ?? []) as {
    id: string; label: string; label_user: string | null
    domain: string | null; span_start: string | null; span_end: string | null
  }[]

  // Load threads, filtering by horizon + not dismissed.
  let threadQ = sb
    .from('threads')
    .select('id, label, label_ai, label_user, lens, domain, rope_id, weight, temperature, span_start, span_end, private, dismissed')
    .eq('dismissed', false)
    .order('weight', { ascending: false })
  if (windowStart) threadQ = threadQ.gte('span_end', windowStart)
  const { data: threadData, error } = await threadQ
  if (error) { console.error('[threads] field query error', error.message); return [] }
  const threads = (threadData ?? []) as {
    id: string; label: string; label_ai: string | null; label_user: string | null
    lens: string | null; domain: string | null; rope_id: string | null
    weight: number; temperature: number | null
    span_start: string | null; span_end: string | null
    private: boolean; dismissed: boolean
  }[]

  const items: FieldItem[] = []

  // Add ropes that have at least one visible thread.
  const ropedThreadIds = new Set(threads.filter((t) => t.rope_id).map((t) => t.rope_id!))
  for (const rope of ropeRows) {
    const members = threads.filter((t) => t.rope_id === rope.id)
    if (members.length < 2) continue
    // Horizon filter on rope: rope is visible if any member thread is visible.
    const allDates = members.flatMap((t) => [t.span_start, t.span_end]).filter(Boolean) as string[]
    const spanEnd = allDates.sort().at(-1) ?? ''
    if (windowStart && spanEnd < windowStart) continue

    const totalWeight = members.reduce((s, t) => s + t.weight, 0)
    const temp = members.reduce((s, t) => Math.max(s, t.temperature ?? 0), 0)
    items.push({
      id: rope.id,
      kind: 'rope',
      label: rope.label_user ?? rope.label,
      domain: rope.domain,
      lens: members[0]?.lens ?? null,
      spanStart: allDates.sort()[0] ?? '',
      spanEnd: spanEnd,
      weight: totalWeight,
      temperature: temp,
      private: false,
      threadCount: members.length,
    })
  }

  // Add standalone threads (no rope_id or rope not formed).
  for (const t of threads) {
    if (t.rope_id && ropedThreadIds.has(t.rope_id)) continue
    items.push({
      id: t.id,
      kind: 'thread',
      label: resolveLabel(t),
      domain: t.domain,
      lens: t.lens,
      spanStart: t.span_start ?? '',
      spanEnd: t.span_end ?? '',
      weight: t.weight,
      temperature: t.temperature ?? 0.1,
      private: t.private,
      threadCount: 1,
    })
  }

  // Sort: ropes first (richness), then by temperature + weight.
  items.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'rope' ? -1 : 1
    return (b.temperature - a.temperature) || (b.weight - a.weight)
  })

  return items
}

// ── rope decompose ────────────────────────────────────────────────────────────

export async function loadRope(ropeId: string): Promise<ThreadItem[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('threads')
    .select('id, label, label_ai, label_user, lens, span_start, span_end, weight')
    .eq('rope_id', ropeId)
    .order('weight', { ascending: false })
  if (error) { console.error('[threads] rope query error', error.message); return [] }
  return ((data ?? []) as {
    id: string; label: string; label_ai: string | null; label_user: string | null
    lens: string | null; span_start: string | null; span_end: string | null; weight: number
  }[]).map((t) => ({
    id: t.id,
    label: resolveLabel(t),
    lens: t.lens,
    spanStart: t.span_start ?? '',
    spanEnd: t.span_end ?? '',
    weight: t.weight,
  }))
}

// ── thread timeline ───────────────────────────────────────────────────────────

export async function loadThread(threadId: string): Promise<ThreadDetail | null> {
  const sb = requireSupabase()

  const { data: tdata, error: terr } = await sb
    .from('threads')
    .select('id, label, label_ai, label_user, lens, span_start, span_end')
    .eq('id', threadId)
    .maybeSingle()
  if (terr || !tdata) return null
  const t = tdata as { id: string; label: string; label_ai: string | null; label_user: string | null; lens: string | null; span_start: string | null; span_end: string | null }

  // Load members with their register + entry body.
  const { data: mdata, error: merr } = await sb
    .from('thread_members')
    .select('entry_id, register, entries(id, body_markdown, created_at)')
    .eq('thread_id', threadId)
    .order('entries(created_at)', { ascending: true })
  if (merr) { console.error('[threads] member query error', merr.message); return null }

  // Cast through unknown — Supabase infers the joined `entries` column as an
  // array type, but PostgREST returns a single object for FK many-to-one joins.
  type MemberRow = {
    entry_id: string
    register: string
    entries: { id: string; body_markdown: string; created_at: string } | null
  }
  const moments: MomentItem[] = ((mdata ?? []) as unknown as MemberRow[])
    .filter((m) => m.entries)
    .map((m) => ({
      entryId: m.entry_id,
      date: m.entries!.created_at,
      register: (m.register ?? 'neutral') as Register,
      excerpt: m.entries!.body_markdown.replace(/\s+/g, ' ').trim().slice(0, 200),
    }))

  const hasMeeting = moments.some((m) => m.register === 'meeting')
  return {
    id: t.id,
    label: resolveLabel(t),
    lens: t.lens,
    spanStart: t.span_start ?? '',
    spanEnd: t.span_end ?? '',
    reframe: reframeFor(t.span_start ?? '', t.span_end ?? '', moments.length, hasMeeting),
    moments,
  }
}

// ── source entry ──────────────────────────────────────────────────────────────

export async function loadEntry(entryId: string): Promise<EntryDetail | null> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('entries')
    .select('id, body_markdown, created_at')
    .eq('id', entryId)
    .maybeSingle()
  if (error || !data) return null
  const e = data as { id: string; body_markdown: string; created_at: string }
  const lines = e.body_markdown.trim().split('\n').filter((l) => l.trim())
  const title = lines[0]?.replace(/^#+\s*/, '') ?? 'Untitled'
  const body = lines.slice(1).join('\n').trim() || e.body_markdown.trim()
  return { id: e.id, date: e.created_at, title, body }
}

export type { Horizon, FieldItem, ThreadItem, ThreadDetail, EntryDetail }
