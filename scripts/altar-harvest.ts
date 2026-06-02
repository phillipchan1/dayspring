// Prayer harvest — read the prose of past entries and lay the prayers already
// written there onto the Altar (the writer's own verbatim words). Then embed +
// thread them into cairns. Mirrors scripts/altar-backfill.ts.
//
//   npx tsx scripts/altar-harvest.ts --dry        # PLAN: unscanned + cue matches + est calls, $0
//   npx tsx scripts/altar-harvest.ts              # harvest → embed → thread
//   npx tsx scripts/altar-harvest.ts --max=200    # only touch the first 200 unscanned (test run)
//
// Runs LOCALLY (no Vercel timeout): service-role Supabase + OpenAI (Nano).
// Idempotent + cost-bounded: each entry is read by the model at most once
// (prayer_scanned_at watermark). Logs counts only, never entry text (§8).

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

const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const RESET = args.includes('--reset')
const maxArg = args.find((a) => a.startsWith('--max='))
const MAX = maxArg ? Number(maxArg.slice('--max='.length)) : undefined

const REQUIRED = DRY
  ? ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'APP_OWNER_ID']
  : ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'APP_OWNER_ID']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const owner = process.env.APP_OWNER_ID as string

async function main(): Promise<void> {
  const { harvestPlan } = await import('../api/_lib/altar.ts')

  if (DRY) {
    const { unscanned, candidates } = await harvestPlan(owner)
    const calls = Math.ceil(candidates / 6)
    console.log(`Owner ${owner} — prayer harvest plan (no calls made):`)
    console.log(`  Unscanned entries:     ${unscanned}`)
    console.log(`  Clear the prayer cue:  ${candidates}  → ~${calls} Nano calls (batched 6/entry)`)
    console.log(`  (entries without a cue are marked scanned, no model call)`)
    console.log(`\n--dry: nothing written. Drop --dry to run${MAX ? ` (capped at ${MAX} entries)` : ''}.`)
    return
  }

  const { harvestPrayers, embedUnembedded, threadItems, resetHarvest } = await import('../api/_lib/altar.ts')

  if (RESET) {
    console.log('Resetting prior harvest (deleting scanned items, clearing watermark)…')
    const r = await resetHarvest(owner)
    console.log(`  removed ${r.deleted} scanned items; all entries marked unscanned.\n`)
  }

  console.log(`Step 1/3 — reading prose for prayers${MAX ? ` (first ${MAX} unscanned)` : ''}…`)
  const h = await harvestPrayers(owner, MAX ? { max: MAX } : {})
  console.log(`  scanned ${h.scanned} entries · ${h.candidates} had cues · planted ${h.planted} prayers/senses.`)

  console.log('\nStep 2/3 — embedding the new prayers…')
  const e = await embedUnembedded(owner)
  console.log(`  embedded ${e.entries} entries, ${e.items} prayers/senses.`)

  console.log('\nStep 3/3 — clustering into cairns…')
  const t = await threadItems(owner)
  console.log(`  placed ${t.placed} items · ${t.newThreads} new threads · ${t.updatedThreads} grown.`)

  console.log('\nDone. Open the Altar — the field should be fuller now.')
}

main().catch((err) => {
  const pg = err as { message?: string; code?: string; details?: string; hint?: string } | null
  const parts = [pg?.message, pg?.details, pg?.hint, pg?.code && `(${pg.code})`].filter(Boolean)
  const fallback = err instanceof Error ? err.message : JSON.stringify(err, Object.getOwnPropertyNames(err ?? {}))
  console.error('Altar harvest failed:', parts.length ? parts.join(' — ') : fallback || 'unknown error')
  if (pg?.code === '42703' || pg?.code === '42P01') {
    console.error('↳ Apply migration supabase/migrations/20260602020000_altar_harvest.sql first.')
  }
  process.exit(1)
})
