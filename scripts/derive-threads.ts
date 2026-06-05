// Derive reflective threads from GPT-extracted topics in insights rollups.
//
// Approach (two-level):
//   1. Read all weekly rollups → extract per-period topic labels (already GPT-extracted)
//   2. Embed unique labels + embed lens descriptions → assign every label to a lens
//      by nearest-neighbor (no extra API calls — pure cosine distance)
//   3. Within each lens, cluster similar labels (same theme, varied phrasing)
//   4. A thread = a label cluster that recurs across ≥ MIN_PERIODS periods
//   5. Label survivors with GPT nano → write to threads table + thread-report.md
//
// Why two-level:
//   GPT names weekly topics with varied phrasing. "frontier work & leadership",
//   "Frontier team & leadership", "frontier work & SCE work" are the same thread
//   but never cluster because each appears once. Assigning to a lens first groups
//   them into the same search space; the lower within-lens threshold then merges them.
//
//   npx tsx scripts/derive-threads.ts --dry   # report only, no writes
//   npx tsx scripts/derive-threads.ts         # label + write threads table + report

// ── config ────────────────────────────────────────────────────────────────────

const TOPIC_SIM_THRESHOLD = 0.75  // within-lens clustering threshold (lower = more merging)
const MIN_PERIODS = 3             // thread must appear in ≥ N distinct weekly rollups
const MIN_SPAN_WEEKS = 3          // thread must span ≥ N distinct calendar weeks
const REP_ENTRIES = 6             // representative entries shown per thread in report
const LABEL_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-nano'

// Stopwords: structural/format labels that aren't real threads.
const LABEL_STOPWORDS = [
  'morning jesus', 'morning prayer', 'daily prayer', 'prayer routine',
  'morning devotion', 'start of day', 'morning journal',
]

// Lens taxonomy. Order matters slightly — first match wins when ties.
// Descriptions are embedded; every topic label is assigned to the nearest lens.
const LENSES = [
  { key: 'prayer',          label: 'Prayer',          desc: 'prayer, seeking God, intercession, devotion, presence of God, asking God' },
  { key: 'scripture',       label: 'Scripture',       desc: 'Bible reading, verses, studying Scripture, word of God, devotional reading' },
  { key: 'personal_growth', label: 'Personal growth', desc: 'purity, character, discipline, identity, self-control, temptation, holiness, sexual sin, repentance, spiritual maturity' },
  { key: 'trading',         label: 'Trading',         desc: 'options trading, stock market, playbook, trading discipline, trade execution, financial stewardship, trading account, backtesting' },
  { key: 'calling_work',    label: 'Calling & work',  desc: 'Frontier, Dayspring, vocation, building, leadership, work, startup, technology, product, app development, SCE, ministry work, career, mission' },
  { key: 'family',          label: 'Family',          desc: 'Esther wife, kids, children, marriage, parenting, newborn, family life, home' },
  { key: 'relationships',   label: 'Relationships',   desc: 'friendships, discipleship, mentoring, community, small group, people, conversations, conflict, reconciliation' },
  { key: 'health',          label: 'Health',          desc: 'physical health, rest, fitness, sleep, tiredness, wired and tired, body, exercise, walking' },
  { key: 'emotions',        label: 'Emotions',        desc: 'anxiety, discouragement, gratitude, joy, fear, peace, stress, pressure, overwhelm, encouragement' },
  { key: 'ministry',        label: 'Ministry',        desc: 'church, kids ministry, worship leading, preaching, church leadership, ministry teams, Sunday, volunteers, elder board' },
  { key: 'provision',       label: 'Provision',       desc: 'finances, money, trust in God for provision, financial stress, income, abundance, scarcity, enough' },
  { key: 'other',           label: 'Other',           desc: 'miscellaneous topics that do not fit any other category' },
] as const

type LensKey = typeof LENSES[number]['key']

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

interface RollupPayload { topics?: { label: string; count: number; entry_ids: string[] }[] }
interface Rollup { period_start: string; period_end: string; structured_payload: RollupPayload }

interface TopicOcc {
  label: string
  norm: string       // lowercased
  lensKey: LensKey
  periodStart: string
  entryIds: string[]
}

interface Thread {
  canonicalLabel: string
  allLabels: string[]
  lensKey: LensKey
  occurrences: TopicOcc[]
  entryIds: string[]
  spanStart: Date
  spanEnd: Date
  spanWeeks: number
  periods: number
  embedding: number[]
  // filled after labeling:
  finalLabel: string
  lenses: string[]
  oneLineWhy: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function l2norm(v: number[]): number[] {
  let mag = 0; for (const x of v) mag += x * x; mag = Math.sqrt(mag)
  return mag === 0 ? v : v.map((x) => x / mag)
}

function isoWeek(d: Date): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const thu = new Date(day); thu.setUTCDate(thu.getUTCDate() - ((thu.getUTCDay() + 6) % 7) + 3)
  const ys = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
  return `${thu.getUTCFullYear()}-W${String(Math.ceil(((thu.getTime() - ys.getTime()) / 86_400_000 + 1) / 7)).padStart(2, '0')}`
}

