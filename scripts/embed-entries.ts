// Fill entries.embedding where null — prerequisite for derive-threads.ts.
//
//   npx tsx scripts/embed-entries.ts --dry   # count unembedded, spend $0
//   npx tsx scripts/embed-entries.ts         # embed all nulls (idempotent)
//
// Runs locally with the service-role key. Re-running is safe — only null rows
// are touched. Logs counts only, never entry text.
//
// Cost: text-embedding-3-small = $0.02 / 1M tokens. Average entry ~800 tokens.
// 500 unembedded entries ≈ $0.008. If the Altar backfill already ran, most
// entries already have embeddings and this script does nothing.

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

const DRY = process.argv.slice(2).includes('--dry')
const REQUIRED = DRY
  ? ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'APP_OWNER_ID']
  : ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'APP_OWNER_ID']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { embed, toVectorLiteral } = await import('../api/_lib/embeddings.ts')

const owner = process.env.APP_OWNER_ID as string
const sb = supabaseAdmin()

// ── count total + unembedded ─────────────────────────────────────────────────

async function countEntries(nullOnly: boolean): Promise<number> {
  let q = sb.from('entries').select('id', { count: 'exact' }).eq('owner', owner).range(0, 0)
  if (nullOnly) q = q.is('embedding', null)
  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

const total = await countEntries(false)
const nullCount = await countEntries(true)

console.log(`Owner ${owner}`)
console.log(`  Total entries:      ${total}`)
console.log(`  Already embedded:   ${total - nullCount}`)
console.log(`  Need embedding:     ${nullCount}`)

if (nullCount === 0) {
  console.log('\nAll entries already have embeddings — nothing to do.')
  process.exit(0)
}

// Rough cost estimate (text-embedding-3-small, ~800 tokens / entry)
const estTokens = nullCount * 800
const estCost = (estTokens / 1_000_000) * 0.02
console.log(`\nEstimated cost: ~${nullCount} × 800 tokens = ${(estTokens / 1000).toFixed(0)}k tokens ≈ $${estCost.toFixed(4)}`)

if (DRY) {
  console.log('\n--dry: nothing written. Drop --dry to embed.')
  process.exit(0)
}

// ── embed in batches ─────────────────────────────────────────────────────────
// Small page size: reading embedding column is expensive; writing it back is
// the point here so we don't need to read it — only null rows lack it.

const PAGE = 100
let embedded = 0
let page = 0

process.stdout.write('\nEmbedding')

for (;;) {
  const { data, error } = await sb
    .from('entries')
    .select('id, body_markdown')
    .eq('owner', owner)
    .is('embedding', null)
    .order('created_at', { ascending: true })
    .range(page * PAGE, page * PAGE + PAGE - 1)

  if (error) throw error
  if (!data || data.length === 0) break

  const rows = data as { id: string; body_markdown: string }[]
  const vecs = await embed(rows.map((r) => r.body_markdown ?? ''))

  // Update one row at a time — bulk RPC requires the set_entry_embeddings
  // function to already exist; individual updates always work.
  const updates = rows.map((r, i) =>
    sb
      .from('entries')
      .update({ embedding: toVectorLiteral(vecs[i]!) })
      .eq('id', r.id)
      .eq('owner', owner),
  )
  await Promise.all(updates)

  embedded += rows.length
  process.stdout.write('.')
  if (rows.length < PAGE) break
  page++
}

console.log(`\n\nEmbedded ${embedded} / ${nullCount} entries.`)
console.log('Run derive-threads.ts --dry next to see clusters.')
