/**
 * Derive Threads & Ropes from actual journal entries.
 *
 * WHY entry-level (not topic-label clustering):
 *   Topic labels are summaries of summaries — GPT's words, not the writer's.
 *   Clustering entry embeddings within a lens produces threads that resolve
 *   down to real entry text, making the timeline trustworthy not manufactured.
 *
 * Build order (verify gate at each):
 *   A0  dedupe      --dedupe          mark superseded entries, print count
 *   A1  dry-run     --dry             lens-assign + histogram, no labeling
 *   A2+ full run    (no flag)         register + label + ropes + write + report
 *
 * Examples:
 *   npx tsx scripts/derive-threads.ts --dedupe
 *   npx tsx scripts/derive-threads.ts --dry
 *   npx tsx scripts/derive-threads.ts
 */

// ── config ────────────────────────────────────────────────────────────────────

const ENTRY_SIM_THRESHOLD  = 0.78   // within-lens entry clustering — tune with --dry
const ROPE_SIM_THRESHOLD   = 0.72   // thread-centroid clustering for rope grouping
const LENS_THRESHOLD       = 0.16   // min cosine similarity to assign a lens (tune if too broad/narrow)
const MIN_REAL_CONTENT     = 80     // min chars after stripping Diarly image/location metadata
const MAX_CLUSTER_ENTRIES  = 50     // drop blobs — chains of vaguely-related entries aren't threads
const MIN_CLUSTER_SIZE    = 3      // min member entries per thread
const MIN_SPAN_WEEKS      = 3      // min distinct calendar weeks (recurrence, not burst)
const REP_ENTRIES         = 5      // entries shown per thread in the report
const LABEL_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano'

// ── bootstrap ────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from 'node:fs'
import { DOMAINS, INTERIOR_LENSES, ALL_LENSES } from './lenses.ts'

function loadDotEnv(): void {
  let raw = ''
  try { raw = readFileSync('.env', 'utf8') } catch { return }
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (key && process.env[key] === undefined) process.env[key] = val
  }
}
loadDotEnv()

const args = process.argv.slice(2)
const DEDUPE = args.includes('--dedupe')
const DRY = args.includes('--dry')

const REQUIRED = (DEDUPE || DRY)
  ? ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'APP_OWNER_ID']
  : ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY', 'APP_OWNER_ID']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) { console.error(`Missing env: ${missing.join(', ')}`); process.exit(1) }

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { embed, cosine, centroid } = await import('../api/_lib/embeddings.ts')
const owner = process.env.APP_OWNER_ID as string
const sb = supabaseAdmin()

// ── types ─────────────────────────────────────────────────────────────────────

interface EntryRow {
  id: string
  body_markdown: string
  created_at: string
  embedding: unknown
  entry_lens: string | null
  entry_domain: string | null
  superseded: boolean
}

// ── helpers ───────────────────────────────────────────────────────────────────

function l2norm(v: number[]): number[] {
  let m = 0; for (const x of v) m += x * x; m = Math.sqrt(m)
  return m === 0 ? v : v.map((x) => x / m)
}

function isoWeek(d: Date): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const thu = new Date(day); thu.setUTCDate(thu.getUTCDate() - ((thu.getUTCDay() + 6) % 7) + 3)
  const ys = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  return `${thu.getUTCFullYear()}-W${String(Math.ceil(((thu.getTime() - ys.getTime()) / 86_400_000 + 1) / 7)).padStart(2, '0')}`
}

/** Strip Diarly image/location metadata, prayer openers, and excess whitespace. */
function realContent(text: string): string {
  return (text ?? '')
    .replace(/!\[.*?\]\(.*?\)/g, '')                       // markdown images
    .replace(/\[.*?\]\(diarly:\/\/[^)]+\)/g, '')           // diarly:// location links
    .replace(/^\s*\d+(\.\d+)?°[CF][^\n]*/m, '')            // temperature lines
    .replace(/\s+/g, ' ').trim()
}

