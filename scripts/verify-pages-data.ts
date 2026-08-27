// Verify the data Pages will render — read-only, no model, no writes.
//
//   npm run verify:pages -- --owner phil@...
//   npm run verify:pages -- --owner <uuid> --sample 40
//
// Pages renders three bodies of derived data, and each can be wrong in its own
// way:
//
//   1. The Concordance supplies the subjects. Its failure is JUNK and SPLITS —
//      an address filed as a place, or "David" living under two kinds so one
//      person's pages arrive as two half-lit piles.
//   2. `spiritual_items` supplies the noticed markings. Its failure is the only
//      one that is a product violation rather than an annoyance: a harvested
//      passage that is NOT verbatim in the entry is a sentence the writer never
//      wrote, attributed to them. "Grounded, or silent" — so this measures the
//      exact-match rate and prints the misses.
//   3. `scripture_refs` supplies the books. Its failure is drift against what
//      the in-code parser finds in the same prose.
//
// Nothing here is a quality SCORE of anyone's journal. Every number is a count
// of a mechanical defect in our own derived tables.

import { readFileSync } from 'node:fs'

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
const sampleArg = args.findIndex((a) => a === '--sample')
const SAMPLE = sampleArg >= 0 ? Number(args[sampleArg + 1]) || 20 : 20

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { requireOwner } = await import('./_owner.ts')
const { buildSubjectIndex, matchSubject, subjectFromItem } = await import(
  '../src/features/pages/subjects.ts'
)
const { parseReferences } = await import('../src/lib/scripture/parse.ts')
const { entryContentLines, asEntryMarkdown } = await import('../src/lib/entryLabels.ts')

interface EntryRow {
  id: string
  created_at: string
  body_markdown: string
}
interface ConcordanceRow {
  id: string
  kind: string
  canonical: string
  surface_forms: string[] | null
  status: string
  source: string
  occurrence_count: number
}
interface ItemRow {
  id: string
  entry_id: string | null
  type: string
  content: string
  source: string
  created_at: string
}
interface RefRow {
  entry_id: string | null
  book_osis: string
}

const rule = (label = ''): void => {
  const line = '-'.repeat(Math.max(0, 78 - label.length - (label ? 1 : 0)))
  console.log(label ? `\n${label} ${line}` : `\n${'-'.repeat(78)}`)
}
const pct = (n: number, of: number): string => (of === 0 ? '--' : `${((n / of) * 100).toFixed(1)}%`)
const snip = (s: string, max = 100): string => {
  const t = (s ?? '').replace(/\s+/g, ' ').trim()
  return t.length <= max ? t : t.slice(0, max - 1) + '...'
}

const owner = await requireOwner()
const sb = supabaseAdmin()

/** Supabase caps a select at 1000 rows; page or the audit lies. */
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
    const rows = (data ?? []) as unknown as T[]
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

const entries = await fetchAll<EntryRow>('entries', 'id, created_at, body_markdown')
const concordance = await fetchAll<ConcordanceRow>(
  'concordance',
  'id, kind, canonical, surface_forms, status, source, occurrence_count, created_at',
)
const items = await fetchAll<ItemRow>(
  'spiritual_items',
  'id, entry_id, type, content, source, created_at',
)
const refs = await fetchAll<RefRow>('scripture_refs', 'entry_id, book_osis, created_at')

const byId = new Map(entries.map((e) => [e.id, e]))
const live = concordance.filter((c) => c.status === 'suggested' || c.status === 'confirmed')

rule('CORPUS')
console.log(`owner            ${owner}`)
console.log(`entries          ${entries.length}`)
console.log(`concordance      ${concordance.length}  (${live.length} live)`)
console.log(`spiritual_items  ${items.length}`)
console.log(`scripture_refs   ${refs.length}`)

// -- 1. Concordance integrity ------------------------------------------------

rule('1 - CONCORDANCE: junk, splits, and whether the counts are true')

function sum(rows: ConcordanceRow[]): number {
  return rows.reduce((n, r) => n + r.occurrence_count, 0)
}

// A SPLIT is the expensive defect: one person under two kinds is one subject
// arriving as two, each with a partial count, and no gesture in the UI can
// merge them because keeping has no merge (by design).
const byCanon = new Map<string, ConcordanceRow[]>()
for (const c of live) {
  const k = c.canonical.trim().toLowerCase()
  byCanon.set(k, [...(byCanon.get(k) ?? []), c])
}
const splits = [...byCanon.entries()]
  .filter(([, rows]) => new Set(rows.map((r) => r.kind)).size > 1)
  .sort((a, b) => sum(b[1]) - sum(a[1]))
