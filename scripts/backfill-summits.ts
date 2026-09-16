// Build the SUMMIT for every year already in the archive.
//
//   npx tsx scripts/backfill-summits.ts --dry          # PLAN ONLY: count calls, spend $0
//   npx tsx scripts/backfill-summits.ts                # build years missing a yearly
//   npx tsx scripts/backfill-summits.ts --force        # rebuild every year (re-bills)
//   npx tsx scripts/backfill-summits.ts --since 2020   # only from this year on
//   npx tsx scripts/backfill-summits.ts --min 3        # months a year needs (default 3)
//   npx tsx scripts/backfill-summits.ts --owner <uuid|email> | --all
//
// `regen.ts` can only ever build the CURRENT year — it anchors on the latest
// entry — so a fifteen-year archive had no way to get a Summit for any year but
// this one. This fills that in, and it is cheap: a yearly rollup reads the
// year's MONTHLIES, not its entries, so a decade of history is about a dozen
// model calls rather than one per page.
//
// Runs locally (no Vercel timeout), straight to Supabase with the service-role
// key + OpenAI. Idempotent in DATA *and* COST: by default it skips years that
// already have a rollup, so re-running only fills gaps. Logs counts only, never
// entry text.

import { readFileSync } from 'node:fs'

// ── load .env into process.env (so api/_lib/env.ts can read it) ─────────────
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
const FORCE = args.includes('--force')

function num(flag: string, fallback: number): number {
  const i = args.indexOf(flag)
  const raw = i >= 0 ? args[i + 1] : undefined
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * How many built months a year needs before it gets a Summit.
 *
 * Not a performance guard — a principle. A "throughline" drawn from one month of
 * writing is a mirror pretending to be a window (PRINCIPLES.md #5: value
 * compounds, don't fake it early). A year the writer barely kept should show an
 * honest empty summit rather than a manufactured one.
 */
const MIN_MONTHS = num('--min', 3)
const SINCE = num('--since', -Infinity)

// --dry only reads, so it needs no OpenAI key.
const REQUIRED = DRY
  ? ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  : ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { buildYearly } = await import('../api/_lib/synthesize.ts')
const { resolveOwners } = await import('./_owner.ts')

const sb = supabaseAdmin()

function errMsg(e: unknown): string {
  const pg = e as { message?: string } | null
  return pg?.message ?? (e instanceof Error ? e.message : String(e))
}

/** period_start years for a tier, as a count per year. */
async function periodsByYear(owner: string, type: 'monthly' | 'yearly'): Promise<Map<number, number>> {
  const { data, error } = await sb
    .from('insights')
    .select('period_start')
    .eq('owner', owner)
    .eq('type', type)
  if (error) throw error
  const byYear = new Map<number, number>()
  for (const row of (data ?? []) as { period_start: string }[]) {
    const y = Number(row.period_start.slice(0, 4))
    if (!Number.isFinite(y)) continue
    byYear.set(y, (byYear.get(y) ?? 0) + 1)
  }
  return byYear
}

const owners = await resolveOwners()
console.log(
  `Summit backfill · ${owners.length} owner(s)${FORCE ? ' · force' : ''}` +
    `${Number.isFinite(SINCE) ? ` · since ${SINCE}` : ''} · min ${MIN_MONTHS} months/year`,
)

let totalCalls = 0

for (const owner of owners) {
  const [months, yearsBuilt] = await Promise.all([
    periodsByYear(owner, 'monthly'),
    periodsByYear(owner, 'yearly'),
  ])

  const candidates = [...months.entries()]
    .filter(([year]) => year >= SINCE)
    .sort((a, b) => b[0] - a[0]) // newest first: the years most likely to be read

  const tooThin = candidates.filter(([, n]) => n < MIN_MONTHS)
  const already = candidates.filter(([, n]) => n >= MIN_MONTHS).filter(([y]) => !FORCE && yearsBuilt.has(y))
  const todo = candidates.filter(([, n]) => n >= MIN_MONTHS).filter(([y]) => FORCE || !yearsBuilt.has(y))

  console.log(`\nowner ${owner.slice(0, 8)}… — ${months.size} year(s) with monthlies`)
  if (tooThin.length) {
    console.log(
      `  skipping (under ${MIN_MONTHS} months): ${tooThin.map(([y, n]) => `${y}(${n})`).join(', ')}`,
    )
  }
  if (already.length) {
    console.log(`  already built: ${already.map(([y]) => y).join(', ')}`)
  }
  console.log(`  to build: ${todo.length ? todo.map(([y, n]) => `${y}(${n}mo)`).join(', ') : 'nothing'}`)
  console.log(`  → up to ${todo.length} model call(s)`)

  if (DRY || todo.length === 0) continue

  for (const [year] of todo) {
    const period = { start: `${year}-01-01`, end: `${year}-12-31` }
    try {
      const r = await buildYearly(owner, period)
      if (r.status === 'built') totalCalls++
      console.log(
        `  ${year}  ${r.status === 'built' ? `✓ ${r.ebenezer ?? 0} stone(s), refrain ${r.refrain ? 'yes' : 'no'}` : `· ${r.reason ?? 'skipped'}`}`,
      )
    } catch (e) {
      console.error(`  ${year}  ✗ ${errMsg(e)}`)
    }
  }
}

if (DRY) {
  console.log('\n--dry: nothing built. Drop --dry to run.')
} else {
  console.log(`\nDone — ${totalCalls} model call(s) made. The Summit's year rail will show them.`)
}