function snip(text: string, max = 180): string {
  const stripped = realContent(text)
    .replace(/^#+\s*/m, '')                                // strip leading markdown headings
    .replace(/^(morning\s+jesus|morning\s+god|morning\s+lord|dear\s+(god|lord|jesus|father))[,.\s]*/i, '')
    .trim()
  return stripped.length <= max ? stripped : stripped.slice(0, max - 1) + '…'
}

function parseVec(raw: unknown): number[] | null {
  if (!raw) return null
  if (typeof raw === 'string') { try { const a = JSON.parse(raw); if (Array.isArray(a)) return a } catch { return null } }
  if (Array.isArray(raw)) return raw as number[]
  return null
}

class UF {
  private p = new Map<number, number>()
  find(x: number): number {
    if (!this.p.has(x)) this.p.set(x, x)
    const p = this.p.get(x)!; if (p !== x) this.p.set(x, this.find(p)); return this.p.get(x)!
  }
  union(x: number, y: number) { this.p.set(this.find(x), this.find(y)) }
  groups(n: number): Map<number, number[]> {
    const g = new Map<number, number[]>()
    for (let i = 0; i < n; i++) { const r = this.find(i); g.set(r, [...(g.get(r) ?? []), i]) }
    return g
  }
}

// ── A0: DEDUPE ────────────────────────────────────────────────────────────────

if (DEDUPE) {
  console.log('A0 — marking superseded (exact-duplicate) entries…')
  // Load all entries; group by (body_markdown, date). Keep the earliest; mark rest superseded.
  const PAGE = 500; const all: { id: string; body_markdown: string; created_at: string }[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('entries').select('id, body_markdown, created_at').eq('owner', owner)
      .order('created_at', { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    all.push(...(data as typeof all)); if (data.length < PAGE) break
  }
  console.log(`  Loaded ${all.length} entries.`)

  const seen = new Map<string, string>() // key → first id
  const toMark: string[] = []
  for (const e of all) {
    const key = `${e.created_at.slice(0, 10)}||${e.body_markdown.trim().slice(0, 500)}`
    if (seen.has(key)) { toMark.push(e.id) } else { seen.set(key, e.id) }
  }
  if (toMark.length === 0) { console.log('  No duplicates found.'); process.exit(0) }

  // Mark in batches of 100.
  for (let i = 0; i < toMark.length; i += 100) {
    const { error } = await sb.from('entries').update({ superseded: true }).in('id', toMark.slice(i, i + 100)).eq('owner', owner)
    if (error) throw error
  }
  console.log(`  Marked ${toMark.length} entries as superseded.`)
  process.exit(0)
}

// ── load all live entries with embeddings ─────────────────────────────────────

console.log('Loading live entries…')
const entries: EntryRow[] = []
for (let from = 0; ; from += 100) {
  const { data, error } = await sb
    .from('entries').select('id, body_markdown, created_at, embedding, entry_lens, entry_domain, superseded')
    .eq('owner', owner).eq('superseded', false).not('embedding', 'is', null)
    .order('created_at', { ascending: true }).range(from, from + 99)
  if (error) throw error
  if (!data?.length) break
  entries.push(...(data as EntryRow[])); if (data.length < 100) break
}
console.log(`Loaded ${entries.length} live embedded entries.`)
if (entries.length === 0) { console.error('No embedded entries — run embed-entries.ts first.'); process.exit(1) }

// Filter out Diarly metadata-only entries (weather + location, no real text).
const liveEntries = entries.filter((e) => realContent(e.body_markdown).length >= MIN_REAL_CONTENT)
if (liveEntries.length < entries.length) {
  console.log(`  Filtered ${entries.length - liveEntries.length} metadata-only entries → ${liveEntries.length} with real content.`)
}
// Reassign so the rest of the script works on the filtered set.
entries.length = 0; entries.push(...liveEntries)

// Normalize embeddings once.
const normMap = new Map<string, number[]>()
for (const e of entries) {
  const v = parseVec(e.embedding); if (v) normMap.set(e.id, l2norm(v))
}

// ── A1: lens assignment via embedding similarity (idempotent) ─────────────────
// Replaces fragile Nano JSON-batch approach. Each entry embedding is compared
// against lens description embeddings; best match above LENS_THRESHOLD is assigned.
// An entry may receive one domain AND one interior lens independently.

const unassigned = entries.filter((e) => !e.entry_lens && !e.entry_domain)

if (unassigned.length > 0) {
  console.log(`Assigning lenses to ${unassigned.length} entries via embedding similarity (LENS_THRESHOLD=${LENS_THRESHOLD})…`)

  // Embed lens descriptions once (12 short texts — fast, cheap).
  const lensDescVecs = await embed(ALL_LENSES.map((l) => l.desc))
  const domainNorms   = DOMAINS.map((_, i) => l2norm(lensDescVecs[i]!))
  const interiorNorms = INTERIOR_LENSES.map((_, i) => l2norm(lensDescVecs[DOMAINS.length + i]!))

  let assignedCount = 0
  for (const e of unassigned) {
    const entryNorm = normMap.get(e.id)
    if (!entryNorm) continue

    // Best-matching domain (if any clear signal above threshold).
    let bestDomainSim = LENS_THRESHOLD, bestDomain: string | null = null
    for (let i = 0; i < DOMAINS.length; i++) {
      const sim = cosine(entryNorm, domainNorms[i]!)
      if (sim > bestDomainSim) { bestDomainSim = sim; bestDomain = DOMAINS[i]!.key }
    }

    // Best-matching interior lens (independently).
    let bestInteriorSim = LENS_THRESHOLD, bestInterior: string | null = null
    for (let i = 0; i < INTERIOR_LENSES.length; i++) {
      const sim = cosine(entryNorm, interiorNorms[i]!)
      if (sim > bestInteriorSim) { bestInteriorSim = sim; bestInterior = INTERIOR_LENSES[i]!.key }
    }

    e.entry_domain = bestDomain
    e.entry_lens   = bestInterior
    if (bestDomain || bestInterior) assignedCount++
  }

  console.log(`Assigned ${assignedCount} of ${unassigned.length} entries.`)

  // Persist assignments (skipped in --dry so DB stays clean during tuning).
  if (!DRY) {
    const toSave = unassigned.filter((e) => e.entry_domain !== null || e.entry_lens !== null)
    for (let i = 0; i < toSave.length; i += 200) {
      const batch = toSave.slice(i, i + 200)
      await Promise.all(batch.map((e) =>
        sb.from('entries')
          .update({ entry_domain: e.entry_domain, entry_lens: e.entry_lens })
          .eq('id', e.id).eq('owner', owner),
      ))
    }
    console.log(`Saved ${toSave.length} assignments to DB.`)
  }
}

// ── A1: cluster entries within each lens ─────────────────────────────────────

interface Cluster {
  ids: string[]
  entries: EntryRow[]
  norm: number[][]
  spanStart: Date
  spanEnd: Date
  spanWeeks: number
  lensKey: string
  isDomain: boolean
}

console.log(`\nClustering within each lens at threshold ${ENTRY_SIM_THRESHOLD}…`)

const allClusters: Cluster[] = []

function clusterWithinLens(lensEntries: EntryRow[], lensKey: string, isDomain: boolean): void {
  if (lensEntries.length < MIN_CLUSTER_SIZE) return
  const vecs = lensEntries.map((e) => normMap.get(e.id)!).filter(Boolean)
  if (vecs.length < MIN_CLUSTER_SIZE) return

  const uf = new UF()
  for (let i = 0; i < vecs.length; i++)
    for (let j = i + 1; j < vecs.length; j++)
      if (cosine(vecs[i]!, vecs[j]!) >= ENTRY_SIM_THRESHOLD) uf.union(i, j)

  for (const [, indices] of uf.groups(vecs.length)) {
    if (indices.length < MIN_CLUSTER_SIZE) continue
    if (indices.length > MAX_CLUSTER_ENTRIES) continue   // blob, not a thread
    const clusterEntries = indices.map((i) => lensEntries[i]!).filter(Boolean)
    const weeks = new Set(clusterEntries.map((e) => isoWeek(new Date(e.created_at))))
    if (weeks.size < MIN_SPAN_WEEKS) continue
    const dates = clusterEntries.map((e) => new Date(e.created_at))
    allClusters.push({
      ids: clusterEntries.map((e) => e.id),
      entries: clusterEntries,
      norm: indices.map((i) => vecs[i]!).filter(Boolean),
      spanStart: new Date(Math.min(...dates.map((d) => d.getTime()))),
      spanEnd: new Date(Math.max(...dates.map((d) => d.getTime()))),
      spanWeeks: weeks.size,
      lensKey,
      isDomain,
    })
  }
}

for (const domain of DOMAINS) {
  const lensEntries = entries.filter((e) => e.entry_domain === domain.key)
  clusterWithinLens(lensEntries, domain.key, true)
}
for (const lens of INTERIOR_LENSES) {
  const lensEntries = entries.filter((e) => e.entry_lens === lens.key)
  clusterWithinLens(lensEntries, lens.key, false)
}

allClusters.sort((a, b) => b.ids.length - a.ids.length)

// ── DRY-RUN REPORT ────────────────────────────────────────────────────────────

console.log(`\n── Clustering report ───────────────────────────────────────────`)
console.log(`  ENTRY_SIM_THRESHOLD: ${ENTRY_SIM_THRESHOLD}`)
console.log(`  Live entries:        ${entries.length}`)
console.log(`  Threads (pass floor): ${allClusters.length}  (≥${MIN_CLUSTER_SIZE} entries, ≥${MIN_SPAN_WEEKS} weeks)`)

console.log(`\nPer-lens breakdown:`)
for (const l of ALL_LENSES) {
  const isDom = DOMAINS.some((d) => d.key === l.key)
  const lentries = entries.filter((e) => isDom ? e.entry_domain === l.key : e.entry_lens === l.key)
  const lthreads = allClusters.filter((c) => c.lensKey === l.key)
  if (lentries.length === 0) continue
  console.log(`  [${l.label.padEnd(18)}] ${String(lentries.length).padStart(4)} entries → ${lthreads.length} threads`)
}

console.log(`\nTop threads:`)
for (const c of allClusters.slice(0, 12)) {
  const span = `${c.spanStart.toISOString().slice(0, 7)} → ${c.spanEnd.toISOString().slice(0, 7)}`
  const rep = snip(c.entries[0]?.body_markdown ?? '', 80)
  console.log(`  [${c.lensKey}]  ${c.ids.length} entries · ${c.spanWeeks}w · ${span}`)
  console.log(`    └ "${rep}"`)
}

if (DRY) {
  console.log(`\n── TUNE GATE ────────────────────────────────────────────────────`)
  console.log(`--dry: nothing written. Tune ENTRY_SIM_THRESHOLD (line 14) until threads look right.`)
  console.log(`Then drop --dry to label, classify, group into ropes, and write.`)
  process.exit(0)
}

// ── A2: register classification ───────────────────────────────────────────────

import OpenAI from 'openai'
const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, maxRetries: 5 })

console.log('\nA2 — classifying member registers…')

type Register = 'bringing' | 'meeting' | 'neutral'
const registerMap = new Map<string, Register>() // entryId → register

// Batch all member entries across all clusters.
const allMemberIds = [...new Set(allClusters.flatMap((c) => c.ids))]
const memberEntries = entries.filter((e) => allMemberIds.includes(e.id))

// Smaller batches + defensive extraction — UUIDs in JSON cause parse failures
// at large batch sizes because max_tokens gets tight.
const REG_BATCH = 10
let regFailed = 0
for (let i = 0; i < memberEntries.length; i += REG_BATCH) {
  const batch = memberEntries.slice(i, i + REG_BATCH)
  // Send only the short entry id (last 8 chars) to save tokens, remap after.
  const shortMap = new Map(batch.map((e) => [e.id.slice(-8), e.id]))
  const input = batch.map((e) => ({ id: e.id.slice(-8), text: realContent(e.body_markdown).slice(0, 300) }))
  const prompt = `Classify the journal writer's register for each entry.
- "bringing": carrying, lamenting, asking, struggling, confessing
- "meeting": writer's own words express relief, peace, encounter, resolution
- "neutral": description, logistics, gratitude without struggle
Bias hard toward "bringing"/"neutral". Only "meeting" for clear writer-expressed consolation.
Return ONLY a JSON array, nothing else:
[{"id":"...","r":"bringing"|"meeting"|"neutral"},...]
Entries: ${JSON.stringify(input)}`

  try {
    const res = await oai.chat.completions.create({
      model: LABEL_MODEL, temperature: 0, max_tokens: REG_BATCH * 30,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = (res.choices[0]?.message?.content ?? '').trim()
    // Extract the JSON array even if wrapped in prose.
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) { regFailed++; process.stdout.write('!'); continue }
    const results = JSON.parse(match[0]) as { id: string; r?: string; register?: string }[]
    for (const r of results) {
      const fullId = shortMap.get(r.id)
      const reg = (r.r ?? r.register ?? 'neutral') as Register
      if (fullId) registerMap.set(fullId, reg)
    }
    process.stdout.write('.')
  } catch { regFailed++; process.stdout.write('!') }
}
console.log(`\nClassified ${registerMap.size} members (${regFailed} batches failed → neutral).`)

// ── A3: label threads ─────────────────────────────────────────────────────────

console.log(`\nA3 — labeling ${allClusters.length} threads…\n`)

interface LabeledCluster extends Cluster {
  labelAi: string
  lens: string
  oneLineWhy: string
}

const labeledClusters: LabeledCluster[] = []

for (let i = 0; i < allClusters.length; i++) {
  const c = allClusters[i]!
  process.stdout.write(`  [${i + 1}/${allClusters.length}] [${c.lensKey}] (${c.ids.length} entries)… `)

  // Rep entries: closest to centroid.
  const cen = l2norm(centroid(c.norm))
  const ranked = c.entries
    .map((e, k) => ({ e, sim: cosine(cen, c.norm[k]!) }))
    .sort((a, b) => b.sim - a.sim)
  const reps = ranked.slice(0, REP_ENTRIES)
  const snippets = reps.map((x) => `[${x.e.created_at.slice(0, 10)}] ${snip(x.e.body_markdown, 350)}`).join('\n\n')

  const lensObj = ALL_LENSES.find((l) => l.key === c.lensKey)!
  const prompt = `You are helping a journal author name a recurring thread — a matter they kept returning to.

Lens: "${lensObj.label}" (${lensObj.desc})
${c.ids.length} journal entries · ${c.spanStart.toISOString().slice(0,10)} to ${c.spanEnd.toISOString().slice(0,10)} · ${c.spanWeeks} distinct weeks

${reps.length} representative entries:
${snippets}

Give this thread:
1. A SHORT WARM LABEL in the author's own phrasing — 4–7 words. Descriptive, not diagnostic. NOT clinical or case-file language (no "porn temptation tied to X"). Name the matter as the author would name it — "the ache to be near God", "holding the trading plan", "the recurring conflict with Esther". A gentle, honest noun phrase. Never a verdict about the person.
2. The specific sub-aspect within "${lensObj.label}" this thread touches.
3. One sentence: the recurring situation or question, in the author's words — not your interpretation.

Return ONLY valid JSON (no fences):
{"label":"...","lens":"...","oneLineWhy":"..."}`

  try {
    const res = await oai.chat.completions.create({
      model: LABEL_MODEL, temperature: 0.2, max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = (res.choices[0]?.message?.content ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
    const p = JSON.parse(raw) as { label: string; lens: string; oneLineWhy: string }
    if (!p.label) throw new Error('no label')
    labeledClusters.push({ ...c, labelAi: p.label, lens: p.lens ?? lensObj.label, oneLineWhy: p.oneLineWhy ?? '' })
    console.log(`✓ "${p.label}"`)
  } catch (err) {
    console.log(`✗ skipped (${err instanceof Error ? err.message : err})`)
  }
}

// ── A4: rope grouping — same lens key = same rope ─────────────────────────────
// Centroid similarity doesn't work for a single-person journal (all entries
// share vocabulary → all centroids are 0.84–0.97 similar). Group by lens key
// instead: two Purity threads → Purity rope; two Prayer threads → Prayer rope.

console.log(`\nA4 — grouping threads into ropes by shared lens…`)

const byLens = new Map<string, number[]>()
for (let i = 0; i < labeledClusters.length; i++) {
  const key = labeledClusters[i]!.lensKey
  byLens.set(key, [...(byLens.get(key) ?? []), i])
}
const ropeGroups = [...byLens.values()].filter((g) => g.length >= 2)
// Provide a stable "root" index per group (first member) for the label map.
const ropeRootOf = new Map<number, number>()
for (const g of ropeGroups) for (const i of g) ropeRootOf.set(i, g[0]!)

console.log(`  ${ropeGroups.length} ropes (lens groups of ≥2 threads).`)

// Label ropes — use the lens label as the rope name (warm, simple).
const ropeLabels = new Map<number, string>() // root index → label
for (const indices of ropeGroups) {
  const root = indices[0]!
  const lensKey = labeledClusters[root]!.lensKey
  const lensLabel = ALL_LENSES.find((l) => l.key === lensKey)?.label ?? lensKey
  const members = indices.map((i) => labeledClusters[i]!.labelAi)
  ropeLabels.set(root, lensLabel)
  console.log(`  rope: "${lensLabel}" ← ${members.join(' + ')}`)
}

// ── A5: write to DB ───────────────────────────────────────────────────────────

console.log(`\nA5 — writing to database…`)

// Clear previous v2 threads + ropes for this owner.
await sb.from('thread_members').delete().in('thread_id',
  (await sb.from('threads').select('id').eq('owner', owner).not('label_ai', 'is', null)
    .then(({ data }) => (data ?? []).map((r: { id: string }) => r.id))),
)
await sb.from('threads').delete().eq('owner', owner).not('label_ai', 'is', null)
await sb.from('ropes').delete().eq('owner', owner)

// Insert ropes first.
const ropeIdMap = new Map<number, string>() // root → rope uuid
for (const indices of ropeGroups) {
  const root = indices[0]!
  const label = ropeLabels.get(root) ?? labeledClusters[root]!.labelAi
  const members = indices.map((i) => labeledClusters[i]!)
  const allDates = members.flatMap((c) => c.entries.map((e) => new Date(e.created_at)))
  const { data, error } = await sb.from('ropes').insert({
    owner,
    label,
    domain: members[0]?.isDomain ? members[0]?.lensKey : null,
    span_start: new Date(Math.min(...allDates.map((d) => d.getTime()))).toISOString(),
    span_end: new Date(Math.max(...allDates.map((d) => d.getTime()))).toISOString(),
  }).select('id').single()
  if (error) throw error
  ropeIdMap.set(root, (data as { id: string }).id)
}

// Insert threads + thread_members.
let tWritten = 0
for (let i = 0; i < labeledClusters.length; i++) {
  const c = labeledClusters[i]!
  const ropeRoot = ropeRootOf.get(i) ?? null
  const ropeId = ropeRoot !== null ? (ropeIdMap.get(ropeRoot) ?? null) : null
  const temp = Math.max(0.1, Math.min(1.0, 1 - (Date.now() - c.spanEnd.getTime()) / (365 * 24 * 3600_000)))

  const { data: tdata, error: terr } = await sb.from('threads').insert({
    owner,
    label: c.labelAi,
    label_ai: c.labelAi,
    lenses: [c.lens],
    lens: c.lens,
    domain: c.isDomain ? c.lensKey : null,
    interior: !c.isDomain,
    member_entry_ids: c.ids,
    weight: c.ids.length,
    breadth: ropeRoot !== null ? (ropeGroups.find((g) => g[0] === ropeRoot)?.length ?? 1) : 1,
    span_start: c.spanStart.toISOString(),
    span_end: c.spanEnd.toISOString(),
    temperature: temp,
    rope_id: ropeId,
    one_line_why: c.oneLineWhy,
  }).select('id').single()
  if (terr) { console.warn(`  thread insert error: ${terr.message}`); continue }

  const threadId = (tdata as { id: string }).id
  const memberRows = c.ids.map((entryId) => ({
    thread_id: threadId,
    entry_id: entryId,
    register: registerMap.get(entryId) ?? 'neutral',
  }))
  const { error: merr } = await sb.from('thread_members').insert(memberRows)
  if (merr) console.warn(`  member insert error: ${merr.message}`)
  tWritten++
}

console.log(`Wrote ${tWritten} threads, ${ropeGroups.length} ropes.`)

// ── report ────────────────────────────────────────────────────────────────────

let md = `# Thread Report\n\nGenerated: ${new Date().toISOString().slice(0,19).replace('T',' ')} UTC  \n`
md += `ENTRY_SIM_THRESHOLD: ${ENTRY_SIM_THRESHOLD} · ROPE_SIM_THRESHOLD: ${ROPE_SIM_THRESHOLD}  \n`
md += `${labeledClusters.length} threads · ${ropeGroups.length} ropes\n\n---\n\n`

for (const c of labeledClusters.sort((a, b) => b.ids.length - a.ids.length)) {
  const cen = l2norm(centroid(c.norm))
  const ranked = c.entries.map((e, k) => ({ e, sim: cosine(cen, c.norm[k]!) })).sort((a, b) => b.sim - a.sim)
  const bringing = c.ids.filter((id) => registerMap.get(id) === 'bringing').length
  const meeting = c.ids.filter((id) => registerMap.get(id) === 'meeting').length

  md += `## [${c.lensKey}] ${c.labelAi}\n\n`
  md += `- **Span**: ${c.spanStart.toISOString().slice(0,10)} → ${c.spanEnd.toISOString().slice(0,10)}\n`
  md += `- **Entries**: ${c.ids.length} (${bringing} bringing · ${meeting} meeting)\n`
  md += `- **Weeks**: ${c.spanWeeks}\n`
  md += `- **Why**: ${c.oneLineWhy}\n\n`

  for (const { e } of ranked.slice(0, REP_ENTRIES)) {
    const reg = registerMap.get(e.id) ?? 'neutral'
    const mark = reg === 'meeting' ? '⬤ meeting' : reg === 'bringing' ? '○ bringing' : '  neutral'
    md += `**${e.created_at.slice(0,10)}** ${mark}\n> ${snip(e.body_markdown, 380)}\n\n`
  }
  md += `---\n\n`
}

writeFileSync('thread-report.md', md, 'utf8')
console.log(`\nReport → thread-report.md`)
console.log(`\nRead the report. If it looks honest, reload the app with threadsRopes flag on and ⌘2.`)
