/**
 * One-time insert-only Gather rescan. DO NOT RUN against a live journal unless
 * you mean to. Default is --dry-run; --apply is required to write.
 *
 *   npx tsx scripts/gather-rescan.ts --owner=<uuid> --dry-run
 *   npx tsx scripts/gather-rescan.ts --owner=<uuid> --max=50 --after=<entry-id-or-date>
 *   npx tsx scripts/gather-rescan.ts --owner=<uuid> --max=50 --apply
 *   npx tsx scripts/gather-rescan.ts --owner=<uuid> --apply --downstream
 *
 * Inserts only spans not already present for that entry (dedupe on
 * entry_id + normalized content). Never calls resetHarvest. Never updates or
 * deletes existing rows. Writes no processing_jobs. Leaves prayer_scanned_at
 * alone.
 *
 * After --apply, either pass --downstream (embedUnembedded → tagSubjects →
 * regroupDeclared) or run:
 *   npx tsx scripts/altar-harvest.ts --regroup
 *   # embed + tag happen in processing as altar_embed / altar_thread, or:
 *   # embedUnembedded(owner); tagSubjects(owner); regroupDeclared(owner)
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export function normalizeHarvestContent(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseAfter(raw: string | undefined): { kind: 'id' | 'date'; value: string } | null {
  if (!raw) return null
  const v = raw.trim()
  if (!v) return null
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
    return { kind: 'id', value: v.toLowerCase() }
  }
  const t = Date.parse(v)
  if (!Number.isFinite(t)) throw new Error(`--after must be an entry uuid or a date, got ${JSON.stringify(raw)}`)
  return { kind: 'date', value: new Date(t).toISOString() }
}

export interface RescanEntry {
  id: string
  created_at: string
  body_markdown: string
}

export interface ExistingItem {
  entry_id: string
  content: string
}

export interface GatherRescanDeps {
  fetchEntries: (owner: string) => Promise<RescanEntry[]>
  fetchExisting: (owner: string, entryIds: string[]) => Promise<ExistingItem[]>
  insertRows: (rows: Record<string, unknown>[]) => Promise<void>
  gatherHarvest: (entries: { id: string; body: string }[]) => Promise<{
    byEntry: Map<string, { type: 'prayer' | 'sense'; text: string }[]>
    failed: string[]
    gate: Map<string, { containsPrayer: boolean; containsSense: boolean }>
  }>
  downstream?: (owner: string) => Promise<void>
}

export interface GatherRescanOpts {
  owner: string
  max?: number
  after?: string
  apply: boolean
  downstream: boolean
}

export interface GatherRescanResult {
  entriesRead: number
  gatePositive: number
  inserted: number
  skippedDuplicate: number
  failed: string[]
  nextCursor: { id: string; created_at: string } | null
  usage: { calls: number; in: number; cached: number; out: number; reasoning: number }
  wouldInsert: number
  dryRun: boolean
}

export function applyAfter(entries: RescanEntry[], after: ReturnType<typeof parseAfter>): RescanEntry[] {
  if (!after) return entries
  if (after.kind === 'id') {
    const idx = entries.findIndex((e) => e.id.toLowerCase() === after.value)
    return idx === -1 ? entries : entries.slice(idx + 1)
  }
  return entries.filter((e) => e.created_at > after.value)
}

export function newSpansForEntry(
  entryId: string,
  passages: { type: 'prayer' | 'sense'; text: string }[],
  existingNorm: Set<string>,
): { type: 'prayer' | 'sense'; text: string }[] {
  const out: { type: 'prayer' | 'sense'; text: string }[] = []
  const seen = new Set<string>()
  for (const p of passages) {
    const key = `${entryId}::${normalizeHarvestContent(p.text)}`
    if (!key.endsWith('::') && !existingNorm.has(key) && !seen.has(key)) {
      seen.add(key)
      out.push(p)
    }
  }
  return out
}

export async function runGatherRescan(
  opts: GatherRescanOpts,
  deps: GatherRescanDeps,
): Promise<GatherRescanResult> {
  const after = parseAfter(opts.after)
  const all = await deps.fetchEntries(opts.owner)
  const ordered = [...all].sort((a, b) =>
    a.created_at === b.created_at ? a.id.localeCompare(b.id) : a.created_at.localeCompare(b.created_at),
  )
  const sliced = applyAfter(ordered, after)
  const pool = opts.max ? sliced.slice(0, opts.max) : sliced

  const existing = pool.length ? await deps.fetchExisting(opts.owner, pool.map((e) => e.id)) : []
  const existingNorm = new Set(existing.map((r) => `${r.entry_id}::${normalizeHarvestContent(r.content)}`))

  const harvested = await deps.gatherHarvest(pool.map((e) => ({ id: e.id, body: e.body_markdown })))
  const failed = harvested.failed
  const failedSet = new Set(failed)

  let gatePositive = 0
  for (const e of pool) {
    if (failedSet.has(e.id)) continue
    const g = harvested.gate.get(e.id)
    if (g?.containsPrayer || g?.containsSense || (harvested.byEntry.get(e.id) ?? []).length > 0) {
      gatePositive++
    }
  }

  const rows: Record<string, unknown>[] = []
  let skippedDuplicate = 0
  for (const e of pool) {
    if (failedSet.has(e.id)) continue
    const passages = harvested.byEntry.get(e.id) ?? []
    const fresh = newSpansForEntry(e.id, passages, existingNorm)
    skippedDuplicate += passages.length - fresh.length
    for (const p of fresh) {
      rows.push({
        owner: opts.owner,
        entry_id: e.id,
        type: p.type,
        content: p.text,
        source: 'scanned',
        created_at: e.created_at,
      })
    }
  }

  if (opts.apply && rows.length) await deps.insertRows(rows)
  if (opts.apply && opts.downstream && deps.downstream) await deps.downstream(opts.owner)

  const last = pool[pool.length - 1] ?? null
  return {
    entriesRead: pool.length,
    gatePositive,
    inserted: opts.apply ? rows.length : 0,
    wouldInsert: rows.length,
    skippedDuplicate,
    failed,
    nextCursor: last ? { id: last.id, created_at: last.created_at } : null,
    usage: { calls: 0, in: 0, cached: 0, out: 0, reasoning: 0 },
    dryRun: !opts.apply,
  }
}

function loadDotEnv(): void {
  let raw = ''
  try {
    raw = readFileSync('.env', 'utf8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = val
  }
}

function parseArgs(argv: string[]): GatherRescanOpts {
  const owner = argv.find((a) => a.startsWith('--owner='))?.slice('--owner='.length)
  if (!owner) throw new Error('Required: --owner=<uuid>')
  const maxArg = argv.find((a) => a.startsWith('--max='))
  const after = argv.find((a) => a.startsWith('--after='))?.slice('--after='.length)
  const apply = argv.includes('--apply')
  const dry = argv.includes('--dry-run') || argv.includes('--dry')
  if (dry && apply) throw new Error('Pass either --dry-run (default) or --apply, not both')
  return {
    owner,
    max: maxArg ? Number(maxArg.slice('--max='.length)) : undefined,
    after,
    apply,
    downstream: argv.includes('--downstream'),
  }
}

const invoked =
  Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]!)

if (invoked) {
  loadDotEnv()
  const opts = parseArgs(process.argv.slice(2))
  const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']
  const missing = REQUIRED.filter((k) => !process.env[k])
  if (missing.length) {
    console.error(`Missing required env: ${missing.join(', ')}`)
    process.exit(1)
  }

  const usage = { calls: 0, in: 0, cached: 0, out: 0, reasoning: 0 }
  const realLog = console.log
  console.log = (...a: unknown[]) => {
    const line = typeof a[0] === 'string' ? a[0] : ''
    if (line.startsWith('[tokens]')) {
      const num = (k: string) => Number(new RegExp(`\\b${k}=(\\d+)`).exec(line)?.[1] ?? 0)
      usage.calls++
      usage.in += num('in')
      usage.cached += num('cached')
      usage.out += num('out')
      usage.reasoning += num('reasoning')
      return
    }
    realLog(...a)
  }

  const PAGE = 1000
  const IN_CHUNK = 150

  const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
  const { gatherHarvest } = await import('../api/_lib/gather.ts')
  const sb = supabaseAdmin()

  async function fetchEntries(owner: string): Promise<RescanEntry[]> {
    const out: RescanEntry[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from('entries')
        .select('id, created_at, body_markdown')
        .eq('owner', owner)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as RescanEntry[]
      out.push(...rows)
      if (rows.length < PAGE) break
    }
    return out
  }

  async function fetchExisting(owner: string, entryIds: string[]): Promise<ExistingItem[]> {
    const out: ExistingItem[] = []
    for (let i = 0; i < entryIds.length; i += IN_CHUNK) {
      const { data, error } = await sb
        .from('spiritual_items')
        .select('entry_id, content')
        .eq('owner', owner)
        .in('entry_id', entryIds.slice(i, i + IN_CHUNK))
      if (error) throw error
      out.push(...((data ?? []) as ExistingItem[]))
    }
    return out
  }

  const result = await runGatherRescan(opts, {
    fetchEntries,
    fetchExisting,
    insertRows: async (rows) => {
      const { error } = await sb.from('spiritual_items').insert(rows)
      if (error) throw error
    },
    gatherHarvest,
    downstream: async (owner) => {
      const { embedUnembedded } = await import('../api/_lib/altar.ts')
      const { tagPlan, tagSubjects, regroupDeclared } = await import('../api/_lib/declared.ts')
      const emb = await embedUnembedded(owner)
      realLog(`  downstream embed: entries=${emb.entries} items=${emb.items}`)
      let { untagged } = await tagPlan(owner)
      while (untagged > 0) {
        const r = await tagSubjects(owner, { max: 500 })
        realLog(`  downstream tag: read=${r.read} kept=${r.kept} remaining=${r.remaining}`)
        untagged = r.remaining
        if (r.read === 0) break
      }
      const g = await regroupDeclared(owner)
      realLog(
        `  downstream regroup: subjects=${g.subjects} +${g.created} ~${g.updated} members +${g.membersAdded}/-${g.membersRemoved}`,
      )
    },
  })
  result.usage = usage

  const lunaIn = 0.1
  const lunaOut = 0.5
  const lunaCached = 0.01
  const dollars =
    (usage.in / 1_000_000) * lunaIn +
    (usage.cached / 1_000_000) * lunaCached +
    (usage.out / 1_000_000) * lunaOut

  realLog(`gather-rescan ${result.dryRun ? 'DRY-RUN' : 'APPLY'} owner=${opts.owner}`)
  realLog(`  entries read       ${result.entriesRead}`)
  realLog(`  gate-positive      ${result.gatePositive}`)
  realLog(`  ${result.dryRun ? 'would-insert' : 'inserted'}        ${result.wouldInsert}`)
  realLog(`  skipped duplicate  ${result.skippedDuplicate}`)
  realLog(`  failed             ${result.failed.length}${result.failed.length ? ` (${result.failed.join(', ')})` : ''}`)
  realLog(
    `  tokens             in=${usage.in} cached=${usage.cached} out=${usage.out} reasoning=${usage.reasoning}  ${usage.calls} calls  ~$${dollars.toFixed(4)}`,
  )
  realLog(
    `  next cursor        ${result.nextCursor ? `${result.nextCursor.id}  ${result.nextCursor.created_at}` : '— (done)'}`,
  )
  if (result.dryRun) {
    realLog(`\nNothing written. Re-run with --apply to insert.`)
    realLog(`After apply, pass --downstream or run:`)
    realLog(`  embedUnembedded / tagSubjects / regroupDeclared  (or npx tsx scripts/altar-harvest.ts --regroup after embed+tag)`)
  }
}
