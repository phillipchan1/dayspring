// Derive reflective threads from GPT-extracted topics in insights rollups.
//
// Why this approach instead of raw entry clustering:
//   Raw entry cosine similarity picks up writing STYLE (openers, vocab, tone),
//   not recurring THEMES. The insights weekly rollups already have GPT-extracted
//   topic labels per period — short, semantic, style-free. Clustering those labels
//   finds themes that genuinely recur across weeks, which is what a thread is.
//
//   npx tsx scripts/derive-threads.ts --dry   # histogram + top clusters, no writes
//   npx tsx scripts/derive-threads.ts         # write to threads table + thread-report.md
//
// Tune TOPIC_SIM_THRESHOLD with --dry until label clusters look right.

const TOPIC_SIM_THRESHOLD = 0.82  // cosine similarity to merge two topic labels into one thread
const MIN_PERIODS = 3             // topic must appear in ≥ N distinct weekly rollups
const MIN_SPAN_WEEKS = 3          // topic must span ≥ N distinct calendar weeks
const REP_ENTRIES = 6             // representative entries shown in the report
const LABEL_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano'

// Topic labels to skip — structural/format patterns, not content themes.
const LABEL_STOPWORDS = [
  'morning jesus', 'morning prayer', 'daily prayer', 'prayer routine',
  'morning devotion', 'start of day', 'morning journal',
]

// ── bootstrap ────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from 'node:fs'

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
const { embed, cosine, centroid } = await import('../api/_lib/embeddings.ts')

const owner = process.env.APP_OWNER_ID as string
const sb = supabaseAdmin()

// ── types ─────────────────────────────────────────────────────────────────────

interface Topic {
  label: string
  count: number
  entry_ids: string[]
}

interface RollupPayload {
  topics?: Topic[]
  reflection?: { themes?: string[]; throughline?: string[] }
}

interface Rollup {
  id: string
  period_start: string
  period_end: string
  structured_payload: RollupPayload
}

// One occurrence of a topic label in a specific weekly period.
interface TopicOccurrence {
  label: string
  normalizedLabel: string
  periodStart: string
  periodEnd: string
  entryIds: string[]
}

interface Thread {
  canonicalLabel: string
  allLabels: string[]
  occurrences: TopicOccurrence[]
  entryIds: string[]   // deduplicated union
  spanStart: Date
  spanEnd: Date
  spanWeeks: number
  periods: number
  lenses: string[]     // filled by labeler
  oneLineWhy: string   // filled by labeler
  embedding: number[]  // centroid of label embeddings
}

// ── helpers ───────────────────────────────────────────────────────────────────

function isoWeek(d: Date): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const thu = new Date(day)
  thu.setUTCDate(thu.getUTCDate() - ((thu.getUTCDay() + 6) % 7) + 3)
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${thu.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function snippet(text: string, maxChars = 200): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length <= maxChars ? clean : clean.slice(0, maxChars - 1) + '…'
}

function l2normalize(v: number[]): number[] {
  let mag = 0
  for (const x of v) mag += x * x
  mag = Math.sqrt(mag)
  if (mag === 0) return v
  return v.map((x) => x / mag)
}

// ── union-find ────────────────────────────────────────────────────────────────

class UnionFind {
  private parent = new Map<number, number>()
  find(x: number): number {
    if (!this.parent.has(x)) this.parent.set(x, x)
    const p = this.parent.get(x)!
    if (p !== x) this.parent.set(x, this.find(p))
    return this.parent.get(x)!
  }
  union(x: number, y: number): void {
    this.parent.set(this.find(x), this.find(y))
  }
  components(n: number): Map<number, number[]> {
    const groups = new Map<number, number[]>()
    for (let i = 0; i < n; i++) {
      const root = this.find(i)
      const g = groups.get(root) ?? []
      g.push(i)
      groups.set(root, g)
    }
    return groups
  }
}

// ── step 1: load weekly rollups ───────────────────────────────────────────────

console.log('Loading weekly rollups…')

const rollups: Rollup[] = []
const PAGE = 500

for (let from = 0; ; from += PAGE) {
  const { data, error } = await sb
    .from('insights')
    .select('id, period_start, period_end, structured_payload')
    .eq('owner', owner)
    .eq('type', 'weekly')
    .order('period_start', { ascending: true })
    .range(from, from + PAGE - 1)

  if (error) throw error
  if (!data || data.length === 0) break
  rollups.push(...(data as Rollup[]))
  if (data.length < PAGE) break
}

