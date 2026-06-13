// One-time backfill: scan every entry, parse its scripture references, and
// populate scripture_refs. The Scripture surface ("Where your heart has been
// leaning") reads the result — so this is what lights the canon map from years
// of existing history.
//
//   npx tsx scripts/backfill-scripture.ts --dry        # count only, write nothing
//   npx tsx scripts/backfill-scripture.ts              # parse + upsert all entries
//   npx tsx scripts/backfill-scripture.ts 2023-01-01   # restrict to this date on
//
// Idempotent: upserts on the (entry_id, osis_ref) unique index, so re-runs never
// duplicate. Runs LOCALLY with the service-role key (bypasses RLS → sets `owner`
// explicitly). Never modifies any entry's text; logs counts only.

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
const fromArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  console.error('Add them (see .env.example) and re-run.')
  process.exit(1)
}

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { parseReferences } = await import('../src/lib/scripture/parse.ts')

const { requireOwner } = await import('./_owner.ts')
const owner = await requireOwner()

interface EntryRow {
  id: string
  created_at: string
  body_markdown: string
}

interface RefRow {
  owner: string
  entry_id: string
  book_osis: string
  book_name: string
  book_order: number
  chapter: number
  verse_start: number | null
  verse_end: number | null
  osis_ref: string
  entry_created_at: string
  source: 'parsed'
  confidence: number
  status: 'confirmed'
  char_start: number | null
  char_end: number | null
}

function errMsg(e: unknown): string {
  const pg = e as { message?: string } | null
  return pg?.message ?? (e instanceof Error ? e.message : String(e))
}

async function main(): Promise<void> {
  const sb = supabaseAdmin()
  const lowerBound = fromArg ?? '0000-00-00'

  // Page past PostgREST's 1000-row cap.
  const entries: EntryRow[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('entries')
      .select('id, created_at, body_markdown')
      .eq('owner', owner)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    for (const r of data as EntryRow[]) {
      if (r.created_at.slice(0, 10) >= lowerBound) entries.push(r)
    }
    if (data.length < PAGE) break
  }

  if (entries.length === 0) {
    console.log(`No entries${fromArg ? ` on/after ${fromArg}` : ''} for this owner — nothing to backfill.`)
    return
  }

  // Parse → rows. Dedup within an entry by osis_ref (the unique-index key), else
  // an in-batch upsert would touch the same conflict row twice.
  const rows: RefRow[] = []
  const booksTouched = new Set<string>()
  const versesTouched = new Set<string>()
  let entriesWithRefs = 0
  let lowConfidence = 0

  for (const e of entries) {
    const refs = parseReferences(e.body_markdown)
    if (refs.length === 0) continue
    const seen = new Set<string>()
    let added = 0
    for (const r of refs) {
      if (seen.has(r.osis_ref)) continue
      seen.add(r.osis_ref)
      if (r.confidence < 1) lowConfidence++
      booksTouched.add(r.book_osis)
      versesTouched.add(r.osis_ref)
      added++
      rows.push({
        owner,
        entry_id: e.id,
        book_osis: r.book_osis,
        book_name: r.book_name,
        book_order: r.book_order,
        chapter: r.chapter,
        verse_start: r.verse_start,
        verse_end: r.verse_end,
        osis_ref: r.osis_ref,
        entry_created_at: e.created_at,
        source: 'parsed',
        confidence: r.confidence,
        status: 'confirmed',
        char_start: r.char_start,
        char_end: r.char_end,
      })
    }
    if (added > 0) entriesWithRefs++
  }

  console.log(
    `Owner ${owner}\n` +
      `  entries scanned:     ${entries.length}` +
      `${fromArg ? ` (on/after ${fromArg})` : ''}\n` +
      `  entries with refs:   ${entriesWithRefs}\n` +
      `  references found:    ${rows.length}\n` +
      `  distinct verses:     ${versesTouched.size}\n` +
      `  books touched:       ${booksTouched.size} / 66\n` +
      `  low-confidence:      ${lowConfidence} (clamped out-of-range; review)`,
  )

  if (DRY) {
    console.log('\n--dry: nothing written. Drop --dry to upsert.')
    return
  }
  if (rows.length === 0) {
    console.log('\nNo references parsed — nothing to write.')
    return
  }

  // Upsert in chunks on the (entry_id, osis_ref) unique index.
  const CHUNK = 500
  let written = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await sb
      .from('scripture_refs')
      .upsert(chunk, { onConflict: 'entry_id,osis_ref' })
    if (error) throw error
    written += chunk.length
    console.log(`  upserted ${written}/${rows.length}`)
  }

  console.log(`\nDone. ${written} references upserted across ${booksTouched.size} books. Open Scripture to see the map.`)
}

main().catch((e) => {
  console.error('Scripture backfill failed:', errMsg(e))
  process.exit(1)
})