function snippet(text: string, max = 200): string {
  const c = text.replace(/\s+/g, ' ').trim(); return c.length <= max ? c : c.slice(0, max - 1) + '…'
}

class UnionFind {
  private p = new Map<number, number>()
  find(x: number): number {
    if (!this.p.has(x)) this.p.set(x, x)
    const p = this.p.get(x)!; if (p !== x) this.p.set(x, this.find(p)); return this.p.get(x)!
  }
  union(x: number, y: number) { this.p.set(this.find(x), this.find(y)) }
  components(n: number): Map<number, number[]> {
    const g = new Map<number, number[]>()
    for (let i = 0; i < n; i++) { const r = this.find(i); g.set(r, [...(g.get(r) ?? []), i]) }
    return g
  }
}

// ── 1. load rollups ───────────────────────────────────────────────────────────

console.log('Loading weekly rollups…')
const rollups: Rollup[] = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb
    .from('insights').select('period_start, period_end, structured_payload')
    .eq('owner', owner).eq('type', 'weekly')
    .order('period_start', { ascending: true }).range(from, from + 499)
  if (error) throw error
  if (!data?.length) break
  rollups.push(...(data as Rollup[])); if (data.length < 500) break
}
console.log(`Loaded ${rollups.length} weekly rollups.`)

// ── 2. extract + dedupe topic labels ─────────────────────────────────────────

const rawOccs: Omit<TopicOcc, 'lensKey'>[] = []
for (const r of rollups) {
  for (const t of r.structured_payload?.topics ?? []) {
    const label = (t.label ?? '').trim()
    if (!label || !t.entry_ids?.length) continue
    if (LABEL_STOPWORDS.some((w) => label.toLowerCase().includes(w))) continue
    rawOccs.push({ label, norm: label.toLowerCase(), periodStart: r.period_start, entryIds: t.entry_ids })
  }
}
const uniqueLabels = [...new Set(rawOccs.map((o) => o.norm))]
console.log(`${rawOccs.length} occurrences · ${uniqueLabels.length} unique labels`)

// ── 3. embed labels + lens descriptions ──────────────────────────────────────

console.log('Embedding labels and lens descriptions…')
const [labelVecsRaw, lensVecsRaw] = await Promise.all([
  embed(uniqueLabels),
  embed(LENSES.map((l) => l.desc)),
])
const labelVec = new Map<string, number[]>()
uniqueLabels.forEach((l, i) => labelVec.set(l, l2norm(labelVecsRaw[i]!)))
const lensVecs = lensVecsRaw.map((v) => l2norm(v))

// ── 4. assign each label to nearest lens ─────────────────────────────────────

const labelLens = new Map<string, LensKey>()
for (const [label, vec] of labelVec) {
  let best: LensKey = 'other'; let bestSim = -1
  for (let i = 0; i < LENSES.length; i++) {
    const sim = cosine(vec, lensVecs[i]!)
    if (sim > bestSim) { bestSim = sim; best = LENSES[i]!.key }
  }
  labelLens.set(label, best)
}

const occs: TopicOcc[] = rawOccs.map((o) => ({ ...o, lensKey: labelLens.get(o.norm) ?? 'other' }))

// Show lens assignment distribution
const lensCounts = new Map<string, number>()
for (const o of occs) lensCounts.set(o.lensKey, (lensCounts.get(o.lensKey) ?? 0) + 1)
console.log('\nLens distribution:')
for (const [k, n] of [...lensCounts.entries()].sort((a, b) => b[1] - a[1])) {
  const lens = LENSES.find((l) => l.key === k)!
  console.log(`  ${String(n).padStart(4)}  ${lens.label}`)
}

// ── 5. cluster within each lens ───────────────────────────────────────────────

console.log(`\nClustering within each lens at threshold ${TOPIC_SIM_THRESHOLD}…`)
const threads: Thread[] = []

