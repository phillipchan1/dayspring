import { readFileSync } from 'node:fs'

function loadDotEnv(): void {
  let raw = ''
  try { raw = readFileSync('.env', 'utf8') } catch { return }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (key && process.env[key] === undefined) process.env[key] = val
  }
}
loadDotEnv()

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const sb = supabaseAdmin()
const owner = process.env.APP_OWNER_ID as string

// Load all weekly rollups
const PAGE = 500
const rows: { period_start: string; structured_payload: { topics?: { label: string }[] } }[] = []
for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb
    .from('insights')
    .select('period_start, structured_payload')
    .eq('owner', owner)
    .eq('type', 'weekly')
    .order('period_start', { ascending: false })
    .range(from, from + PAGE - 1)
  if (error) throw error
  if (!data || data.length === 0) break
  rows.push(...(data as typeof rows))
  if (data.length < PAGE) break
}

console.log(`Loaded ${rows.length} weekly rollups.\n`)

// Search for frontier / dayspring in the full payload JSON
const exactMatches = rows.filter(r =>
  JSON.stringify(r.structured_payload).toLowerCase().includes('frontier') ||
  JSON.stringify(r.structured_payload).toLowerCase().includes('dayspring'),
)
console.log(`${exactMatches.length} rollups mention "frontier" or "dayspring"`)
for (const r of exactMatches.slice(0, 6)) {
  const topics = r.structured_payload?.topics?.map((t) => t.label) ?? []
  console.log(`  ${r.period_start}  topics: ${topics.join(' | ')}`)
}

// Count all topic labels matching work/build/product/app themes
console.log('\nLabels matching work/build/app/product/launch/startup:')
const labelFreq = new Map<string, number>()
for (const r of rows) {
  for (const t of r.structured_payload?.topics ?? []) {
    if (/frontier|dayspring|app|build|startup|product|launch|tech|software|company/i.test(t.label)) {
      labelFreq.set(t.label, (labelFreq.get(t.label) ?? 0) + 1)
    }
  }
}
const sorted = [...labelFreq.entries()].sort((a, b) => b[1] - a[1])
if (sorted.length === 0) {
  console.log('  (none found — trying broader search)')
} else {
  for (const [label, count] of sorted.slice(0, 20)) {
    console.log(`  ${count}x  "${label}"`)
  }
}

// Broader: show all topic labels with ≥5 occurrences that contain "work" or "calling"
console.log('\nAll labels with "work" or "calling" (≥3 occurrences):')
const broadFreq = new Map<string, number>()
for (const r of rows) {
  for (const t of r.structured_payload?.topics ?? []) {
    if (/work|calling|vocation|ministry|mission|purpose|career/i.test(t.label)) {
      broadFreq.set(t.label, (broadFreq.get(t.label) ?? 0) + 1)
    }
  }
}
const broadSorted = [...broadFreq.entries()].sort((a, b) => b[1] - a[1]).filter(([, c]) => c >= 3)
for (const [label, count] of broadSorted.slice(0, 20)) {
  console.log(`  ${count}x  "${label}"`)
}