console.log(`Loaded ${rollups.length} weekly rollups.`)

if (rollups.length === 0) {
  console.error('No weekly rollups found — run the backfill script first.')
  process.exit(1)
}

// ── step 2: extract topic occurrences ─────────────────────────────────────────

const occurrences: TopicOccurrence[] = []

for (const r of rollups) {
  const topics = r.structured_payload?.topics ?? []
  for (const t of topics) {
    const label = (t.label ?? '').trim()
    if (!label || !t.entry_ids?.length) continue
    if (LABEL_STOPWORDS.some((w) => label.toLowerCase().includes(w))) continue
    occurrences.push({
      label,
      normalizedLabel: label.toLowerCase(),
      periodStart: r.period_start,
      periodEnd: r.period_end,
      entryIds: t.entry_ids,
    })
  }
}

console.log(`Extracted ${occurrences.length} topic occurrences across ${rollups.length} weeks.`)

// Unique labels to embed.
const uniqueLabels = [...new Set(occurrences.map((o) => o.normalizedLabel))]
console.log(`Unique topic labels: ${uniqueLabels.length}`)

// ── step 3: embed topic labels ────────────────────────────────────────────────

console.log('Embedding topic labels…')
const rawVecs = await embed(uniqueLabels)
const labelVecs = new Map<string, number[]>()
for (let i = 0; i < uniqueLabels.length; i++) {
  labelVecs.set(uniqueLabels[i]!, l2normalize(rawVecs[i]!))
}

// ── step 4: cluster labels via union-find ─────────────────────────────────────

console.log(`Clustering labels at threshold ${TOPIC_SIM_THRESHOLD}…`)

const uf = new UnionFind()
const vecs = uniqueLabels.map((l) => labelVecs.get(l)!)
let edgeCount = 0

for (let i = 0; i < uniqueLabels.length; i++) {
  for (let j = i + 1; j < uniqueLabels.length; j++) {
    if (cosine(vecs[i]!, vecs[j]!) >= TOPIC_SIM_THRESHOLD) {
      uf.union(i, j)
      edgeCount++
    }
  }
}

const components = uf.components(uniqueLabels.length)

// ── step 5: build threads from label clusters ─────────────────────────────────

const threads: Thread[] = []

for (const [, indices] of components) {
  const clusterLabels = indices.map((i) => uniqueLabels[i]!)
  const clusterOccurrences = occurrences.filter((o) => clusterLabels.includes(o.normalizedLabel))

  const distinctPeriods = new Set(clusterOccurrences.map((o) => o.periodStart))
  const entryIdSet = new Set(clusterOccurrences.flatMap((o) => o.entryIds))
  const dates = clusterOccurrences.map((o) => new Date(o.periodStart))
  const weeks = new Set(clusterOccurrences.map((o) => isoWeek(new Date(o.periodStart))))

  if (distinctPeriods.size < MIN_PERIODS || weeks.size < MIN_SPAN_WEEKS) continue

  const spanStart = new Date(Math.min(...dates.map((d) => d.getTime())))
  const spanEnd = new Date(Math.max(...dates.map((d) => d.getTime())))

  // Pick the most frequently occurring label as canonical.
  const labelFreq = new Map<string, number>()
  for (const o of clusterOccurrences) {
    labelFreq.set(o.label, (labelFreq.get(o.label) ?? 0) + 1)
  }
  const canonicalLabel = [...labelFreq.entries()].sort((a, b) => b[1] - a[1])[0]![0]
  const allLabels = [...new Set(clusterOccurrences.map((o) => o.label))]

  // Centroid embedding of the label cluster.
  const clusterVecs = indices.map((i) => vecs[i]!)
  const emb = l2normalize(centroid(clusterVecs))

  threads.push({
    canonicalLabel,
    allLabels,
    occurrences: clusterOccurrences,
    entryIds: [...entryIdSet],
    spanStart,
    spanEnd,
    spanWeeks: weeks.size,
    periods: distinctPeriods.size,
    lenses: [],
    oneLineWhy: '',
    embedding: emb,
  })
}

