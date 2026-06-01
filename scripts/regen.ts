// Targeted, COST-BOUNDED regeneration for the Looking Back v2 rollout.
//
//   npx tsx scripts/regen.ts                 # rebuild ONLY rollups that already
//                                            # exist (weekly + monthly), with the
//                                            # new rich prompts. Bounded by data.
//   npx tsx scripts/regen.ts --quarter-year  # ALSO build the latest quarter + year
//                                            # (needs the quarterly migration applied
//                                            # and enough monthlies to read).
//
// Runs locally with the service-role key + OpenAI, like backfill.ts. Idempotent
// (builders upsert). Logs counts only, never entry text.

import { readFileSync } from 'node:fs'

function loadDotEnv(): void {
  let raw = ''
  try {
    raw = readFileSync('.env', 'utf8')
  } catch {
    return
  }
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = val
  }
}
loadDotEnv()

const args = process.argv.slice(2)
const QUARTER_YEAR = args.includes('--quarter-year')

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'APP_OWNER_ID']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { buildWeekly, buildMonthly, buildQuarterly, buildYearly } = await import(
  '../api/_lib/synthesize.ts'
)
const { previousQuarter, previousYear } = await import('../api/_lib/dates.ts')

const owner = process.env.APP_OWNER_ID as string
const sb = supabaseAdmin()

interface Row {
  period_start: string
  period_end: string
}

async function existing(type: string): Promise<Row[]> {
  const { data, error } = await sb
    .from('insights')
    .select('period_start, period_end')
    .eq('owner', owner)
    .eq('type', type)
    .order('period_start', { ascending: true })
  if (error) throw error
  return (data ?? []) as Row[]
}

function errMsg(e: unknown): string {
  const pg = e as { message?: string } | null
  return pg?.message ?? (e instanceof Error ? e.message : String(e))
}

const weeks = await existing('weekly')
const months = await existing('monthly')
console.log(`Regenerating ${weeks.length} weeklies + ${months.length} monthlies (rich prompts)…`)

console.log('\nWeeklies:')
for (const w of weeks) {
  try {
    const r = await buildWeekly(owner, { start: w.period_start, end: w.period_end })
    console.log(`  ${w.period_start}…${w.period_end}  ✓ ${r.quotes ?? 0} quotes, ${r.questions ?? 0} questions`)
  } catch (e) {
    console.error(`  ${w.period_start}  ✗ ${errMsg(e)}`)
  }
}

console.log('\nMonthlies:')
for (const m of months) {
  try {
    const r = await buildMonthly(owner, { start: m.period_start, end: m.period_end })
    console.log(`  ${m.period_start.slice(0, 7)}  ✓ ${r.quotes ?? 0} quotes`)
  } catch (e) {
    console.error(`  ${m.period_start.slice(0, 7)}  ✗ ${errMsg(e)}`)
  }
}

if (QUARTER_YEAR) {
  const now = new Date()
  const q = previousQuarter(now)
  const y = previousYear(now)
  console.log(`\nQuarter ${q.start}…${q.end}:`)
  try {
    const r = await buildQuarterly(owner, q)
    console.log(`  ${r.status}  ${r.ebenezer ?? 0} ebenezer, ${r.questions ?? 0} questions${r.reason ? ` (${r.reason})` : ''}`)
  } catch (e) {
    console.error(`  ✗ ${errMsg(e)}`)
  }
  console.log(`\nYear ${y.start}…${y.end}:`)
  try {
    const r = await buildYearly(owner, y)
    console.log(`  ${r.status}  ${r.ebenezer ?? 0} stones${r.reason ? ` (${r.reason})` : ''}`)
  } catch (e) {
    console.error(`  ✗ ${errMsg(e)}`)
  }
}

console.log('\nDone. Reload Looking Back.')
