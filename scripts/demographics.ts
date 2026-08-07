/**
 * Who is actually using Dayspring — an aggregate report, printed and thrown away.
 *
 *   npx tsx scripts/demographics.ts                # everyone
 *   npx tsx scripts/demographics.ts --active 30    # seen in the last 30 days
 *   npx tsx scripts/demographics.ts --no-names     # skip the name inference
 *   npx tsx scripts/demographics.ts --json         # machine-readable
 *
 * Two halves.
 *
 * OBSERVED — platform, device shape, country, timezone, locale, signup provider,
 * onboarding fork. Read straight off `profiles`, where /api/profile/ensure
 * stamps them on every app open. These are facts.
 *
 * INFERRED — the age and gender *distribution* of the user base, estimated from
 * first names against the SSA national names dataset (public domain; name x
 * birth year x sex x count, 1880-present). These are not facts, and the
 * distinction is the whole design of this script:
 *
 *   - It runs offline and writes NOTHING back. There is no gender column and
 *     there is no age column, on purpose. A guess stored in a row stops looking
 *     like a guess to the next query that reads it, and the one place that must
 *     never happen is a spiritual journal, where being confidently misgendered
 *     by the app is a real harm and the upside is a slightly nicer chart.
 *   - It reports distributions, never individuals. No name, email, or user id
 *     is printed by any code path here.
 *   - It sums probabilities rather than hard-labelling each user. "Expected
 *     female count" across 300 users is a defensible estimate because the errors
 *     are roughly unbiased and average out. The same arithmetic applied to one
 *     user is noise wearing a number's clothes.
 *
 * Read the CAVEATS block the report prints. The estimates are US-shaped and the
 * confidence intervals are wide below a few hundred users.
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env (service role, so
 * it bypasses RLS — this is the one read that legitimately spans all tenants).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import {
  AGE_BANDS,
  MIN_BIRTH_YEAR,
  ageMixture,
  firstName,
  ingestSsaYear,
  maxBirthYear,
  pFemale,
  type NameStats,
} from './nameInference.ts'

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

// ── flags ───────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const asJson = argv.includes('--json')
const skipNames = argv.includes('--no-names')
const activeIdx = argv.indexOf('--active')
const activeDays =
  activeIdx >= 0 && argv[activeIdx + 1] ? Number(argv[activeIdx + 1]) : null

// ── the shape of a profile row we care about ────────────────────────────────

interface ProfileRow {
  owner: string
  platform: string | null
  platforms: string[] | null
  form_factor: string | null
  timezone: string | null
  locale: string | null
  country: string | null
  signup_provider: string | null
  onboarding_path: string | null
  plan: string | null
  created_at: string | null
  last_seen_at: string | null
}

// ── counting helpers ────────────────────────────────────────────────────────

type Counter = Map<string, number>

function bump(c: Counter, key: string, by = 1): void {
  c.set(key, (c.get(key) ?? 0) + by)
}

/** Sorted descending, with everything past `top` folded into one row. */
function ranked(c: Counter, top = Infinity): Array<[string, number]> {
  const rows = [...c.entries()].sort((a, b) => b[1] - a[1])
  if (rows.length <= top) return rows
  const head = rows.slice(0, top)
  const tail = rows.slice(top).reduce((n, [, v]) => n + v, 0)
  return [...head, [`(${rows.length - top} more)`, tail]]
}

function pct(n: number, total: number): string {
  return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—'
}

// ── SSA names dataset ───────────────────────────────────────────────────────

const SSA_URL = 'https://www.ssa.gov/oact/babynames/names.zip'
const CACHE_DIR = '.cache'
const CACHE_FILE = `${CACHE_DIR}/ssa-names.zip`

const THIS_YEAR = new Date().getFullYear()
// Trimming the tails keeps the age mixture from being dragged by Victorian-era
// name records that no living user can belong to.
const MAX_BIRTH_YEAR = maxBirthYear(THIS_YEAR)