console.log(`kind-splits (same name, two kinds):  ${splits.length}`)
for (const [name, rows] of splits.slice(0, SAMPLE)) {
  console.log(
    `  ${name.padEnd(22)} ${rows.map((r) => `${r.kind}(${r.occurrence_count})`).join(' + ')}`,
  )
}
if (splits.length > SAMPLE) console.log(`  ...and ${splits.length - SAMPLE} more`)

// Case damage. The canonical is what the pill PRINTS, so "esther" and
// "CHristian" are visible defects even though matching is case-insensitive.
const NAMEY = new Set(['person', 'place', 'org'])
const lowered = live.filter((c) => NAMEY.has(c.kind) && /^[a-z]/.test(c.canonical))
const interiorCaps = live.filter((c) => /\b[A-Z][a-z]*[A-Z]/.test(c.canonical))
console.log(`\ncanonical starts lowercase (person/place/org): ${lowered.length}`)
console.log(
  '  ' +
    lowered
      .slice()
      .sort((a, b) => b.occurrence_count - a.occurrence_count)
      .slice(0, SAMPLE)
      .map((c) => `${c.canonical}(${c.occurrence_count})`)
      .join('  '),
)
console.log(`\ncanonical has interior capitals: ${interiorCaps.length}`)
console.log('  ' + interiorCaps.slice(0, SAMPLE).map((c) => c.canonical).join('  '))

// Shape junk. Deliberately mechanical -- an address has digits, a weather
// string has a degree sign. No judgement about meaning.
const addressy = live.filter((c) => c.kind === 'place' && /\d/.test(c.canonical))
const weathery = live.filter((c) => /°/.test(c.canonical))
console.log(`\nplaces containing digits (addresses): ${addressy.length}`)
console.log(
  '  ' +
    addressy
      .slice(0, SAMPLE)
      .map((c) => `${snip(c.canonical, 40)}(${c.occurrence_count})`)
      .join('  '),
)
console.log(`\nweather-shaped canonicals: ${weathery.length}`)
console.log('  ' + weathery.slice(0, SAMPLE).map((c) => snip(c.canonical, 30)).join('  '))

/*
 * A surface form that is another subject's canonical.
 *
 * The most dangerous defect in the table, because nothing on screen reveals it:
 * the subject simply lights the wrong pages. "Chicago" carrying "church" lights
 * every page mentioning church; "Esther" carrying "judy" lights one person's
 * pages under another's name. `mergeItems` drops these at read time — this
 * counts how many the extractor is producing.
 */
const canonSet = new Set(live.map((c) => c.canonical.trim().toLowerCase()))
const stolen: { subject: string; form: string }[] = []
for (const c of live) {
  const own = c.canonical.trim().toLowerCase()
  for (const f of c.surface_forms ?? []) {
    const lower = f.trim().toLowerCase()
    if (lower !== own && canonSet.has(lower)) stolen.push({ subject: c.canonical, form: f })
  }
}
console.log(`\nsurface forms that are another subject's name: ${stolen.length}`)
for (const x of stolen.slice(0, SAMPLE)) {
  console.log(`  ${x.subject.padEnd(28)} claims  ${x.form}`)
}
if (stolen.length > SAMPLE) console.log(`  ...and ${stolen.length - SAMPLE} more`)

// Do the stored counts match what will actually light? The pill prints
// occurrence_count; the wall lights whatever matchSubject finds. If those two
// disagree the surface contradicts itself in the same glance.
const index = buildSubjectIndex(entries as unknown as Parameters<typeof buildSubjectIndex>[0])
const checkable = live
  .filter((c) => c.occurrence_count >= 5)
  .sort((a, b) => b.occurrence_count - a.occurrence_count)
const drift: { name: string; stored: number; actual: number }[] = []
for (const c of checkable) {
  const actual = matchSubject(index, subjectFromItem(c as never)).size
  if (actual !== c.occurrence_count) {
    drift.push({ name: `${c.canonical}.${c.kind}`, stored: c.occurrence_count, actual })
  }
}
console.log(
  `\nstored count vs literal re-count (subjects at >=5 entries): ${drift.length} of ${checkable.length} disagree`,
)
console.log(`  ${'subject'.padEnd(30)} ${'stored'.padStart(7)} ${'lights'.padStart(7)}`)
for (const d of drift.slice(0, SAMPLE)) {
  console.log(
    `  ${d.name.slice(0, 30).padEnd(30)} ${String(d.stored).padStart(7)} ${String(d.actual).padStart(7)}`,
  )
}
if (drift.length > SAMPLE) console.log(`  ...and ${drift.length - SAMPLE} more`)

// -- 2. spiritual_items groundedness -----------------------------------------

rule('2 - MARKINGS: is every harvested passage actually in the page?')

const norm = (s: string): string =>
  s
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

