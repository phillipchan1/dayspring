// Subject audit — Phase 0 of PAGES_REPLACES_ENTRIES, the gate that decides
// whether "keep the ones you carry" is a gesture or a chore.
//
//   npm run audit:subjects -- --owner phil@…      one account
//   npm run audit:subjects -- --owner <uuid> --sample 40
//
// D-025's second falsifier is the subject model, and six clean names on a
// 47-entry fixture proves nothing about thousands of real pages. So this
// measures the real archive and prints; it reads and WRITES NOTHING.
//
// Three questions, in the order the plan asks them:
//
//   1. How many subjects does the real corpus offer, what does the tail look
//      like, and how much of it is junk?
//   2. The prototype detects names with a mid-sentence-capitalisation regex and
//      claims it is "the same rule the Concordance already runs". Is it? What
//      does each find that the other misses?
//   3. The prototype found that paragraph-scoped matching returns NOTHING for
//      the most useful query on the surface, because people write "her" in the
//      sentence they are praying. Does that hold on a real archive?
//
// Like emphasis-audit.ts it calls the real extractors — `buildSubjectIndex` /
// `matchSubject` from features/pages/subjects.ts and `buildFacetIndex` from
// features/pages/facets.ts — on purpose. An audit that measures a throwaway
// regex tells you about the regex, not about the feature.
//
// Note the tsconfig: app modules import through the `@/` alias, so this runs
// under tsconfig.app.json (the npm script already passes it).

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
const SAMPLE = sampleArg >= 0 ? Number(args[sampleArg + 1]) || 25 : 25

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { requireOwner } = await import('./_owner.ts')
const { buildSubjectIndex, matchSubject, mergeItems, subjectFromItem, withCounts } = await import(
  '../src/features/pages/subjects.ts'
)
const { buildFacetIndex, FACET_PRAYER } = await import('../src/features/pages/facets.ts')
const { parseSpiritualBlocks } = await import('../src/lib/spiritualBlocks.ts')
const { asEntryMarkdown, entryContentLines } = await import('../src/lib/entryLabels.ts')

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
  first_seen: string | null
  last_seen: string | null
}

const rule = (label = ''): void => {
  const line = '─'.repeat(Math.max(0, 78 - label.length - (label ? 1 : 0)))
  console.log(label ? `\n${label} ${line}` : `\n${'─'.repeat(78)}`)
}

const pct = (n: number, of: number): string => (of === 0 ? '—' : `${Math.round((n / of) * 100)}%`)

// ── load ────────────────────────────────────────────────────────────────────

const owner = await requireOwner()
const sb = supabaseAdmin()

/** Supabase caps a select at 1000 rows; page through it or the audit lies. */
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
  'id, kind, canonical, surface_forms, status, source, occurrence_count, first_seen, last_seen, created_at',
)

const withProse = entries.filter((e) => entryContentLines(e.body_markdown).length > 0)

rule('CORPUS')
console.log(`owner              ${owner}`)
console.log(`entries            ${entries.length}  (${withProse.length} with prose)`)
if (entries.length) {
  console.log(
    `span               ${entries[0]!.created_at.slice(0, 10)} → ${entries[entries.length - 1]!.created_at.slice(0, 10)}`,
  )
}

// ── 1. what the Concordance offers ──────────────────────────────────────────
//
// `occurrence_count` is DISTINCT ENTRIES, not mentions (rebuild sets it from
// row.entries.size) — which is the right unit and the same one the prototype
// counts in. A name said nine times in one pour is one day.

rule('1 · WHAT THE CONCORDANCE OFFERS')

const live = concordance.filter((c) => c.status === 'suggested' || c.status === 'confirmed')
console.log(`rows               ${concordance.length}  (${live.length} live, rest superseded/dormant)`)

const byKind = new Map<string, ConcordanceRow[]>()
for (const c of live) {
  const arr = byKind.get(c.kind) ?? []
  arr.push(c)
  byKind.set(c.kind, arr)
}

