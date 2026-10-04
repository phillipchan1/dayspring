// How many photos do real entries hold, and how are they arranged?
//
//   npx tsx scripts/photo-set-census.ts
//   DOTENV=/path/to/.env npx tsx scripts/photo-set-census.ts   # from a worktree
//
// Read-only. Sizes the "photos, together" work: a *stack* is a run of photo
// lines with nothing but blank lines between them — what a multi-photo drop
// writes today, and what would become one set.
//
// Logs counts only — never entry text, ids or owners.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadDotEnv(): void {
  let raw = ''
  try {
    raw = readFileSync(process.env.DOTENV ?? '.env', 'utf8')
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

const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env: ${missing.join(', ')}`)
  process.exit(1)
}

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
})

const PHOTO_LINE = /^\s*!\[[^\]]*\]\(attachment:[a-f0-9]{64}\.[a-z0-9]+(?:\?size=[smf])?\)\s*$/
const PHOTO_REF = /!\[[^\]]*\]\(attachment:[a-f0-9]{64}\.[a-z0-9]+(?:\?size=[smf])?\)/g

/** Sizes of each run of photo lines separated only by blank lines. */
function stacks(body: string): number[] {
  const out: number[] = []
  let run = 0
  for (const line of body.split('\n')) {
    if (PHOTO_LINE.test(line)) run++
    else if (line.trim() !== '') {
      if (run) out.push(run)
      run = 0
    }
  }
  if (run) out.push(run)
  return out
}

function bucket(n: number): string {
  if (n <= 5) return String(n)
  if (n <= 8) return '6–8'
  if (n <= 12) return '9–12'
  if (n <= 20) return '13–20'
  return '21+'
}

function tally(values: number[]): string {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(bucket(v), (counts.get(bucket(v)) ?? 0) + 1)
  return ['1', '2', '3', '4', '5', '6–8', '9–12', '13–20', '21+']
    .filter((k) => counts.has(k))
    .map((k) => `${k}: ${counts.get(k)}`)
    .join('   ')
}

let entries = 0
const perEntry: number[] = []
const perStack: number[] = []
const owners = new Set<string>()

for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('entries')
    .select('owner, body_markdown')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(from, from + 999)
  if (error) throw error
  for (const row of data ?? []) {
    entries++
    const body = (row.body_markdown as string | null) ?? ''
    const refs = body.match(PHOTO_REF)?.length ?? 0
    if (refs === 0) continue
    perEntry.push(refs)
    owners.add(row.owner as string)
    perStack.push(...stacks(body))
  }
  if ((data ?? []).length < 1000) break
}

const multi = perStack.filter((n) => n >= 2)
console.log(`entries scanned:            ${entries}`)
console.log(`entries with a photo:       ${perEntry.length}  (${owners.size} writer${owners.size === 1 ? '' : 's'})`)
console.log(`entries with 2+ photos:     ${perEntry.filter((n) => n >= 2).length}`)
console.log(`photos in total:            ${perEntry.reduce((a, b) => a + b, 0)}`)
console.log(`\nphotos per entry            ${tally(perEntry)}`)
console.log(`photos per stack            ${tally(perStack)}`)
console.log(`\nstacks of 2+ (would be sets): ${multi.length}, largest ${multi.length ? Math.max(...multi) : 0}`)