for (const lens of LENSES) {
  const lensOccs = occs.filter((o) => o.lensKey === lens.key)
  const lensLabels = [...new Set(lensOccs.map((o) => o.norm))]
  if (lensLabels.length === 0) continue

  const vecs = lensLabels.map((l) => labelVec.get(l)!)
  const uf = new UnionFind()
  for (let i = 0; i < lensLabels.length; i++)
    for (let j = i + 1; j < lensLabels.length; j++)
      if (cosine(vecs[i]!, vecs[j]!) >= TOPIC_SIM_THRESHOLD) uf.union(i, j)

  for (const [, indices] of uf.components(lensLabels.length)) {
    const clusterLabels = indices.map((i) => lensLabels[i]!)
    const clusterOccs = lensOccs.filter((o) => clusterLabels.includes(o.norm))
    const periods = new Set(clusterOccs.map((o) => o.periodStart))
    const entryIds = [...new Set(clusterOccs.flatMap((o) => o.entryIds))]
    const dates = [...periods].map((p) => new Date(p))
    const weeks = new Set(clusterOccs.map((o) => isoWeek(new Date(o.periodStart))))

    if (periods.size < MIN_PERIODS || weeks.size < MIN_SPAN_WEEKS) continue

    const spanStart = new Date(Math.min(...dates.map((d) => d.getTime())))
    const spanEnd = new Date(Math.max(...dates.map((d) => d.getTime())))

    const freq = new Map<string, number>()
    for (const o of clusterOccs) freq.set(o.label, (freq.get(o.label) ?? 0) + 1)
    const canonicalLabel = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]![0]

    const emb = l2norm(centroid(indices.map((i) => vecs[i]!)))
    threads.push({
      canonicalLabel,
      allLabels: [...new Set(clusterOccs.map((o) => o.label))],
      lensKey: lens.key,
      occurrences: clusterOccs,
      entryIds,
      spanStart, spanEnd,
      spanWeeks: weeks.size,
      periods: periods.size,
      embedding: emb,
      finalLabel: '', lenses: [], oneLineWhy: '',
    })
  }
}

threads.sort((a, b) => b.periods - a.periods || b.entryIds.length - a.entryIds.length)

// ── 6. dry-run report ─────────────────────────────────────────────────────────

console.log(`\n── Thread report ───────────────────────────────────────────────`)
console.log(`  TOPIC_SIM_THRESHOLD: ${TOPIC_SIM_THRESHOLD}`)
console.log(`  Threads (pass floor): ${threads.length}  (≥${MIN_PERIODS} periods, ≥${MIN_SPAN_WEEKS} weeks)`)
console.log(`\nThreads by recurrence:`)
for (const t of threads) {
  const lens = LENSES.find((l) => l.key === t.lensKey)!.label
  const span = `${t.spanStart.toISOString().slice(0,7)} → ${t.spanEnd.toISOString().slice(0,7)}`
  const variants = t.allLabels.filter((l) => l !== t.canonicalLabel).slice(0, 2).join(', ')
  console.log(`  [${lens}]  "${t.canonicalLabel}"  ·  ${t.periods}p · ${t.spanWeeks}w · ${span}${variants ? `  [+${variants}]` : ''}`)
}

if (DRY) {
  console.log(`\n--dry: nothing written. Drop --dry to label and write.`)
  process.exit(0)
}

// ── 7. fetch representative entries ──────────────────────────────────────────

import OpenAI from 'openai'
const oai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, maxRetries: 5 })

const allIds = [...new Set(threads.flatMap((t) => t.entryIds))]
console.log(`\nFetching ${allIds.length} entry bodies…`)
const entryMap = new Map<string, { body_markdown: string; created_at: string }>()
for (let from = 0; from < allIds.length; from += 200) {
  const { data } = await sb.from('entries').select('id, body_markdown, created_at')
    .in('id', allIds.slice(from, from + 200)).eq('owner', owner)
  for (const r of data ?? []) entryMap.set(r.id, r)
}

// ── 8. label threads ──────────────────────────────────────────────────────────

console.log(`Labeling ${threads.length} threads with ${LABEL_MODEL}…\n`)

interface ThreadRow {
  owner: string; label: string; lenses: string[]
  member_entry_ids: string[]; weight: number; breadth: number
  span_start: string; span_end: string; sim_threshold: number; one_line_why: string
}

const rows: { thread: Thread; row: ThreadRow }[] = []

