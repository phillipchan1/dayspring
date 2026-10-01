// Cleanup for duplicate HARVESTED prayers/senses (spiritual_items, source='scanned').
//
//   npx tsx scripts/dedupe-scanned-items.ts                    # dry run, every owner
//   npx tsx scripts/dedupe-scanned-items.ts --owner <uuid>     # dry run, one owner
//   npx tsx scripts/dedupe-scanned-items.ts --apply            # back up, then delete
//
// Where the duplicates came from
// ------------------------------
// Until reconcile_scanned_items (migration 20260930120000) the harvest inserted
// the passages it found and stamped entries.prayer_scanned_at in two separate
// steps, with no dedupe. The same prayer was planted twice whenever the stamp
// failed after the insert, or the daily cron and an import's altar_harvest job
// read the same unscanned entries at once. The RPC stops new ones; it does not
// collapse the ones already there, because choosing which copy to keep needs to
// look at what hangs off each — that is this script.
//
// What counts as a duplicate
// --------------------------
// Same owner, same entry_id, same type, byte-identical content, both
// source='scanned'. No fuzzy matching. A 'command' row (a /pray fence) is never
// touched, and neither is a row whose entry_id is null (its page was deleted, so
// there is nothing to say two rows are "the same prayer on the same page").
//
// Which copy survives
// -------------------
// The one with the most attached to it, so nothing the Altar shows is lost:
// resolved_at (someone marked it) > thread_id > subject_tagged_at; ties go to the
// lowest id. Deleting the others cascades their thread_members rows and nulls a
// seed_item_id that pointed at them — so after --apply, regroup the Altar:
//
//   npm run harvest:altar -- --regroup
//
// Logs ids and counts only — never prayer text. The backup file holds the text,
// because that is the thing being recovered from.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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

export interface ScannedRow {
  id: string
  owner: string
  entry_id: string | null
  type: string
  content: string
  thread_id: string | null
  subject_tagged_at: string | null
  resolved_at: string | null
}

/** Higher = more hangs off this row, so it is the one to keep. */
function weight(r: ScannedRow): number {
  return (r.resolved_at ? 4 : 0) + (r.thread_id ? 2 : 0) + (r.subject_tagged_at ? 1 : 0)
}

/**
 * PURE. Group harvested rows by (owner, entry, type, content) and, for every
 * group with more than one row, name the survivor and the rows to drop.
 */
export function planDedupe(rows: ScannedRow[]): { keep: ScannedRow; drop: ScannedRow[] }[] {
  const groups = new Map<string, ScannedRow[]>()
  for (const r of rows) {
    if (!r.entry_id) continue
    const key = [r.owner, r.entry_id, r.type, r.content].join('\u0000')
    const g = groups.get(key)
    if (g) g.push(r)
    else groups.set(key, [r])
  }
  const plan: { keep: ScannedRow; drop: ScannedRow[] }[] = []
  for (const g of groups.values()) {
    if (g.length < 2) continue
    const ranked = [...g].sort((a, b) => weight(b) - weight(a) || (a.id < b.id ? -1 : 1))
    plan.push({ keep: ranked[0]!, drop: ranked.slice(1) })
  }
  return plan
}

async function main(): Promise<void> {
  loadDotEnv()
  const APPLY = process.argv.includes('--apply')
  const ownerAt = process.argv.indexOf('--owner')
  const OWNER = ownerAt >= 0 ? process.argv[ownerAt + 1] : undefined
  const BACKUP_DIR = '/Users/philchan/dayspring-dedupe-backup'

  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !process.env[k])
  if (missing.length) {
    console.error(`Missing required env in .env: ${missing.join(', ')}`)
    process.exit(1)
  }
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const rows: ScannedRow[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    let q = sb
      .from('spiritual_items')
      .select('id, owner, entry_id, type, content, thread_id, subject_tagged_at, resolved_at')
      .eq('source', 'scanned')
      .not('entry_id', 'is', null)
      .order('id')
      .range(from, from + PAGE - 1)
    if (OWNER) q = q.eq('owner', OWNER)
    const { data, error } = await q
    if (error) throw error
    rows.push(...((data ?? []) as ScannedRow[]))
    if (!data || data.length < PAGE) break
  }

  const plan = planDedupe(rows)
  const drop = plan.flatMap((p) => p.drop)
  const byOwner = new Map<string, number>()
  for (const r of drop) byOwner.set(r.owner, (byOwner.get(r.owner) ?? 0) + 1)

  console.log(`${rows.length} harvested rows read${OWNER ? ` for ${OWNER}` : ' across all owners'}.`)
  console.log(`${plan.length} prayers are planted more than once; ${drop.length} extra rows to remove.`)
  for (const [owner, n] of byOwner) console.log(`  ${owner}: ${n}`)
  const losingTagged = drop.filter((r) => r.subject_tagged_at).length
  console.log(`  ${losingTagged} of the extras had been subject-tagged (already paid for; their survivor is tagged too).`)

  if (drop.length === 0) return
  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to back up and delete.')
    return
  }

  mkdirSync(BACKUP_DIR, { recursive: true })
  const file = `${BACKUP_DIR}/scanned-duplicates-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(file, JSON.stringify(plan, null, 2))
  console.log(`\nBacked up to ${file}`)

  const ids = drop.map((r) => r.id)
  const IN_CHUNK = 150 // ids travel in the URL
  let deleted = 0
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    const { data, error } = await sb
      .from('spiritual_items')
      .delete()
      .in('id', ids.slice(i, i + IN_CHUNK))
      .eq('source', 'scanned')
      .select('id')
    if (error) throw error
    deleted += (data ?? []).length
  }
  console.log(`Deleted ${deleted} rows. Now regroup the Altar: npm run harvest:altar -- --regroup`)
}

// Only run when invoked directly, so the test can import planDedupe.
if (process.argv[1]?.endsWith('dedupe-scanned-items.ts')) {
  main().catch((err) => {
    console.error('dedupe-scanned-items failed:', err instanceof Error ? err.message : JSON.stringify(err))
    process.exit(1)
  })
}
