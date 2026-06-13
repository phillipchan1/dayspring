// One-time historical backfill for the Altar (then cheap incremental top-ups via
// the daily cron). Embeds all history, clusters recurring prayers into threads,
// and migrates the legacy answered-binary into `answered` encounters.
//
//   npx tsx scripts/altar-backfill.ts --dry   # PLAN ONLY: count work, spend $0
//   npx tsx scripts/altar-backfill.ts         # embed → thread → migrate
//
// Runs LOCALLY (no Vercel timeout): service-role Supabase + OpenAI. Idempotent —
// already-embedded entries and already-threaded prayers are skipped, so re-running
// only fills gaps. Logs counts only, never entry/prayer text (§8).

import { readFileSync } from 'node:fs'

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

const DRY = process.argv.slice(2).includes('--dry')

const REQUIRED = DRY
  ? ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  : ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { requireOwner } = await import('./_owner.ts')
const owner = await requireOwner()

async function count(table: string, refine: (q: any) => any): Promise<number> {
  const sb = supabaseAdmin()
  // range(0,0) (not head:true) so PostgREST returns an error BODY on failure —
  // the exact count still rides in the Content-Range header.
  let q = sb.from(table).select('id', { count: 'exact' }).eq('owner', owner).range(0, 0)
  q = refine(q)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

async function main(): Promise<void> {
  if (DRY) {
    const unembEntries = await count('entries', (q) => q.is('embedding', null))
    const unembItems = await count('spiritual_items', (q) =>
      q.in('type', ['prayer', 'sense']).is('embedding', null),
    )
    const unthreaded = await count('spiritual_items', (q) =>
      q.in('type', ['prayer', 'sense']).is('thread_id', null),
    )
    const legacy = await count('spiritual_items', (q) =>
      q.eq('type', 'prayer').not('resolved_at', 'is', null),
    )
    console.log(`Owner ${owner} — plan (no calls made):`)
    console.log(`  Embeddings:  ${unembEntries} entries + ${unembItems} prayers/senses to embed`)
    console.log(`  Threading:   ${unthreaded} unthreaded prayers/senses to cluster`)
    console.log(`  Legacy:      up to ${legacy} answered-prayers to migrate into encounters`)
    console.log(`\n--dry: nothing written. Drop --dry to run.`)
    return
  }

  const { embedUnembedded, threadItems, migrateLegacyAnswered } = await import('../api/_lib/altar.ts')

  console.log('Step 1/3 — embedding entries + prayers/senses…')
  const e = await embedUnembedded(owner)
  console.log(`  embedded ${e.entries} entries, ${e.items} prayers/senses.`)

  console.log('\nStep 2/3 — clustering recurring prayers into threads…')
  const t = await threadItems(owner)
  console.log(`  placed ${t.placed} items · ${t.newThreads} new threads · ${t.updatedThreads} grown.`)

  console.log('\nStep 3/3 — migrating legacy answered prayers → encounters…')
  const m = await migrateLegacyAnswered(owner)
  console.log(`  migrated ${m.migrated} encounters.`)

  console.log('\nDone. Open the Altar to see the cairns.')
}

main().catch((err) => {
  const pg = err as { message?: string; code?: string; details?: string; hint?: string } | null
  const parts = [pg?.message, pg?.details, pg?.hint, pg?.code && `(${pg.code})`].filter(Boolean)
  const fallback =
    err instanceof Error ? err.message : JSON.stringify(err, Object.getOwnPropertyNames(err ?? {}))
  console.error('Altar backfill failed:', parts.length ? parts.join(' — ') : fallback || 'unknown error')
  if (pg?.code === '42703' || pg?.code === '42P01') {
    console.error('↳ The Altar migration (supabase/migrations/20260602000000_altar.sql) is not applied to this database yet.')
  }
  process.exit(1)
})