// Sort by period count descending.
threads.sort((a, b) => b.periods - a.periods || b.entryIds.length - a.entryIds.length)

// ── step 6: dry-run report ────────────────────────────────────────────────────

console.log(`\n── Thread derivation report ────────────────────────────────────`)
console.log(`  TOPIC_SIM_THRESHOLD:  ${TOPIC_SIM_THRESHOLD}`)
console.log(`  Weekly rollups read:  ${rollups.length}`)
console.log(`  Topic occurrences:    ${occurrences.length}`)
console.log(`  Unique labels:        ${uniqueLabels.length}`)
console.log(`  Label clusters:       ${components.size}`)
console.log(`  Threads (pass floor): ${threads.length}  (≥${MIN_PERIODS} periods, ≥${MIN_SPAN_WEEKS} weeks)`)

console.log(`\nTop threads by recurrence:`)
for (const t of threads.slice(0, 10)) {
  const span = `${t.spanStart.toISOString().slice(0, 7)} → ${t.spanEnd.toISOString().slice(0, 7)}`
  const variants = t.allLabels.length > 1
    ? `  [also: ${t.allLabels.filter((l) => l !== t.canonicalLabel).slice(0, 2).join(', ')}]`
    : ''
  console.log(`  "${t.canonicalLabel}"  ·  ${t.periods} periods · ${t.spanWeeks} weeks · ${span}${variants}`)
}

if (DRY) {
  console.log(`\n──────────────────────────────────────────────────────────────`)
  console.log(`--dry: nothing written.`)
  console.log(`\nIf threads look right, drop --dry to label and write.`)
  console.log(`If too many/few, tune TOPIC_SIM_THRESHOLD (currently ${TOPIC_SIM_THRESHOLD}).`)
  process.exit(0)
}

// ── step 7: label threads + fetch representative entries ──────────────────────

import OpenAI from 'openai'

const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, maxRetries: 5 })

// Load entry bodies for representative snippets (batch by entry IDs).
const allEntryIds = [...new Set(threads.flatMap((t) => t.entryIds))]
const entryMap = new Map<string, { body_markdown: string; created_at: string }>()

console.log(`\nFetching ${allEntryIds.length} unique entry bodies…`)

const ENTRY_PAGE = 200
for (let from = 0; from < allEntryIds.length; from += ENTRY_PAGE) {
  const batch = allEntryIds.slice(from, from + ENTRY_PAGE)
  const { data, error } = await sb
    .from('entries')
    .select('id, body_markdown, created_at')
    .in('id', batch)
    .eq('owner', owner)
  if (error) throw error
  for (const r of data ?? []) {
    entryMap.set(r.id, { body_markdown: r.body_markdown, created_at: r.created_at })
  }
}

console.log(`Labeling ${threads.length} threads…\n`)

interface ThreadRow {
  owner: string
  label: string
  lenses: string[]
  member_entry_ids: string[]
  weight: number
  breadth: number
  span_start: string
  span_end: string
  sim_threshold: number
  one_line_why: string
}

const rows: { thread: Thread; row: ThreadRow }[] = []

