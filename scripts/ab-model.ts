/**
 * A/B a reflection model (e.g. gpt-5.4-nano vs gpt-5.4) CHEAPLY — runs the real
 * buildMonthly on a few recent months with each model and prints both outputs
 * side by side, then RESTORES your original rollups so nothing's polluted.
 *
 *   npx tsx scripts/ab-model.ts [email] [modelA] [modelB] [count]
 *   npx tsx scripts/ab-model.ts                       # nano vs gpt-5.4, 3 months
 *   npx tsx scripts/ab-model.ts me@x.com gpt-5.4-nano gpt-5.4 4
 *
 * Cost ≈ (count × 2) model calls — pennies. Judge the quality yourself; if the
 * richer model is clearly better, consider running it only for the higher
 * altitudes (quarter/year) where there are few periods and quality matters most.
 */
import { readFileSync } from 'node:fs'

function loadEnv() {
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
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    if (k && process.env[k] === undefined) process.env[k] = v
  }
}
loadEnv()

const email = process.argv[2] || 'phillipchan1@gmail.com'
// Comma-separated ladder of models to compare on the same months.
const models = (process.argv[3] || 'gpt-5.4-nano,gpt-5.4,gpt-5.5')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const count = Number(process.argv[4] || '2')

function monthPeriod(y: number, m0: number): { start: string; end: string } {
  const mm = String(m0 + 1).padStart(2, '0')
  const endDay = new Date(y, m0 + 1, 0).getDate()
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(endDay).padStart(2, '0')}` }
}

const { createClient } = await import('@supabase/supabase-js')
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const { data: u } = await sb.auth.admin.listUsers()
const owner = u.users.find((x) => x.email === email)?.id
if (!owner) {
  console.log(`No user for ${email}`)
  process.exit(0)
}

// Compare on the RICHEST months (most entries) — that's where model quality
// actually shows, not a thin recent test month.
const { data: rows } = await sb.from('entries').select('created_at').eq('owner', owner)
if (!rows?.length) {
  console.log('No entries.')
  process.exit(0)
}
const byMonth = new Map<string, number>()
for (const r of rows) {
  const key = (r.created_at as string).slice(0, 7) // YYYY-MM
  byMonth.set(key, (byMonth.get(key) ?? 0) + 1)
}
const periods = [...byMonth.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, count)
  .map(([ym, n]) => {
    const [yy, mm] = ym.split('-').map(Number)
    console.log(`  pick ${ym} (${n} entries)`)
    return monthPeriod(yy!, mm! - 1)
  })

const { buildMonthly } = await import('../api/_lib/synthesize.ts')

async function readMonthly(start: string) {
  const { data } = await sb
    .from('insights')
    .select('structured_payload,source_model')
    .eq('owner', owner)
    .eq('type', 'monthly')
    .eq('period_start', start)
    .maybeSingle()
  return data
}

async function restore(start: string, original: { structured_payload: unknown; source_model: string } | null) {
  if (original) {
    await sb
      .from('insights')
      .update({ structured_payload: original.structured_payload, source_model: original.source_model })
      .eq('owner', owner)
      .eq('type', 'monthly')
      .eq('period_start', start)
  } else {
    await sb.from('insights').delete().eq('owner', owner).eq('type', 'monthly').eq('period_start', start)
  }
}

console.log(`A/B for ${email}\n  models: ${models.join(', ')}\n  ${count} recent month(s)\n`)

for (const period of periods) {
  console.log(`\n========== ${period.start} .. ${period.end} ==========`)
  const original = await readMonthly(period.start) // capture to restore later
  try {
    for (const model of models) {
      process.env.OPENAI_MODEL = model
      const t0 = Date.now()
      const r = await buildMonthly(owner, period)
      const secs = ((Date.now() - t0) / 1000).toFixed(1)
      console.log(`\n----- ${model}  (${secs}s) -----`)
      if (r.status === 'skipped') {
        console.log(`(skipped: ${r.reason ?? 'no content'})`)
        continue
      }
      const out = await readMonthly(period.start)
      console.log(JSON.stringify(out?.structured_payload, null, 2))
    }
  } catch (e) {
    console.log(`ERROR: ${(e as Error)?.message ?? e}`)
  } finally {
    await restore(period.start, original as never)
  }
}

console.log('\nDone — your original rollups were restored.')
