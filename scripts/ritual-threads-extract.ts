// Ritual threads — does the archive hold enough to make a thread worth seeing?
//
//   npm run extract:rituals -- --owner phil@…
//   npm run extract:rituals -- --owner <uuid> --out prototypes/rituals/src/data/real.local.json
//
// The claim behind the prototype is that a ritual is the most STRUCTURED writing
// in the product — a named practice, a named movement, a date — and that nothing
// downstream reads any of it. This script tests the first half of that claim
// before anyone designs the second: it parses every ritual block out of the real
// archive and groups the answers by (practice, movement).
//
// It calls the real `parseRitualBlocks` from src/editor/practices/ritualPacing.ts
// on purpose. An extractor with its own regex would tell you about the regex.
//
// It READS the database and writes nothing back. Its only output is a JSON
// fixture and a printed summary.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

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
const outIdx = args.indexOf('--out')
const OUT = outIdx >= 0 ? args[outIdx + 1] : null

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { requireOwner } = await import('./_owner.ts')
const { parseRitualBlocks } = await import('../src/editor/practices/ritualPacing.ts')
const { PRACTICES } = await import('../src/editor/practices/practicesData.ts')

interface EntryRow {
  id: string
  created_at: string
  body_markdown: string | null
}

const owner = await requireOwner()
const sb = supabaseAdmin()

async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
  const out: T[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .eq('owner', owner)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

const rule = (label = ''): void => {
  const line = '-'.repeat(Math.max(0, 74 - label.length - (label ? 1 : 0)))
  console.log(label ? `\n${label} ${line}` : `\n${'-'.repeat(74)}`)
}

const entries = await fetchAll<EntryRow>('entries', 'id, created_at, body_markdown')
console.log(`\nArchive: ${entries.length} entries.`)

// -- parse -------------------------------------------------------------------

/** The question a movement asked, looked up live — exactly as both renderers do. */
const QUESTION = new Map<string, string>()
const key = (practice: string, label: string) => `${practice}||${label}`
for (const p of PRACTICES) {
  for (const prompt of p.prompts ?? []) {
    QUESTION.set(key(p.name, prompt.label), prompt.question ?? '')
  }
}

interface Answer {
  entryId: string
  at: string
  text: string
}

interface Movement {
  label: string
  question: string
  answers: Answer[]
}

interface Thread {
  practice: string
  walks: number
  firstAt: string
  lastAt: string
  movements: Movement[]
}

const threads = new Map<string, Thread>()
let blockCount = 0
let filledMovements = 0
let emptyMovements = 0
const walkDates = new Map<string, Set<string>>()

for (const e of entries) {
  const md = e.body_markdown ?? ''
  if (!md.includes(':name:')) continue
  const lines = md.split('\n')
  const blocks = parseRitualBlocks(lines)
  for (const b of blocks) {
    blockCount++
    let t = threads.get(b.name)
    if (!t) {
      t = { practice: b.name, walks: 0, firstAt: e.created_at, lastAt: e.created_at, movements: [] }
      threads.set(b.name, t)
      walkDates.set(b.name, new Set())
    }
    t.walks++
    if (e.created_at < t.firstAt) t.firstAt = e.created_at
    if (e.created_at > t.lastAt) t.lastAt = e.created_at
    walkDates.get(b.name)!.add(e.created_at.slice(0, 10))

    for (const m of b.movements) {
      let mv = t.movements.find((x) => x.label === m.label)
      if (!mv) {
        mv = { label: m.label, question: QUESTION.get(key(b.name, m.label)) ?? '', answers: [] }
        t.movements.push(mv)
      }
      const text = lines
        .slice(m.answerLine - 1, m.contentEnd)
        .join('\n')
        .trim()
      if (!text) {
        emptyMovements++
        continue
      }
      filledMovements++
      mv.answers.push({ entryId: e.id, at: e.created_at, text })
    }
  }
}

// -- report ------------------------------------------------------------------

rule('RITUALS IN THE ARCHIVE')
console.log(`Blocks found:         ${blockCount}`)
console.log(`Distinct practices:   ${threads.size}`)
console.log(`Movements answered:   ${filledMovements}`)
console.log(`Movements left empty: ${emptyMovements}`)

const sorted = [...threads.values()].sort((a, b) => b.walks - a.walks)

rule('BY PRACTICE')
for (const t of sorted) {
  const answered = t.movements.reduce((n, m) => n + m.answers.length, 0)
  const days = walkDates.get(t.practice)!.size
  console.log(
    `${String(t.walks).padStart(4)} walks  ${String(days).padStart(3)} days  ` +
      `${String(answered).padStart(4)} answers   ${t.practice}`,
  )
  for (const m of t.movements) {
    const q = m.question ? ` — "${m.question.slice(0, 50)}${m.question.length > 50 ? '…' : ''}"` : ''
    console.log(`        ${String(m.answers.length).padStart(4)}  ${m.label}${q}`)
  }
}

rule('THE TEST')
const deepest = sorted
  .flatMap((t) => t.movements.map((m) => ({ t, m })))
  .sort((a, b) => b.m.answers.length - a.m.answers.length)[0]
if (deepest && deepest.m.answers.length >= 3) {
  console.log(
    `Deepest thread: "${deepest.m.question || deepest.m.label}" — ` +
      `${deepest.m.answers.length} answers in ${deepest.t.practice}.\n`,
  )
  for (const a of deepest.m.answers.slice(-5)) {
    console.log(`  ${a.at.slice(0, 10)}  ${a.text.replace(/\s+/g, ' ').slice(0, 86)}`)
  }
} else {
  console.log('Not enough repeated movements yet to form a thread.')
}
console.log('')

if (OUT) {
  const payload = { generatedAt: new Date().toISOString(), entries: entries.length, threads: sorted }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(payload, null, 2))
  console.log(`Wrote ${OUT}\n`)
}