console.log('\nby kind (live):')
for (const [kind, rows] of [...byKind].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${kind.padEnd(10)} ${String(rows.length).padStart(6)}`)
}

// The floor curve. This is the whole decision: if no floor takes the list from
// "thousands" to "a screenful you'd actually scan", the chapter is a feature
// nobody reaches, and the plan says to say so rather than tune a stop list.
const FLOORS = [1, 2, 3, 5, 10, 20, 50, 100]
console.log('\nfloor curve — subjects appearing in ≥ N distinct entries:')
console.log(`  ${'N'.padStart(4)}  ${'all'.padStart(7)}   ${[...byKind.keys()].sort().map((k) => k.slice(0, 7).padStart(8)).join('')}`)
for (const f of FLOORS) {
  const all = live.filter((c) => c.occurrence_count >= f)
  const per = [...byKind.keys()]
    .sort()
    .map((k) => String(all.filter((c) => c.kind === k).length).padStart(8))
    .join('')
  console.log(`  ${String(f).padStart(4)}  ${String(all.length).padStart(7)}   ${per}`)
}

// ── the same curve, after the repair ────────────────────────────────────────
//
// Everything above counts what the EXTRACTOR recorded, one row per kind. What
// the surface will actually offer is the merged list counted against the
// corpus — so print that too, because it is the number the floor gets chosen
// from. `withCounts` is the expensive call here (one regex per subject across
// every page), which is exactly why the app defers it to the visible rows.
const merged = mergeItems(live as never)
const counted = withCounts(
  buildSubjectIndex(entries as unknown as Parameters<typeof buildSubjectIndex>[0]),
  merged,
)
console.log(`\nafter merging kinds: ${live.length} rows -> ${merged.length} subjects`)
console.log('\nfloor curve on TRUE page counts (what a pill would print):')
for (const f of FLOORS) {
  const at = counted.filter((s) => (s.count ?? 0) >= f)
  const people = at.filter((s) => s.kind === 'person').length
  console.log(
    `  >=${String(f).padStart(4)}  ${String(at.length).padStart(6)} subjects   ${String(people).padStart(4)} people`,
  )
}

// The tail, stated as a share. "How many are one-offs" is the junk question.
const ones = live.filter((c) => c.occurrence_count <= 1).length
console.log(
  `\ntail               ${ones} of ${live.length} (${pct(ones, live.length)}) appear in ≤1 entry`,
)

const confirmed = live.filter((c) => c.status === 'confirmed').length
console.log(`confirmed by hand  ${confirmed}`)

// ── the junk read ───────────────────────────────────────────────────────────
//
// No automated junk score. Whether "Riverside" is a place someone carries or a
// street they mentioned once is not a thing arithmetic knows, and a junk metric
// would be exactly the significance verdict this product doesn't render. So:
// print bands and let a human read them.

rule('   the junk read — sample each band and eyeball it')
const BANDS: [string, (n: number) => boolean][] = [
  ['≥50 entries', (n) => n >= 50],
  ['10–49', (n) => n >= 10 && n < 50],
  ['5–9', (n) => n >= 5 && n < 10],
  ['2–4', (n) => n >= 2 && n < 5],
  ['1 entry', (n) => n <= 1],
]
for (const [label, test] of BANDS) {
  const rows = live.filter((c) => test(c.occurrence_count))
  const shown = rows.slice(0, SAMPLE)
  console.log(`\n  ${label} — ${rows.length} subjects`)
  if (shown.length === 0) continue
  console.log(
    '    ' +
      shown
        .map((c) => `${c.canonical}·${c.kind.slice(0, 2)}(${c.occurrence_count})`)
        .join('  '),
  )
  if (rows.length > shown.length) console.log(`    …and ${rows.length - shown.length} more`)
}

// ── 2. reconcile: the prototype's regex vs the Concordance ──────────────────

rule('2 · RECONCILE — capitalisation regex vs the Concordance')

// Lifted verbatim from prototypes/looking/src/subjects.ts so the comparison is
// against the thing the prototype actually shipped, not a tidied version of it.
const NOT_A_NAME = new Set([
  'The', 'This', 'That', 'There', 'These', 'Those', 'Then', 'Now', 'What', 'When',
  'Why', 'How', 'Where', 'Not', 'And', 'But', 'For', 'Nor', 'Yet', 'She', 'Her',
  'His', 'They', 'Them', 'We', 'You', 'Our', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March',
  'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November',
  'December',
])

const regexPages = new Map<string, Set<string>>()
for (const e of withProse) {
  // Prose only, same as the app's matcher: a pasted psalm's capitals are the
  // Bible's names, not the writer's.
  const text = entryContentLines(e.body_markdown).join(' ')
  const seen = new Set<string>()
  for (const m of text.matchAll(/[a-z,;]\s+([A-Z][a-z]{2,})/g)) {
    const w = m[1]!
    if (!NOT_A_NAME.has(w)) seen.add(w)
  }
  for (const w of seen) {
    const set = regexPages.get(w) ?? new Set<string>()
    set.add(e.id)
    regexPages.set(w, set)
  }
}

const regexAt = (f: number): string[] =>
  [...regexPages.entries()]
    .filter(([, ids]) => ids.size >= f)
    .sort((a, b) => b[1].size - a[1].size)
    .map(([w]) => w)

console.log('capitalisation regex over the same corpus:')
for (const f of [2, 4, 10, 20, 50]) {
  console.log(`  ≥${String(f).padStart(3)} entries   ${String(regexAt(f).length).padStart(6)} words`)
}
console.log(`\n  top ${SAMPLE} by entry count:`)
console.log(
  '    ' +
    [...regexPages.entries()]
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, SAMPLE)
      .map(([w, ids]) => `${w}(${ids.size})`)
      .join('  '),
)

// The claim under test: "same rule the Concordance already runs". It isn't —
// api/_lib/concordance.ts extracts with a model under a charter prompt. So this
// is a comparison of two DIFFERENT engines, and the overlap is the finding.
const conNames = new Set(
  live
    .filter((c) => c.kind === 'person' || c.kind === 'place')
    .flatMap((c) => [c.canonical, ...(c.surface_forms ?? [])])
    .map((s) => s.toLowerCase()),
)
const regexFloor2 = regexAt(2)
const both = regexFloor2.filter((w) => conNames.has(w.toLowerCase()))
const regexOnly = regexFloor2.filter((w) => !conNames.has(w.toLowerCase()))

console.log(`\noverlap at regex floor 2 (vs live person+place spellings):`)
console.log(`  regex words            ${regexFloor2.length}`)
console.log(`  also in Concordance    ${both.length}  (${pct(both.length, regexFloor2.length)})`)
console.log(`  regex only             ${regexOnly.length}`)
console.log(`\n  regex-only sample (what a capitalisation rule adds — or invents):`)
console.log('    ' + regexOnly.slice(0, SAMPLE * 2).join('  '))

const conOnly = [...byKind.get('person') ?? []]
  .filter((c) => c.occurrence_count >= 2 && !regexPages.has(c.canonical))
  .sort((a, b) => b.occurrence_count - a.occurrence_count)
console.log(`\n  people the Concordance has that the regex never sees: ${conOnly.length}`)
console.log(
  '    ' + conOnly.slice(0, SAMPLE).map((c) => `${c.canonical}(${c.occurrence_count})`).join('  '),
)

// ── 3. the pronoun finding, on a real archive ───────────────────────────────

rule('3 · SCOPE — does the pronoun finding hold outside the fixture?')

const entryObjs = withProse.map((e) => ({
  id: e.id,
  body_markdown: e.body_markdown,
})) as unknown as Parameters<typeof buildSubjectIndex>[0]

const index = buildSubjectIndex(entryObjs)
const facets = buildFacetIndex(entryObjs)

/** Prayer text per entry, plus the paragraph that runs into it. */
const prayerScope = new Map<string, string>()
for (const e of withProse) {
  const raw = asEntryMarkdown(e.body_markdown)
  const blocks = parseSpiritualBlocks(raw).filter((b) => b.type === 'prayer')
  if (blocks.length === 0) continue
  const parts: string[] = []
  for (const b of blocks) {
    parts.push(b.content)
    // Generous paragraph scoping: the prose paragraph immediately before the
    // block counts too. If even THIS returns nothing, literal scoping is not
    // strict, it is blind.
    const before = raw.slice(0, b.from).trimEnd()
    const para = before.split(/\n\s*\n/).pop()
    if (para) parts.push(para)
  }
  prayerScope.set(e.id, parts.join('\n').toLowerCase())
}

const prayerEntries = new Set(
  [...facets.byEntry].filter(([, set]) => set.has(FACET_PRAYER)).map(([id]) => id),
)

// How much marking there is to narrow BY. On an imported archive the answer can
// be "almost none" — the markings are a Dayspring gesture and the pages predate
// it — and a `look for` group whose every option reads (0) is a group that
// should not be on screen. Phase 2 needs this number before it designs the bar.
console.log('markings across the corpus (pages carrying each):')
for (const [key, n] of [...facets.counts].sort((a, b) => b[1] - a[1])) {
  if (key.includes(':')) continue // the refinements; the coarse facets are the question here
  console.log(`  ${key.padEnd(12)} ${String(n).padStart(6)}  ${pct(n, withProse.length)}`)
}
console.log(`\npages carrying a /pray block: ${prayerEntries.size}`)

const people = (byKind.get('person') ?? [])
  .filter((c) => c.occurrence_count >= 2)
  .sort((a, b) => b.occurrence_count - a.occurrence_count)
  .slice(0, 12)

console.log(`\n  ${'subject'.padEnd(18)} ${'pages'.padStart(6)} ${'× prayer'.padStart(9)} ${'para-scoped'.padStart(12)}`)
for (const c of people) {
  const subject = subjectFromItem(c as never)
  const hit = matchSubject(index, subject)
  const entryScoped = [...hit].filter((id) => prayerEntries.has(id))
  const re = new RegExp(
    `(^|[^a-z0-9])(${subject.terms
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length >= 2)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})([^a-z0-9]|$)`,
    'i',
  )
  const paraScoped = entryScoped.filter((id) => {
    const scope = prayerScope.get(id)
    return scope ? re.test(scope) : false
  })
  console.log(
    `  ${subject.label.slice(0, 18).padEnd(18)} ${String(hit.size).padStart(6)} ${String(entryScoped.length).padStart(9)} ${String(paraScoped.length).padStart(12)}`,
  )
}

console.log(
  `\n  Read the last two columns against each other. Entry-scoped is what the\n` +
    `  plan builds; paragraph-scoped is the version that lost the pronouns.`,
)

rule()
console.log('Nothing was written. This audit reads only.\n')