let exact = 0
let normalized = 0
let orphan = 0
const notFound: ItemRow[] = []
for (const it of items) {
  const e = it.entry_id ? byId.get(it.entry_id) : undefined
  if (!e) {
    orphan++
    continue
  }
  const raw = asEntryMarkdown(e.body_markdown)
  if (raw.includes(it.content)) exact++
  else if (norm(raw).includes(norm(it.content))) normalized++
  else notFound.push(it)
}
const placed = items.length - orphan
console.log(`items                       ${items.length}`)
console.log(`orphaned (entry gone)       ${orphan}`)
console.log(`verbatim, character-exact   ${exact}  ${pct(exact, placed)}`)
console.log(
  `verbatim after normalising  ${normalized}  ${pct(normalized, placed)}   (quotes/dashes/whitespace only)`,
)
console.log(
  `NOT FOUND in the page       ${notFound.length}  ${pct(notFound.length, placed)}   <-- not the writer's words`,
)

if (notFound.length) {
  const byType = new Map<string, number>()
  for (const it of notFound) byType.set(it.type, (byType.get(it.type) ?? 0) + 1)
  console.log('\n  by kind: ' + [...byType].map(([t, n]) => `${t}=${n}`).join('  '))
  console.log('\n  sample of passages that are not in their page:')
  for (const it of notFound.slice(0, SAMPLE)) {
    console.log(`    . ${snip(it.content, 96)}`)
  }
  if (notFound.length > SAMPLE) console.log(`    ...and ${notFound.length - SAMPLE} more`)
}

// Spray: the harvester caps at 5 per entry. More than that means the cap leaked
// (two runs over one entry), which shows up on the wall as one page carrying a
// dozen identical-looking marks.
const perEntry = new Map<string, ItemRow[]>()
for (const it of items) {
  if (!it.entry_id) continue
  perEntry.set(it.entry_id, [...(perEntry.get(it.entry_id) ?? []), it])
}
const overCap = [...perEntry.entries()].filter(([, v]) => v.length > 5)
console.log(`\npages over the 5-per-entry cap:  ${overCap.length}`)
if (overCap.length) {
  const worst = overCap.sort((a, b) => b[1].length - a[1].length).slice(0, 10)
  console.log('  worst: ' + worst.map(([, v]) => v.length).join(', '))
}

let dupes = 0
for (const [, v] of perEntry) {
  const seen = new Set<string>()
  for (const it of v) {
    const k = `${it.type} ${norm(it.content)}`
    if (seen.has(k)) dupes++
    else seen.add(k)
  }
}
console.log(`duplicate passages on one page: ${dupes}`)

// Dating. The harvest dates a cairn to when it was prayed, not to the scan --
// if that slipped, every noticed marking lands on the wall in 2026.
let misdated = 0
for (const it of items) {
  const e = it.entry_id ? byId.get(it.entry_id) : undefined
  if (!e) continue
  if (it.created_at.slice(0, 10) !== e.created_at.slice(0, 10)) misdated++
}
console.log(`dated differently from their page: ${misdated}  ${pct(misdated, placed)}`)

const bySource = new Map<string, number>()
const typePages = new Map<string, Set<string>>()
for (const it of items) {
  bySource.set(it.source, (bySource.get(it.source) ?? 0) + 1)
  if (!it.entry_id) continue
  const s = typePages.get(it.type) ?? new Set<string>()
  s.add(it.entry_id)
  typePages.set(it.type, s)
}
console.log('\nby source: ' + [...bySource].map(([s, n]) => `${s}=${n}`).join('  '))
console.log('\ndistinct pages carrying each kind (what `look for` will show):')
for (const [t, s] of [...typePages].sort((a, b) => b[1].size - a[1].size)) {
  console.log(`  ${t.padEnd(12)} ${String(s.size).padStart(6)}  ${pct(s.size, entries.length)}`)
}

// -- 3. scripture_refs vs the in-code parser ---------------------------------

rule('3 - SCRIPTURE: stored refs vs what the parser finds now')

const storedPages = new Set(refs.map((r) => r.entry_id).filter(Boolean) as string[])
const parsedPages = new Set<string>()
for (const e of entries) {
  const body = entryContentLines(e.body_markdown).join('\n')
  if (parseReferences(body).length > 0) parsedPages.add(e.id)
}
const onlyStored = [...storedPages].filter((id) => !parsedPages.has(id))
const onlyParsed = [...parsedPages].filter((id) => !storedPages.has(id))
console.log(`pages in scripture_refs      ${storedPages.size}`)
console.log(`pages the parser finds now   ${parsedPages.size}`)
console.log(`stored but no longer parses  ${onlyStored.length}`)
console.log(`parses but never stored      ${onlyParsed.length}`)

rule()
console.log('Nothing was written. This check reads only.\n')
