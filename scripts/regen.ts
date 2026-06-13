// Strategic, COST-BOUNDED build for Looking Back. Builds ONLY the current
// window you actually look at — never the 15-year history — bottom-up, reusing
// any child rollup that already exists and skipping empty periods for free
// (empty periods make zero GPT calls).
//
//   npx tsx scripts/regen.ts                  # depth = month (this week + this month + its weeks)
//   npx tsx scripts/regen.ts week             # just the current week (1 call)
//   npx tsx scripts/regen.ts quarter          # + current quarter (needs the quarterly migration)
//   npx tsx scripts/regen.ts year             # + current year (the priciest: this year's months)
//   npx tsx scripts/regen.ts month --force    # rebuild even if the rollup already exists
//   npx tsx scripts/regen.ts month --dry      # plan + GPT-call estimate, spend $0
//
// Runs locally with the service-role key + OpenAI, like backfill.ts. Idempotent.
// Logs counts only, never entry text.

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
const FORCE = args.includes('--force')
const DRY = args.includes('--dry')
type Depth = 'week' | 'month' | 'quarter' | 'year'
const DEPTH: Depth = (args.find((a) => ['week', 'month', 'quarter', 'year'].includes(a)) as Depth) ?? 'month'
const RANK: Record<Depth, number> = { week: 0, month: 1, quarter: 2, year: 3 }

const REQUIRED = DRY
  ? ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  : ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { buildWeekly, buildMonthly, buildQuarterly, buildYearly } = await import('../api/_lib/synthesize.ts')
const { mondayOf, addDays, toDateStr, weeksOverlappingMonth, monthsInPeriod } = await import('../api/_lib/dates.ts')

interface Period {
  start: string
  end: string
}
const { requireOwner } = await import('./_owner.ts')
const owner = await requireOwner()
const sb = supabaseAdmin()

function errMsg(e: unknown): string {
  const pg = e as { message?: string } | null
  return pg?.message ?? (e instanceof Error ? e.message : String(e))
}

async function existing(type: string): Promise<Set<string>> {
  const { data, error } = await sb.from('insights').select('period_start').eq('owner', owner).eq('type', type)
  if (error) throw error
  return new Set((data ?? []).map((r: { period_start: string }) => r.period_start))
}

// Anchor on the latest entry so we land on real data (not an empty "today").
async function targetDate(): Promise<Date> {
  const { data } = await sb
    .from('entries')
    .select('created_at')
    .eq('owner', owner)
    .order('created_at', { ascending: false })
    .limit(1)
  const iso = (data as { created_at: string }[] | null)?.[0]?.created_at
  return new Date(`${(iso ?? new Date().toISOString()).slice(0, 10)}T00:00:00Z`)
}

const target = await targetDate()
const y = target.getUTCFullYear()
const monthOf = (d: Date): Period => ({
  start: toDateStr(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))),
  end: toDateStr(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))),
})

// The periods this depth needs (cumulative cascade, current windows only).
const weekStart = mondayOf(target)
const curWeek: Period = { start: toDateStr(weekStart), end: toDateStr(addDays(weekStart, 6)) }
const curMonth = monthOf(target)
const q = Math.floor(target.getUTCMonth() / 3)
const curQuarter: Period = {
  start: toDateStr(new Date(Date.UTC(y, q * 3, 1))),
  end: toDateStr(new Date(Date.UTC(y, q * 3 + 3, 0))),
}
const curYear: Period = { start: `${y}-01-01`, end: `${y}-12-31` }

// Collect the months whose weeklies + monthlies the chosen depth needs.
const monthList: Period[] =
  RANK[DEPTH] >= RANK.year
    ? monthsInPeriod(curYear)
    : RANK[DEPTH] >= RANK.quarter
      ? monthsInPeriod(curQuarter)
      : RANK[DEPTH] >= RANK.month
        ? [curMonth]
        : []

const weekList: Period[] = RANK[DEPTH] >= RANK.month ? monthList.flatMap((m) => weeksOverlappingMonth(m)) : [curWeek]

// Dedup + skip already-built (cost-idempotent) unless --force.
const builtW = await existing('weekly')
const builtM = await existing('monthly')
const builtQ = await existing('quarterly')
const builtYr = await existing('yearly')

const uniq = (ps: Period[]): Period[] => {
  const seen = new Set<string>()
  return ps.filter((p) => (seen.has(p.start) ? false : (seen.add(p.start), true)))
}
const weeks = uniq(weekList).filter((p) => FORCE || !builtW.has(p.start))
const months = uniq(monthList).filter((p) => FORCE || !builtM.has(p.start))
const doQuarter = RANK[DEPTH] >= RANK.quarter && (FORCE || !builtQ.has(curQuarter.start))
const doYear = RANK[DEPTH] >= RANK.year && (FORCE || !builtYr.has(curYear.start))

console.log(`Target ${toDateStr(target)} · depth=${DEPTH}${FORCE ? ' (force)' : ''}`)
console.log(
  `Plan (non-empty periods each = 1 GPT call): ${weeks.length} weeklies, ${months.length} monthlies` +
    `${doQuarter ? ', 1 quarterly' : ''}${doYear ? ', 1 yearly' : ''} — up to ${weeks.length + months.length + (doQuarter ? 1 : 0) + (doYear ? 1 : 0)} calls.`,
)
if (DRY) {
  console.log('\n--dry: nothing built. Drop --dry to run.')
  process.exit(0)
}

let calls = 0
async function run(label: string, fn: () => Promise<{ status: string; reason?: string }>): Promise<void> {
  try {
    const r = await fn()
    if (r.status === 'built') calls++
    console.log(`  ${label}  ${r.status === 'built' ? '✓' : `· ${r.reason ?? 'skipped'}`}`)
  } catch (e) {
    console.error(`  ${label}  ✗ ${errMsg(e)}`)
  }
}

console.log('\nWeeklies:')
for (const w of weeks) await run(`${w.start}…${w.end}`, () => buildWeekly(owner, w))
console.log('\nMonthlies:')
for (const m of months) await run(m.start.slice(0, 7), () => buildMonthly(owner, m))
if (doQuarter) {
  console.log('\nQuarterly:')
  await run(`${curQuarter.start}…${curQuarter.end}`, () => buildQuarterly(owner, curQuarter))
}
if (doYear) {
  console.log('\nYearly:')
  await run(curYear.start.slice(0, 4), () => buildYearly(owner, curYear))
}

console.log(`\nDone — ${calls} GPT call(s) made. Reload Looking Back.`)