for (let i = 0; i < threads.length; i++) {
  const t = threads[i]!
  const lensLabel = LENSES.find((l) => l.key === t.lensKey)!.label
  process.stdout.write(`  [${i + 1}/${threads.length}] [${lensLabel}] "${t.canonicalLabel}" (${t.periods}p)… `)

  const withEntry = t.entryIds
    .map((id) => ({ id, e: entryMap.get(id) }))
    .filter((x): x is { id: string; e: { body_markdown: string; created_at: string } } => !!x.e)
    .sort((a, b) => b.e.created_at.localeCompare(a.e.created_at))
  const reps = withEntry.slice(0, REP_ENTRIES)
  const snippets = reps.map((x) => `[${x.e.created_at.slice(0,10)}] ${snippet(x.e.body_markdown, 300)}`).join('\n\n')

  const prompt = `You are helping a journal author name a recurring thread in their writing.

Lens / domain: "${lensLabel}"
GPT labelled this thread across ${t.periods} weekly periods as: ${t.allLabels.slice(0,6).map((l)=>`"${l}"`).join(', ')}
Span: ${t.spanStart.toISOString().slice(0,10)} to ${t.spanEnd.toISOString().slice(0,10)}

Representative entries (${reps.length}):
${snippets}

Give this thread:
1. A SHORT LABEL in the author's own recurring phrasing — drawn from what they actually wrote, not your interpretation. 5–8 words max. NOT "your X" or "you Y."
2. The specific sub-lenses it touches within "${lensLabel}" (1–3 words each, from the entries).
3. One sentence: what recurring question or situation ties these entries, in the author's words.

Return ONLY valid JSON, no markdown fences:
{"label":"...","lenses":["..."],"oneLineWhy":"..."}`

  try {
    const res = await oai.chat.completions.create({
      model: LABEL_MODEL, temperature: 0.2, max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = (res.choices[0]?.message?.content ?? '').trim()
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim()) as { label: string; lenses: string[]; oneLineWhy: string }
    if (!parsed.label || !Array.isArray(parsed.lenses)) throw new Error('bad shape')

    t.finalLabel = parsed.label; t.lenses = [lensLabel, ...parsed.lenses]; t.oneLineWhy = parsed.oneLineWhy ?? ''
    rows.push({ thread: t, row: {
      owner, label: parsed.label,
      lenses: [lensLabel, ...parsed.lenses],
      member_entry_ids: t.entryIds, weight: t.entryIds.length,
      breadth: 1 + parsed.lenses.length,
      span_start: t.spanStart.toISOString(), span_end: t.spanEnd.toISOString(),
      sim_threshold: TOPIC_SIM_THRESHOLD, one_line_why: parsed.oneLineWhy ?? '',
    }})
    console.log(`✓ "${parsed.label}"`)
  } catch (err) {
    console.log(`✗ skipped (${err instanceof Error ? err.message : err})`)
  }
}

// ── 9. write to threads table ─────────────────────────────────────────────────

if (!rows.length) { console.log('\nNo threads labeled.'); process.exit(0) }

await sb.from('threads').delete().eq('owner', owner).eq('sim_threshold', TOPIC_SIM_THRESHOLD)
const { error } = await sb.from('threads').insert(rows.map((r) => r.row))
if (error) throw error
console.log(`\nWrote ${rows.length} threads.`)

// ── 10. thread-report.md ──────────────────────────────────────────────────────

let md = `# Thread Report\n\nGenerated: ${new Date().toISOString().slice(0,19).replace('T',' ')} UTC  \n`
md += `TOPIC_SIM_THRESHOLD: ${TOPIC_SIM_THRESHOLD} · MIN_PERIODS: ${MIN_PERIODS} · MIN_SPAN_WEEKS: ${MIN_SPAN_WEEKS}  \n`
md += `${rows.length} threads\n\n---\n\n`

for (const { thread: t, row } of [...rows].sort((a, b) => b.thread.periods - a.thread.periods)) {
  const withEntry = t.entryIds
    .map((id) => ({ id, e: entryMap.get(id) }))
    .filter((x): x is { id: string; e: { body_markdown: string; created_at: string } } => !!x.e)
    .sort((a, b) => b.e.created_at.localeCompare(a.e.created_at))

  md += `## [${LENSES.find((l)=>l.key===t.lensKey)!.label}] ${row.label}\n\n`
  md += `- **Periods**: ${t.periods} weeks\n- **Span**: ${t.spanStart.toISOString().slice(0,10)} → ${t.spanEnd.toISOString().slice(0,10)}\n`
  md += `- **Entries**: ${row.weight}\n- **Lenses**: ${row.lenses.join(', ')}\n`
  md += `- **Why**: ${row.one_line_why}\n- **GPT called it**: ${t.allLabels.slice(0,6).map((l)=>`"${l}"`).join(', ')}\n\n`
  md += `### Representative entries\n\n`
  for (const { e } of withEntry.slice(0, REP_ENTRIES))
    md += `**${e.created_at.slice(0,10)}**\n> ${snippet(e.body_markdown, 400)}\n\n`
  md += `---\n\n`
}

writeFileSync('thread-report.md', md, 'utf8')
console.log(`Report → thread-report.md\n\nNext: reload the app with threadsRopes flag on and ⌘2.`)
