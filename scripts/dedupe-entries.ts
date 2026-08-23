// Cleanup for duplicate entry rows. The matching lives in dedupeEntries.lib.ts
// (and is tested); this fetches, reports, and deletes.
//
//   npx tsx scripts/dedupe-entries.ts            # dry run: list what it found
//   npx tsx scripts/dedupe-entries.ts --apply    # delete the contained twins
//
// Two kinds are reported, and only one is ever deleted:
//
//   CONTAINED — one body is wholly inside the other. Deleting the smaller loses
//   no words. `--apply` does this.
//
//   NEAR — almost the same, but each holds something the other doesn't. This is
//   the shape left by the conflict-fork bug. Reported for a human to read and
//   merge; never deleted, because the smaller row contains writing that would go
//   with it.
//
// Conservative throughout: native rows only, same owner, same calendar day, and
// a real body. Logs ids/dates/word counts — never entry text.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import {
  findDuplicates,
  isPreservedVersionId,
  type DupePair,
  type DupeRow,
} from './dedupeEntries.lib.js'

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
loadDotEnv()

const APPLY = process.argv.includes('--apply')

const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

async function fetchAll(): Promise<DupeRow[]> {
  const out: DupeRow[] = []
  for (let from = 0; ; from += 1000) {
    // All sources: both bugs minted NATIVE copies, but the surviving twin can be
    // an imported row. Only native rows are ever dropped (see the lib).
    const { data, error } = await sb
      .from('entries')
      .select('id, owner, created_at, updated_at, body_markdown, word_count, source')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    out.push(...((data ?? []) as DupeRow[]))
    if ((data ?? []).length < 1000) break
  }
  return out
}

const rows = await fetchAll()
console.log(`scanned ${rows.length} entries`)

const { contained, near } = findDuplicates(rows)

function describe({ keep, drop, coverage }: DupePair, verb: string): string {
  const forked = isPreservedVersionId(drop.id) || isPreservedVersionId(keep.id)
  return (
    `${drop.created_at.slice(0, 10)}  ${verb} ${drop.id} (${drop.word_count}w, updated ${drop.updated_at})` +
    `  — twin of ${keep.id} (${keep.word_count}w; ${(coverage * 100).toFixed(1)}% of the smaller is in it)` +
    (forked ? '  [conflict fork]' : '')
  )
}

if (near.length) {
  console.log(`\n${near.length} near-duplicate pair(s) — read these and merge by hand:`)
  for (const pair of near) console.log(`  ${describe(pair, 'review')}`)
  console.log('  (not deleted: each row holds something the other does not)')
}

if (contained.length === 0) {
  console.log(near.length ? '\nno contained duplicates to delete' : 'no duplicate pairs found')
  process.exit(0)
}

console.log(`\n${contained.length} contained duplicate(s):`)
for (const pair of contained) console.log(`  ${describe(pair, 'drop')}`)

if (!APPLY) {
  console.log(`\ndry run: ${contained.length} deletable. Re-run with --apply to delete.`)
  process.exit(0)
}

const ids = contained.map((p) => p.drop.id)
const { error } = await sb.from('entries').delete().in('id', ids)
if (error) {
  console.error('delete failed:', error.message)
  process.exit(1)
}
console.log(`deleted ${ids.length} duplicate entr${ids.length === 1 ? 'y' : 'ies'}`)