async function loadSsaNames(): Promise<Map<string, NameStats> | null> {
  let zipped: Buffer
  try {
    if (existsSync(CACHE_FILE)) {
      zipped = readFileSync(CACHE_FILE)
    } else {
      process.stderr.write(`Fetching SSA names dataset (~10MB, cached to ${CACHE_FILE})…\n`)
      const res = await fetch(SSA_URL)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      zipped = Buffer.from(await res.arrayBuffer())
      mkdirSync(CACHE_DIR, { recursive: true })
      writeFileSync(CACHE_FILE, zipped)
    }
  } catch (err) {
    process.stderr.write(
      `Could not load the SSA dataset (${(err as Error).message}). ` +
        `Skipping name inference; the observed sections below are unaffected.\n`,
    )
    return null
  }

  const zip = await JSZip.loadAsync(zipped)
  const names = new Map<string, NameStats>()

  for (const path of Object.keys(zip.files)) {
    const match = /^yob(\d{4})\.txt$/.exec(path)
    if (!match) continue
    const year = Number(match[1])
    if (year < MIN_BIRTH_YEAR || year > MAX_BIRTH_YEAR) continue
    ingestSsaYear(names, year, await zip.files[path]!.async('string'))
  }
  return names
}

// ── main ────────────────────────────────────────────────────────────────────

const sb = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
)

const { data: allProfiles, error } = await sb
  .from('profiles')
  .select(
    'owner, platform, platforms, form_factor, timezone, locale, country, signup_provider, onboarding_path, plan, created_at, last_seen_at',
  )
if (error) throw error

let profiles = (allProfiles ?? []) as ProfileRow[]
const totalAccounts = profiles.length

if (activeDays !== null && Number.isFinite(activeDays)) {
  const cutoff = Date.now() - activeDays * 86_400_000
  profiles = profiles.filter(
    (p) => p.last_seen_at !== null && Date.parse(p.last_seen_at) >= cutoff,
  )
}

const n = profiles.length

// ── observed distributions ──────────────────────────────────────────────────

const platform: Counter = new Map()
const formFactor: Counter = new Map()
const country: Counter = new Map()
const macroRegion: Counter = new Map()
const timezone: Counter = new Map()
const language: Counter = new Map()
const provider: Counter = new Map()
const onboarding: Counter = new Map()
// onboarding path → plan → count, i.e. the D-002 conversion question
const pathToPlan = new Map<string, Counter>()
let multiPlatform = 0

for (const p of profiles) {
  bump(platform, p.platform ?? '(unknown)')
  bump(formFactor, p.form_factor ?? '(unknown)')
  bump(country, p.country ?? '(unknown)')
  bump(timezone, p.timezone ?? '(unknown)')
  bump(provider, p.signup_provider ?? '(unknown)')
  bump(language, p.locale ? (p.locale.split('-')[0] ?? p.locale) : '(unknown)')
  if ((p.platforms?.length ?? 0) > 1) multiPlatform += 1

  // Macro region: the IANA prefix is the honest granularity here, refined to
  // US/Canada where the edge gave us an exact country code.
  if (p.country === 'US' || p.country === 'CA') {
    bump(macroRegion, p.country === 'US' ? 'United States' : 'Canada')
  } else if (p.timezone) {
    const prefix = p.timezone.split('/')[0] ?? p.timezone
    bump(macroRegion, prefix === 'America' ? 'Americas (other)' : prefix)
  } else {
    bump(macroRegion, '(unknown)')
  }

  const path = p.onboarding_path ?? '(unknown)'
  bump(onboarding, path)
  let plans = pathToPlan.get(path)
  if (!plans) {
    plans = new Map()
    pathToPlan.set(path, plans)
  }
  bump(plans, p.plan ?? 'none')
}

// ── inferred distributions ──────────────────────────────────────────────────

