// Taste and see: run the join judge over a sample of REAL pairings.
//
//   npx tsx --tsconfig tsconfig.app.json scripts/judge-sample.ts --owner <email>
//   … --n 60          how many pairs (default 40)
//   … --subject esther  restrict to one subject
//
// READ-ONLY. Nothing is written; no verdict is stored. The point is to look at
// what the model does to your own writing before deciding whether it should
// ever run unattended.
//
// It samples ACROSS DISTANCES on purpose, because the number that decides the
// economics is whether distance 0 needs judging at all. If a marking on the
// same line as its subject is essentially always about it, that is half the
// archive that never needs a model call.

import { readFileSync } from 'node:fs'
import type { JoinCandidate } from '../api/_lib/judge.ts'

function loadDotEnv(): void {
  let raw = ''
  try { raw = readFileSync('.env', 'utf8') } catch { return }
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if (/^["'].*["']$/.test(v)) v = v.slice(1, -1)
    if (k && process.env[k] === undefined) process.env[k] = v
  }
}
loadDotEnv()

const args = process.argv.slice(2)
const nArg = args.find((a) => a.startsWith('--n='))
const subjArg = args.find((a) => a.startsWith('--subject='))
const N = nArg ? Number(nArg.slice(4)) : 40
const ONLY = subjArg ? subjArg.slice('--subject='.length).toLowerCase() : null

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { requireOwner } = await import('./_owner.ts')
const { judgeCandidates } = await import('../api/_lib/judgeRun.ts')
const { contextAround } = await import('../api/_lib/judge.ts')
const { lineAt, mentionLines, termsMatcher } = await import('../src/lib/subjectJoin.ts')
const owner = await requireOwner()
const sb = supabaseAdmin()

interface Row {
  id: string
  distance: number
  basis: string
  entry_id: string
  item_id: string | null
  ref_id: string | null
  subjects: { label: string; terms: string[]; origin: string } | null
  spiritual_items: { type: string; content: string; char_start: number | null } | null
  scripture_refs: { osis_ref: string; char_start: number | null } | null
  entries: { body_markdown: string | null } | null
}

let q = sb
  .from('subject_markings')
  .select(
    'id, distance, basis, entry_id, item_id, ref_id, ' +
      'subjects!inner(label, terms, origin), ' +
      'spiritual_items(type, content, char_start), ' +
      'scripture_refs(osis_ref, char_start), ' +
      'entries!inner(body_markdown)',
  )
  .eq('owner', owner)
  .order('id')
  .limit(4000)
if (ONLY) q = q.eq('subjects.label', ONLY)

const { data, error } = await q
if (error) throw error
const rows = (data ?? []) as unknown as Row[]
if (rows.length === 0) {
  console.error('no pairings found — run build-subjects.ts first')
  process.exit(1)
}

// An even spread across distances, so the report can say something about each
// rather than about whichever band happens to be biggest.
const byDistance = new Map<number, Row[]>()
for (const r of rows) {
  const held = byDistance.get(r.distance)
  if (held) held.push(r)
  else byDistance.set(r.distance, [r])
}
const distances = [...byDistance.keys()].sort((a, b) => a - b)
const perBand = Math.max(1, Math.floor(N / distances.length))
const sample: Row[] = []
for (const d of distances) {
  const band = byDistance.get(d)!
  // Deterministic spread through the band, not the first N (which would all be
  // from whichever entries happen to sort first).
  const step = Math.max(1, Math.floor(band.length / perBand))
  for (let i = 0; i < band.length && sample.filter((s) => s.distance === d).length < perBand; i += step) {
    sample.push(band[i]!)
  }
}

const candidates: JoinCandidate[] = []
const meta = new Map<string, Row>()
for (const [i, r] of sample.entries()) {
  const body = r.entries?.body_markdown ?? ''
  const at = r.item_id ? r.spiritual_items?.char_start : r.scripture_refs?.char_start
  if (at == null || !body) continue
  const line = lineAt(body, at)
  // The anchor: where the subject actually sits on this page.
  const rx = termsMatcher(r.subjects?.terms ?? [])
  const mentions = rx ? mentionLines(body, rx) : []
  let anchor: number | undefined
  let best = Number.POSITIVE_INFINITY
  for (const m of mentions) {
    const gap = Math.abs(m - line)
    if (gap < best) { best = gap; anchor = m }
  }
  const id = `s${i}`
  meta.set(id, r)
  candidates.push({
    id,
    subject: r.subjects?.label ?? '?',
    basis: (r.basis as 'name' | 'matter' | 'declared') ?? 'name',
    kind: r.item_id ? (r.spiritual_items?.type ?? 'prayer') : 'scripture',
    marking: r.item_id ? (r.spiritual_items?.content ?? '') : (r.scripture_refs?.osis_ref ?? ''),
    distance: r.distance,
    context: contextAround(body, line, anchor),
  })
}

console.log(`\njudging ${candidates.length} real pairings (of ${rows.length} total)\n`)
const { verdicts, unjudged, calls } = await judgeCandidates(candidates)
const byId = new Map(verdicts.map((v) => [v.id, v]))

const band = new Map<number, { kept: number; struck: number }>()
for (const c of candidates) {
  const v = byId.get(c.id)
  if (!v) continue
  const b = band.get(c.distance) ?? { kept: 0, struck: 0 }
  v.about ? b.kept++ : b.struck++
  band.set(c.distance, b)
}

for (const c of candidates) {
  const v = byId.get(c.id)
  const mark = !v ? '  ?' : v.about ? '  ·' : '  ✗'
  const text = c.marking.replace(/\s+/g, ' ').slice(0, 68)
  console.log(`${mark} ${String(c.distance)}L ${c.subject.padEnd(20).slice(0, 20)} ${c.kind.padEnd(9)} ${text}`)
  if (v && !v.about) console.log(`       └ ${v.why}`)
}

console.log(`\n── kept / struck, by distance ──`)
for (const d of [...band.keys()].sort((a, b) => a - b)) {
  const b = band.get(d)!
  const total = b.kept + b.struck
  console.log(`  ${d} line(s): kept ${String(b.kept).padStart(3)}  struck ${String(b.struck).padStart(3)}  → ${Math.round((100 * b.kept) / total)}% survive`)
}
const kept = verdicts.filter((v) => v.about).length
console.log(`\n  overall: ${kept}/${verdicts.length} kept · ${unjudged.length} unjudged (kept by default) · ${calls} model calls`)
console.log('  nothing was written.\n')
