// One-time historical backfill for Reflections (then cheap incremental top-ups).
//
//   npx tsx scripts/backfill.ts --dry        # PLAN ONLY: count GPT calls, spend $0
//   npx tsx scripts/backfill.ts              # build only periods missing a rollup
//   npx tsx scripts/backfill.ts --force      # rebuild every period (re-bills GPT)
//   npx tsx scripts/backfill.ts 2025-01-01   # restrict to entries from this date on
//
// Runs LOCALLY (no Vercel serverless timeout): talks straight to Supabase with
// the service-role key + OpenAI. Builds every non-empty Mon–Sun weekly first,
// then every monthly (monthly reads the weeklies). Idempotent in DATA *and*
// COST — by default it skips periods that already have a rollup, so re-running
// only fills gaps. Logs counts only, never entry text (§8).

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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (key && process.env[key] === undefined) process.env[key] = val
  }
}
loadDotEnv()

// --dry only reads entries + existing insights, so it doesn't need OpenAI.
const args = process.argv.slice(2)
const DRY = args.includes('--dry')
const FORCE = args.includes('--force')
// --recent: just the last COMPLETED week + last completed month (what the cron
// does), instead of scanning all history.
const RECENT = args.includes('--recent')
const fromArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
// --concurrency N: run N weekly/monthly builds in parallel (default 1 = serial).
// Weeklies are fully independent; monthlies are independent of other months.
// Safe values: 8–12. Higher risks OpenAI rate-limit 429s.
const concurrencyIdx = args.findIndex((a) => a === '--concurrency' || a.startsWith('--concurrency='))
const CONCURRENCY = concurrencyIdx >= 0
  ? Math.max(1, parseInt(
      args[concurrencyIdx]!.includes('=')
        ? args[concurrencyIdx]!.split('=')[1]!
        : (args[concurrencyIdx + 1] ?? '1'),
      10,
    ))
  : 1

const REQUIRED =
  RECENT && DRY
    ? [] // pure date math — no DB/OpenAI needed
    : DRY
      ? ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
      : ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  console.error('Add them (see .env.example) and re-run.')
  process.exit(1)
}

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { buildWeekly, buildMonthly } = await import('../api/_lib/synthesize.ts')
const { mondayOf, addDays, toDateStr, previousWeek, previousMonth, weeksOverlappingMonth } =
  await import('../api/_lib/dates.ts')

const { requireOwner } = await import('./_owner.ts')
const owner = await requireOwner()

interface Period {
  start: string
  end: string
}

async function runRecent(): Promise<void> {
  // Mirror the cron: last completed week + last completed month (its weeklies
  // built first so the monthly has something to read).
  const now = new Date()
  const week = previousWeek(now)
  const month = previousMonth(now)
  const monthWeeks = weeksOverlappingMonth(month)

  console.log(`Last completed week:  ${week.start}…${week.end}`)
  console.log(`Last completed month: ${month.start.slice(0, 7)} (${month.start}…${month.end})`)
  console.log(`  ↳ its weeks: ${monthWeeks.map((w) => w.start).join(', ')}`)

  if (DRY) {
    console.log(`\n--dry: would make up to ${1 + monthWeeks.length + 1} GPT calls (empty weeks skip). Nothing written.`)
    return
  }

  // Dedup the standalone last-week against the month's weeks.
  const weekly = [week, ...monthWeeks.filter((w) => w.start !== week.start)]
  console.log(`\nBuilding weeklies…`)
  for (const w of weekly) {
    try {
      const r = await buildWeekly(owner, w)
      console.log(`  ${w.start}…${w.end}  ${r.status === 'built' ? `✓ ${r.quotes} quotes` : '· empty'}`)
    } catch (err) {
      console.error(`  ${w.start}…${w.end}  ✗ ${errMsg(err)}`)
    }
  }
  console.log(`\nBuilding monthly ${month.start.slice(0, 7)}…`)
  try {
    const r = await buildMonthly(owner, month)
    console.log(`  ${r.status === 'built' ? `✓ ${r.quotes} quotes, ${r.topics} topics` : '· no weeklies'}`)
  } catch (err) {
    console.error(`  ✗ ${errMsg(err)}`)
  }
  console.log('\nDone. Reload Reflections.')
}