for (let i = 0; i < threads.length; i++) {
  const t = threads[i]!
  process.stdout.write(`  [${i + 1}/${threads.length}] "${t.canonicalLabel}" (${t.periods} periods)… `)

  // Rep entries: most recent ones, entry IDs that actually exist in our map.
  const withEntry = t.entryIds
    .map((id) => ({ id, e: entryMap.get(id) }))
    .filter((x): x is { id: string; e: { body_markdown: string; created_at: string } } => !!x.e)
    .sort((a, b) => b.e.created_at.localeCompare(a.e.created_at))

  const reps = withEntry.slice(0, REP_ENTRIES)
  const snippets = reps
    .map((x) => `[${x.e.created_at.slice(0, 10)}] ${snippet(x.e.body_markdown, 300)}`)
    .join('\n\n')

  const prompt = `You are helping a journal author discover recurring threads in their writing.

This theme appears in ${t.periods} weekly journal periods, spanning ${t.spanStart.toISOString().slice(0,10)} to ${t.spanEnd.toISOString().slice(0,10)}.

The GPT analysis labelled it across those weeks as: ${t.allLabels.slice(0, 6).map((l) => `"${l}"`).join(', ')}.

Here are ${reps.length} representative entries:

${snippets}

Give this thread:
1. A SHORT LABEL in the author's own recurring phrasing — drawn from what they actually wrote, not your interpretation. 5–8 words max. NOT "your X" or "you struggle with Y."
2. The life areas (lenses) it touches — use words from the entries (e.g. "prayer", "trading", "family", "scripture", "calling", "health").
3. One sentence: what recurring situation or question ties these entries, in the author's words.

Return ONLY valid JSON, no markdown fences:
{"label":"...","lenses":["..."],"oneLineWhy":"..."}`

  try {
    const res = await oai.chat.completions.create({
      model: LABEL_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 200,
    })
    const raw = (res.choices[0]?.message?.content ?? '').trim()
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
    const parsed = JSON.parse(cleaned) as { label: string; lenses: string[]; oneLineWhy: string }
    if (!parsed.label || !Array.isArray(parsed.lenses)) throw new Error('bad shape')

    t.lenses = parsed.lenses
    t.oneLineWhy = parsed.oneLineWhy ?? ''

    const row: ThreadRow = {
      owner,
      label: parsed.label,
      lenses: parsed.lenses,
      member_entry_ids: t.entryIds,
      weight: t.entryIds.length,
      breadth: parsed.lenses.length,
      span_start: t.spanStart.toISOString(),
      span_end: t.spanEnd.toISOString(),
      sim_threshold: TOPIC_SIM_THRESHOLD,
      one_line_why: parsed.oneLineWhy ?? '',
    }
    rows.push({ thread: t, row })
    console.log(`✓ "${parsed.label}"`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`✗ skipped (${msg})`)
  }
}

// ── step 8: write to threads table ────────────────────────────────────────────

if (rows.length === 0) {
  console.log('\nNo threads labeled — nothing to write.')
  process.exit(0)
}

console.log(`\nClearing old threads for this owner + threshold…`)
const { error: delErr } = await sb
  .from('threads')
  .delete()
  .eq('owner', owner)
  .eq('sim_threshold', TOPIC_SIM_THRESHOLD)
if (delErr) console.warn(`  warn: ${delErr.message}`)

const { error: insErr } = await sb.from('threads').insert(rows.map((r) => r.row))
if (insErr) throw insErr

console.log(`Wrote ${rows.length} threads.`)

// ── step 9: thread-report.md ──────────────────────────────────────────────────

let md = `# Thread Report\n\n`
md += `Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC  \n`
md += `TOPIC_SIM_THRESHOLD: ${TOPIC_SIM_THRESHOLD} · MIN_PERIODS: ${MIN_PERIODS} · MIN_SPAN_WEEKS: ${MIN_SPAN_WEEKS}  \n`
md += `Model: ${LABEL_MODEL}  \n\n`
md += `${rows.length} threads · sorted by recurrence\n\n---\n\n`

for (const { thread: t, row } of rows) {
  md += `## ${row.label}\n\n`
  md += `- **Periods**: ${t.periods} weekly rollups\n`
  md += `- **Weeks spanned**: ${t.spanWeeks}\n`
  md += `- **Span**: ${t.spanStart.toISOString().slice(0,10)} → ${t.spanEnd.toISOString().slice(0,10)}\n`
  md += `- **Entries**: ${row.weight}\n`
  md += `- **Lenses**: ${row.lenses.join(', ')}\n`
  md += `- **Why**: ${row.one_line_why}\n`
  md += `- **GPT called it**: ${t.allLabels.slice(0, 6).map((l) => `"${l}"`).join(', ')}\n\n`

  md += `### Representative entries\n\n`
  const withEntry = t.entryIds
    .map((id) => ({ id, e: entryMap.get(id) }))
    .filter((x): x is { id: string; e: { body_markdown: string; created_at: string } } => !!x.e)
    .sort((a, b) => b.e.created_at.localeCompare(a.e.created_at))
    .slice(0, REP_ENTRIES)

  for (const { e } of withEntry) {
    md += `**${e.created_at.slice(0, 10)}**\n> ${snippet(e.body_markdown, 400)}\n\n`
  }
  md += `---\n\n`
}

writeFileSync('thread-report.md', md, 'utf8')
console.log(`\nReport → thread-report.md`)
console.log(`\nNext: read the report, then reload the app with threadsRopes flag on.`)