interface Inference {
  namesMatched: number
  namesTotal: number
  expectedFemale: number
  expectedMale: number
  confidentFemale: number
  confidentMale: number
  ambiguous: number
  ageBands: Counter
  meanAge: number | null
}

let inference: Inference | null = null

if (!skipNames) {
  const ssa = await loadSsaNames()
  if (ssa) {
    // Names live only in auth.users, and only for providers that hand one over
    // — Apple's "Hide My Email" accounts often have none. Coverage is reported.
    const users: Array<{ full: string | undefined }> = []
    for (let page = 1; page <= 20; page++) {
      const { data, error: usersError } = await sb.auth.admin.listUsers({
        page,
        perPage: 1000,
      })
      if (usersError) throw usersError
      for (const u of data.users) {
        const meta = u.user_metadata as Record<string, unknown> | undefined
        const full =
          (typeof meta?.full_name === 'string' && meta.full_name) ||
          (typeof meta?.name === 'string' && meta.name) ||
          undefined
        users.push({ full })
      }
      if (data.users.length < 1000) break
    }

    const bands: Counter = new Map()
    let matched = 0
    let expectedFemale = 0
    let expectedMale = 0
    let confidentFemale = 0
    let confidentMale = 0
    let ambiguous = 0
    let ageWeight = 0
    let ageSum = 0

    for (const u of users) {
      const first = firstName(u.full)
      if (!first) continue
      const stats = ssa.get(first)
      const p = pFemale(stats)
      if (stats === undefined || p === null) continue
      matched += 1

      // Gender as a probability, summed. Never collapsed to a label per person.
      expectedFemale += p
      expectedMale += 1 - p
      if (p >= 0.85) confidentFemale += 1
      else if (p <= 0.15) confidentMale += 1
      else ambiguous += 1

      // Age as a mixture: this user contributes their name's whole birth-year
      // distribution, not a single point estimate. Summed across everyone, that
      // is the population's age distribution.
      for (const { band, weight, age } of ageMixture(stats, THIS_YEAR)) {
        bump(bands, band, weight)
        ageSum += age * weight
        ageWeight += weight
      }
    }

    inference = {
      namesMatched: matched,
      namesTotal: users.length,
      expectedFemale,
      expectedMale,
      confidentFemale,
      confidentMale,
      ambiguous,
      ageBands: bands,
      meanAge: ageWeight > 0 ? ageSum / ageWeight : null,
    }
  }
}

// ── output ──────────────────────────────────────────────────────────────────

