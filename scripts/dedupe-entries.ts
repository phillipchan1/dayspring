// One-time cleanup for duplicate entry rows minted by the autosave torn-state
// bug (fixed June 2026 — see src/lib/saveSession.ts). The bug re-created an
// existing entry's body under a fresh id, so duplicates are exact copies or
// prefix-extensions of their twin, created the same day.
//
//   npx tsx scripts/dedupe-entries.ts            # dry run: list duplicate pairs
//   npx tsx scripts/dedupe-entries.ts --apply    # delete the lesser twin
//
// Conservative on purpose: only native entries, same owner, same calendar day,
// and one body must equal or strictly prefix the other (after whitespace
// normalization). Keeps the longer body (ties: the more recently updated row).
// Logs ids/dates/word counts only — never entry text.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

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

const APPLY = process.argv.includes('--apply')

const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

interface Row {
  id: string
  owner: string
  created_at: string
  updated_at: string
  body_markdown: string
  word_count: number
  source: string
}

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim()

async function fetchAll(): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += 1000) {
    // All sources: the bug minted NATIVE copies, but the surviving twin can be
    // an imported row. Only native rows are ever dropped (see below).
    const { data, error } = await sb
      .from('entries')
      .select('id, owner, created_at, updated_at, body_markdown, word_count, source')
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    out.push(...((data ?? []) as Row[]))
    if ((data ?? []).length < 1000) break
  }
  return out
}

const rows = await fetchAll()
console.log(`scanned ${rows.length} entries`)

// Group by owner + calendar day, then compare within groups.
const groups = new Map<string, Row[]>()
for (const r of rows) {
  const key = `${r.owner}:${r.created_at.slice(0, 10)}`
  const g = groups.get(key)
  if (g) g.push(r)
  else groups.set(key, [r])
}

/**
 * Of a duplicate pair, the one to delete — or null if neither is safely
 * droppable. Never drop an imported row (it wasn't minted by the bug, and
 * deleting it would also break the import's external_id dedup on re-import).
 * Prefer dropping the shorter body; ties → the older update.
 */
function lesserOf(a: Row, b: Row): Row | null {
  const aNative = a.source === 'native'
  const bNative = b.source === 'native'
  if (!aNative && !bNative) return null
  if (aNative !== bNative) return aNative ? a : b
  if (a.body_markdown.length !== b.body_markdown.length) {
    return a.body_markdown.length < b.body_markdown.length ? a : b
  }
  return a.updated_at <= b.updated_at ? a : b
}

const toDelete = new Map<string, { keep: Row; drop: Row }>()
for (const g of groups.values()) {
  for (let i = 0; i < g.length; i++) {
    for (let j = i + 1; j < g.length; j++) {
      const a = g[i]!
      const b = g[j]!
      if (toDelete.has(a.id) || toDelete.has(b.id)) continue
      const na = normalize(a.body_markdown)
      const nb = normalize(b.body_markdown)
      if (!na || !nb) continue
      const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na]
      // Require a real body so daily one-liner rituals can't false-positive.
      if (shorter.length < 12) continue
      if (!longer.startsWith(shorter)) continue
      const drop = lesserOf(a, b)
      if (!drop) continue
      const keep = drop === a ? b : a
      // Never drop the superset of an imported twin — content would be lost.
      if (keep.source !== 'native' && normalize(keep.body_markdown).length < normalize(drop.body_markdown).length) continue
      toDelete.set(drop.id, { keep, drop })
    }
  }
}

if (toDelete.size === 0) {
  console.log('no duplicate pairs found')
  process.exit(0)
}

for (const { keep, drop } of toDelete.values()) {
  console.log(
    `${drop.created_at.slice(0, 10)}  drop ${drop.id} (${drop.word_count}w, updated ${drop.updated_at})` +
      `  — twin of ${keep.id} (${keep.word_count}w)`,
  )
}

if (!APPLY) {
  console.log(`\ndry run: ${toDelete.size} duplicate(s) found. Re-run with --apply to delete.`)
  process.exit(0)
}

const ids = [...toDelete.keys()]
const { error } = await sb.from('entries').delete().in('id', ids)
if (error) {
  console.error('delete failed:', error.message)
  process.exit(1)
}
console.log(`deleted ${ids.length} duplicate entr${ids.length === 1 ? 'y' : 'ies'}`)