async function main(): Promise<void> {
  if (RECENT) return runRecent()

  const sb = supabaseAdmin()

  // All entry dates (paginated past PostgREST's 1000-row cap).
  const dates: string[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('entries')
      .select('created_at')
      .eq('owner', owner)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data as { created_at: string }[]) dates.push(r.created_at)
    if (data.length < PAGE) break
  }

  if (dates.length === 0) {
    console.log('No entries found for this owner — nothing to backfill.')
    return
  }

  const lowerBound = fromArg ? `${fromArg}` : '0000-00-00'
  const inRange = dates.filter((d) => d.slice(0, 10) >= lowerBound)
  if (inRange.length === 0) {
    console.log(`No entries on/after ${lowerBound}.`)
    return
  }

  // Which weeks / months actually contain an entry.
  const weekStarts = new Set<string>()
  const monthStarts = new Set<string>()
  for (const iso of inRange) {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
    weekStarts.add(toDateStr(mondayOf(d)))
    monthStarts.add(`${iso.slice(0, 7)}-01`)
  }

  // What's already built (so we don't re-bill GPT).
  const builtWeeks = await existingPeriods(sb, 'weekly')
  const builtMonths = await existingPeriods(sb, 'monthly')

  const weeksToBuild = [...weekStarts].sort().filter((w) => FORCE || !builtWeeks.has(w))
  const monthsToBuild = [...monthStarts].sort().filter((m) => FORCE || !builtMonths.has(m))

  console.log(
    `Owner ${owner} — ${inRange.length} entries, ` +
      `${toDateStr(new Date(`${inRange[0]!.slice(0, 10)}T00:00:00Z`))} → ` +
      `${inRange[inRange.length - 1]!.slice(0, 10)}` +
      `${process.env.OPENAI_MODEL ? `  (model: ${process.env.OPENAI_MODEL})` : ''}`,
  )
  console.log(`\nPlan (each = one GPT call):`)
  console.log(`  Weeklies: ${weekStarts.size} non-empty · ${builtWeeks.size} already built · ${weeksToBuild.length} to build`)
  console.log(`  Monthlies: ${monthStarts.size} with entries · ${builtMonths.size} already built · ${monthsToBuild.length} to build`)
  console.log(`  → ${weeksToBuild.length + monthsToBuild.length} GPT calls total${FORCE ? ' (--force: rebuilding all)' : ''}`)

  if (DRY) {
    console.log('\n--dry: no GPT calls made, nothing written. Drop --dry to run.')
    return
  }
  if (weeksToBuild.length + monthsToBuild.length === 0) {
    console.log('\nNothing to build — every period already has a rollup. (Use --force to rebuild.)')
    return
  }

  // ── 1. Weeklies first (monthly reads them) ──────────────────────────────────
  console.log(`\nStep 1/2 — building ${weeksToBuild.length} weeklies… (concurrency=${CONCURRENCY})`)
  let wBuilt = 0
  let wDone = 0
  await runConcurrent(weeksToBuild, CONCURRENCY, async (start) => {
    const period = weekPeriod(start)
    const idx = ++wDone
    try {
      const r = await buildWeekly(owner, period)
      if (r.status === 'built') wBuilt++
      console.log(
        `  [${idx}/${weeksToBuild.length}] ${period.start}…${period.end}  ` +
          (r.status === 'built' ? `✓ ${r.quotes} quotes, ${r.topics} topics${r.observation ? ', note' : ''}` : '· empty'),
      )
    } catch (err) {
      console.error(`  [${idx}/${weeksToBuild.length}] ${period.start}…${period.end}  ✗ ${errMsg(err)}`)
    }
  })
  console.log(`Weeklies built: ${wBuilt}.`)

  // ── 2. Monthlies ────────────────────────────────────────────────────────────
  console.log(`\nStep 2/2 — building ${monthsToBuild.length} monthlies… (concurrency=${CONCURRENCY})`)
  let mBuilt = 0
  let mDone = 0
  await runConcurrent(monthsToBuild, CONCURRENCY, async (start) => {
    const period = monthPeriod(start)
    const idx = ++mDone
    try {
      const r = await buildMonthly(owner, period)
      if (r.status === 'built') mBuilt++
      console.log(
        `  [${idx}/${monthsToBuild.length}] ${period.start.slice(0, 7)}  ` +
          (r.status === 'built' ? `✓ ${r.quotes} quotes, ${r.topics} topics` : '· no weeklies'),
      )
    } catch (err) {
      console.error(`  [${idx}/${monthsToBuild.length}] ${period.start.slice(0, 7)}  ✗ ${errMsg(err)}`)
    }
  })
  console.log(`Monthlies built: ${mBuilt}.`)
  console.log('\nDone. Reload Reflections and use the period switcher.')
}

async function existingPeriods(
  sb: Awaited<ReturnType<typeof supabaseAdmin>>,
  type: 'weekly' | 'monthly',
): Promise<Set<string>> {
  const { data, error } = await sb
    .from('insights')
    .select('period_start')
    .eq('owner', owner)
    .eq('type', type)
  if (error) throw error
  return new Set((data ?? []).map((r: { period_start: string }) => r.period_start))
}

function weekPeriod(start: string): Period {
  const d = new Date(`${start}T00:00:00Z`)
  return { start, end: toDateStr(addDays(d, 6)) }
}

function monthPeriod(start: string): Period {
  const d = new Date(`${start}T00:00:00Z`)
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
  return { start, end: toDateStr(end) }
}

function errMsg(e: unknown): string {
  const pg = e as { message?: string } | null
  return pg?.message ?? (e instanceof Error ? e.message : String(e))
}

/** Run `fn` over every item in `items` with at most `concurrency` in-flight at once. */
async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (concurrency <= 1) {
    for (const item of items) await fn(item)
    return
  }
  // Slot-based: keep exactly `concurrency` promises live until the queue drains.
  const queue = [...items]
  const active = new Set<Promise<void>>()
  while (queue.length > 0 || active.size > 0) {
    while (active.size < concurrency && queue.length > 0) {
      const item = queue.shift()!
      const p = fn(item).finally(() => active.delete(p))
      active.add(p)
    }
    if (active.size > 0) await Promise.race(active)
  }
}

main().catch((e) => {
  console.error('Backfill failed:', errMsg(e))
  process.exit(1)
})
