/**
 * Owner-scoped table access for the Vite client (replaces PostgREST / RLS).
 * Replays a serialized supabase-js-shaped query through pgrest, then forces
 * `owner = session user` on every table that has that column.
 */
import { createPgRestClient, type PgRestClient } from './vercel/pgrest.ts'
import type { Sql } from './db.ts'

export type FilterCall = { op: string; args: unknown[] }

export interface DataQuerySpec {
  table: string
  mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  columns?: string
  count?: 'exact'
  head?: boolean
  values?: Record<string, unknown> | Record<string, unknown>[]
  onConflict?: string
  ignoreDuplicates?: boolean
  filters?: FilterCall[]
  orders?: Array<{ col: string; ascending?: boolean; nullsFirst?: boolean }>
  limit?: number
  range?: [number, number]
  single?: 'single' | 'maybe'
}

const ALLOWED_TABLES = new Set([
  'entries',
  'profiles',
  'attachments',
  'processing_jobs',
  'insights',
  'spiritual_items',
  'reminders',
  'echo_candidates',
  'echo_dismissals',
  'resurface_dismissals',
  'scripture_refs',
  'prayer_threads',
  'encounters',
  'altar_candidates',
  'altar_candidate_dismissals',
  'item_subjects',
  'threads',
  'ropes',
  'thread_members',
  'marks',
  'kept_subjects',
  'concordance',
  'concordance_occurrences',
  'concordance_events',
  'concordance_shadow',
])

const FILTER_OPS = new Set([
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'not', 'or', 'filter', 'match',
])

function asRow(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {}
}

function stampOwner(
  values: unknown,
  ownerId: string,
): Record<string, unknown> | Record<string, unknown>[] | undefined {
  if (values == null) return undefined
  if (Array.isArray(values)) return values.map((row) => ({ ...asRow(row), owner: ownerId }))
  return { ...asRow(values), owner: ownerId }
}

export async function runDataQuery(
  sql: Sql,
  ownerId: string,
  spec: DataQuerySpec,
): Promise<{ data: unknown; error: { message: string; code?: string } | null; count: number | null }> {
  if (!ALLOWED_TABLES.has(spec.table)) {
    return { data: null, error: { message: `table not allowed: ${spec.table}`, code: '42501' }, count: null }
  }
  const client = createPgRestClient(sql)
  const result = await replay(client, ownerId, spec)
  return { data: result.data, error: result.error, count: result.count }
}

async function replay(client: PgRestClient, ownerId: string, spec: DataQuerySpec) {
  let q = client.from(spec.table)
  const countOpts = spec.count ? { count: spec.count as 'exact', head: spec.head } : spec.head ? { head: true } : {}
  const ownedValues = stampOwner(spec.values, ownerId)

  if (spec.mode === 'select') q = q.select(spec.columns ?? '*', countOpts)
  else if (spec.mode === 'insert') {
    q = q.insert(ownedValues ?? {}, countOpts)
    if (spec.columns) q = q.select(spec.columns)
  } else if (spec.mode === 'upsert') {
    const upsertOpts: { onConflict?: string; ignoreDuplicates?: boolean; count?: 'exact'; head?: boolean } = {
      ...countOpts,
    }
    if (spec.onConflict !== undefined) upsertOpts.onConflict = spec.onConflict
    if (spec.ignoreDuplicates !== undefined) upsertOpts.ignoreDuplicates = spec.ignoreDuplicates
    q = q.upsert(ownedValues ?? {}, upsertOpts)
    if (spec.columns) q = q.select(spec.columns)
  } else if (spec.mode === 'update') {
    const patch = Array.isArray(ownedValues) ? ownedValues[0] : ownedValues
    q = q.update(patch ?? {}, countOpts)
    if (spec.columns) q = q.select(spec.columns)
  } else {
    q = q.delete(countOpts)
    if (spec.columns) q = q.select(spec.columns)
  }

  for (const filter of spec.filters ?? []) {
    if (!FILTER_OPS.has(filter.op)) {
      return { data: null, error: { message: `filter not allowed: ${filter.op}`, code: '42501' }, count: null }
    }
    const fn = (q as unknown as Record<string, (...a: unknown[]) => typeof q>)[filter.op]
    if (typeof fn !== 'function') {
      return { data: null, error: { message: `filter not allowed: ${filter.op}`, code: '42501' }, count: null }
    }
    q = fn.apply(q, filter.args)
  }

  const meta = await client.table(spec.table)
  if (meta.columns.has('owner')) {
    q = q.eq('owner', ownerId)
  } else if (spec.table === 'thread_members') {
    const ids = await client.exec(
      `SELECT id::text AS id FROM threads WHERE owner = $1::text`,
      [ownerId],
    )
    const threadIds = ids.map((row) => String(row.id))
    q = q.in('thread_id', threadIds.length ? threadIds : ['00000000-0000-0000-0000-000000000000'])
  }

  for (const order of spec.orders ?? []) {
    q = q.order(order.col, { ascending: order.ascending, nullsFirst: order.nullsFirst })
  }
  if (spec.limit != null) q = q.limit(spec.limit)
  if (spec.range) q = q.range(spec.range[0], spec.range[1])
  if (spec.single === 'single') q = q.single()
  if (spec.single === 'maybe') q = q.maybeSingle()

  return q
}