if (asJson) {
  console.log(
    JSON.stringify(
      {
        total_accounts: totalAccounts,
        in_scope: n,
        active_days: activeDays,
        observed: {
          platform: Object.fromEntries(ranked(platform)),
          form_factor: Object.fromEntries(ranked(formFactor)),
          multi_platform: multiPlatform,
          country: Object.fromEntries(ranked(country)),
          macro_region: Object.fromEntries(ranked(macroRegion)),
          timezone: Object.fromEntries(ranked(timezone, 20)),
          language: Object.fromEntries(ranked(language)),
          signup_provider: Object.fromEntries(ranked(provider)),
          onboarding_path: Object.fromEntries(ranked(onboarding)),
          plan_by_onboarding_path: Object.fromEntries(
            [...pathToPlan].map(([k, v]) => [k, Object.fromEntries(ranked(v))]),
          ),
        },
        inferred: inference && {
          coverage: `${inference.namesMatched}/${inference.namesTotal}`,
          expected_female: Number(inference.expectedFemale.toFixed(1)),
          expected_male: Number(inference.expectedMale.toFixed(1)),
          confident_female: inference.confidentFemale,
          confident_male: inference.confidentMale,
          ambiguous: inference.ambiguous,
          age_bands: Object.fromEntries(
            ranked(inference.ageBands).map(([k, v]) => [k, Number(v.toFixed(1))]),
          ),
          mean_age: inference.meanAge ? Number(inference.meanAge.toFixed(1)) : null,
        },
      },
      null,
      2,
    ),
  )
} else {
  const section = (title: string) => console.log(`\n${title}\n${'─'.repeat(title.length)}`)
  const table = (c: Counter, total: number, top = Infinity) => {
    for (const [key, count] of ranked(c, top)) {
      const bar = '█'.repeat(Math.round((count / Math.max(total, 1)) * 28))
      console.log(
        `  ${key.padEnd(22)} ${String(Math.round(count)).padStart(5)}  ${pct(count, total).padStart(6)}  ${bar}`,
      )
    }
  }

  console.log(`\nDayspring — who is using this`)
  console.log(
    `${n} account${n === 1 ? '' : 's'}` +
      (activeDays !== null ? ` seen in the last ${activeDays}d (of ${totalAccounts} total)` : ''),
  )

  section('Device shape')
  table(formFactor, n)
  console.log(`\n  ${multiPlatform} account(s) use more than one platform.`)

  section('Platform')
  table(platform, n)

  section('Region')
  table(macroRegion, n)

  section('Country')
  table(country, n, 15)

  section('Timezone')
  table(timezone, n, 12)

  section('Language')
  table(language, n, 10)

  section('Signed up with')
  table(provider, n)

  section('Onboarding fork  (D-003)')
  table(onboarding, n)

  section('Plan by onboarding fork  (D-002: is fresh-start viable?)')
  for (const [path, plans] of pathToPlan) {
    const pathTotal = [...plans.values()].reduce((a, b) => a + b, 0)
    console.log(`\n  ${path}  (n=${pathTotal})`)
    for (const [plan, count] of ranked(plans)) {
      console.log(`    ${plan.padEnd(20)} ${String(count).padStart(4)}  ${pct(count, pathTotal)}`)
    }
  }

  if (inference) {
    const m = inference.namesMatched
    section('Gender — ESTIMATED from first names')
    console.log(
      `  coverage: ${m}/${inference.namesTotal} accounts had a name the dataset knows`,
    )
    if (m > 0) {
      console.log(`  expected female     ${inference.expectedFemale.toFixed(1)}  ${pct(inference.expectedFemale, m)}`)
      console.log(`  expected male       ${inference.expectedMale.toFixed(1)}  ${pct(inference.expectedMale, m)}`)
      console.log(
        `  (of those: ${inference.confidentFemale} clearly female-coded, ` +
          `${inference.confidentMale} clearly male-coded, ${inference.ambiguous} genuinely ambiguous)`,
      )
    }

    section('Age — ESTIMATED from first names')
    if (m > 0) {
      const bandTotal = [...inference.ageBands.values()].reduce((a, b) => a + b, 0)
      for (const [label] of AGE_BANDS) {
        const v = inference.ageBands.get(label) ?? 0
        const bar = '█'.repeat(Math.round((v / Math.max(bandTotal, 1)) * 28))
        console.log(
          `  ${label.padEnd(22)} ${v.toFixed(1).padStart(6)}  ${pct(v, bandTotal).padStart(6)}  ${bar}`,
        )
      }
      console.log(`\n  mean estimated age: ${inference.meanAge?.toFixed(1) ?? '—'}`)
    }

    console.log(`
CAVEATS — the two sections above are estimates, not measurements
────────────────────────────────────────────────────────────────
  · The dataset is US birth records. Non-US names mostly fail to match and
    drop out of the denominator entirely, so these distributions describe the
    US-named share of the base, not the base.
  · Births are not the living population. No mortality or immigration
    adjustment is applied, which biases the age estimate young.
  · Unisex names are averaged, not resolved. A base full of Jordans and
    Taylors will look closer to 50/50 than it really is.
  · Below roughly 100 matched names, treat the bands as directional only.
  · Per-person these numbers are meaningless. They are only valid in
    aggregate, which is why nothing here is written back to the database.`)
  } else if (!skipNames) {
    console.log('\n(name inference unavailable — see the message above)')
  }

  console.log()
}
