// One-time backfill: give every marking a position in the page it came from.
//
//   npx tsx scripts/backfill-positions.ts --dry     # measure only, write nothing
//   npx tsx scripts/backfill-positions.ts           # locate + write char offsets
//   npx tsx scripts/backfill-positions.ts --refs    # also prune refs the parser
//                                                   # no longer admits
//
// Declared blocks get their offsets from the save-time reconcile, which knows
// them exactly. Harvested rows have no fence, so they are located the only way
// they can be: by finding their own verbatim text in the body. That search is
// the honest measure of the harvest's verbatim guarantee — a row that cannot be
// found is a sentence attributed to a writer who did not write it in those
// words, and this prints how many there are rather than papering over them.
//
// Runs LOCALLY with the service-role key. Never modifies any entry's text.
// Requires migration 20260829120000_marking_positions.sql to be applied first.

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
const DRY = args.includes('--dry')
const DO_REFS = args.includes('--refs')

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { parseReferences } = await import('../src/lib/scripture/parse.ts')
const { requireOwner } = await import('./_owner.ts')
const owner = await requireOwner()
const sb = supabaseAdmin()

interface EntryRow { id: string; body_markdown: string }
interface ItemRow { id: string; entry_id: string | null; type: string; content: string; source: string | null }

async function pageAll<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table).select(cols).eq('owner', owner).range(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

const entries = await pageAll<EntryRow>('entries', 'id, body_markdown')
const items = await pageAll<ItemRow>('spiritual_items', 'id, entry_id, type, content, source')
const bodies = new Map(entries.map((e) => [e.id, e.body_markdown ?? '']))

console.log(`\nentries ${entries.length}   markings ${items.length}\n`)

// ── locate ───────────────────────────────────────────────────────────────────
// Exact substring first. A harvested passage is supposed to be character-exact;
// where it is not, whitespace is the usual culprit (a soft-wrapped paste), so a
// whitespace-flexible second pass is tried before giving up. Nothing looser —
// a fuzzy match would place a marking at a line the writer never wrote it on,
// and a marking in the wrong place is worse than one with no position at all.
function locate(body: string, content: string): [number, number] | null {
  const needle = content.trim()
  if (needle.length < 12) return null
  const exact = body.indexOf(needle)
  if (exact !== -1) return [exact, exact + needle.length]
  const rx = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'))
  const m = rx.exec(body)
  return m ? [m.index, m.index + m[0].length] : null
}

const updates: { id: string; char_start: number; char_end: number }[] = []
const stats = { exact: 0, flexible: 0, tooShort: 0, orphan: 0, notFound: 0, ambiguous: 0 }
const misses: ItemRow[] = []

for (const it of items) {
  if (!it.entry_id) { stats.orphan++; continue }
  const body = bodies.get(it.entry_id)
  if (body === undefined) { stats.orphan++; continue }
  const needle = (it.content ?? '').trim()
  if (needle.length < 12) { stats.tooShort++; continue }
  const hit = locate(body, needle)
  if (!hit) { stats.notFound++; if (misses.length < 8) misses.push(it); continue }
  if (body.indexOf(needle) !== -1) {
    stats.exact++
    if (body.indexOf(needle, hit[0] + 1) !== -1) stats.ambiguous++
  } else stats.flexible++
  updates.push({ id: it.id, char_start: hit[0], char_end: hit[1] })
}

const locatable = stats.exact + stats.flexible
console.log('locating markings in the page they came from')
console.log(`  exact verbatim match      ${stats.exact}`)
console.log(`  matched only on whitespace ${stats.flexible}`)
console.log(`  text no longer in the body ${stats.notFound}`)
console.log(`  under 12 chars, unlocatable ${stats.tooShort}`)
console.log(`  no entry to be located in  ${stats.orphan}`)
console.log(`  → locatable ${locatable}/${items.length} (${((100 * locatable) / Math.max(1, items.length)).toFixed(1)}%)`)
if (stats.ambiguous) console.log(`  (${stats.ambiguous} appear more than once on their page; first occurrence used)`)

if (misses.length) {
  console.log('\n  misses — harvested text that is not in the page as stored:')
  for (const m of misses) console.log(`    ${m.type.padEnd(9)} ${JSON.stringify(m.content.slice(0, 72))}`)
}

if (!DRY) {
  // Errors are checked, not assumed away. A first version fired 200 updates at
  // once inside a bare Promise.all and reported every one as written; 852 had
  // silently failed, and the only reason it surfaced was counting the rows
  // afterwards. A backfill that lies about what it wrote is worse than one that
  // does nothing.
  let done = 0
  let failed = 0
  const CONCURRENCY = 25
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const chunk = updates.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      chunk.map(async (u) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const { error } = await sb
            .from('spiritual_items')
            .update({ char_start: u.char_start, char_end: u.char_end })
            .eq('id', u.id)
          if (!error) return true
          await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
        }
        return false
      }),
    )
    for (const ok of results) if (!ok) failed++
    done += chunk.length
    process.stdout.write(`\r  writing ${done}/${updates.length}${failed ? `  (${failed} failed)` : ''}`)
  }
  console.log(`\n  wrote ${updates.length - failed} positions${failed ? `, ${failed} FAILED` : ''}`)
} else {
  console.log(`\n  --dry: ${updates.length} positions would be written`)
}

// ── refs the parser no longer admits ─────────────────────────────────────────
//
// "The parser does not emit this any more" is NOT grounds for deletion, and
// finding that out the hard way is the reason this section is shaped the way it
// is. Of the 17 refs the current parser declines on the real archive, 13 are
// REAL — "Proverbs 12 says that lying lips are an abomination", "Reading
// Numbers 25", "Mark 15 Jesus delivered over to pilate". The parser refuses
// them on purpose: `proverbs`, `numbers` and `mark` are ordinary English words,
// so AMBIGUOUS_FORMS wants a verse before it will believe them (the known
// `ambiguous-word-needs-verse` defect). An older, looser parser captured them,
// and they are the writer's real reading history.
//
// So the prune is by DEMONSTRATED defect, never by absence:
//
//   · measurement — the stored ref sits on a number wearing a unit. "loving
//     reading Jeremiah     48.1°F" became Jer.48.1; the weather footer of an
//     imported journal became scripture.
//   · person — a book name this writer uses for a person, admitted before and
//     refused once their name is declared (`--persons esther,ruth`).
//
// Anything else the parser cannot reproduce is REPORTED and left alone.
if (DO_REFS) {
  interface RefRow { id: string; entry_id: string; osis_ref: string; source: string; status: string; char_start: number | null }
  const personsArg = args.find((a) => a.startsWith('--persons='))
  const persons = personsArg ? personsArg.slice('--persons='.length).split(',').filter(Boolean) : []

  const refs = await pageAll<RefRow>('scripture_refs', 'id, entry_id, osis_ref, source, status, char_start')
  // Only prose-derived refs are the parser's to withdraw. A `manual` or
  // `suggested` ref is the writer's own and reconcile has never pruned those.
  const derived = refs.filter((r) => ['parsed', 'inline', 'command'].includes(r.source))

  // Anchored on the span the parser actually consumed, not loose over the body.
  //
  // Two wrong versions came first and both would have deleted real history.
  // Testing the whole body classed "Reading Numbers 25" as fabricated because
  // the entry merely ended in a weather footer. Restricting to one line then
  // matched nothing at all — the separator IS newlines: the parser's `\s*` lets
  // a book name at the end of a paragraph bind to a number three blank lines
  // below it, which is how "…loving reading Jeremiah\n\n\n\n\n48.1°F" became
  // Jer.48.1.
  //
  // So: book token, whatever whitespace, the digits the parser took, and a unit
  // hanging off them. A genuine "Mark 15" followed by a footer does not match —
  // nothing separates its chapter from the footer's number, so the two cannot
  // be read as one reference.
  const MEASURED = /^\S+[\s\S]{0,8}?\d{1,3}(?:[.:]\s*\d{1,3})*\s*[°%℉℃]/
  const fabricated: RefRow[] = []
  const byPerson: RefRow[] = []
  const unreproducible: RefRow[] = []

  for (const r of derived) {
    const body = bodies.get(r.entry_id)
    if (body === undefined) continue
    const plain = parseReferences(body).map((p) => p.osis_ref)
    if (plain.includes(r.osis_ref)) {
      if (persons.length) {
        const kept = parseReferences(body, { personForms: persons }).map((p) => p.osis_ref)
        if (!kept.includes(r.osis_ref)) byPerson.push(r)
      }
      continue
    }
    // Absent now. Was it a measurement misread as a chapter?
    const at = r.char_start
    if (at != null && MEASURED.test(body.slice(at))) fabricated.push(r)
    else unreproducible.push(r)
  }

  console.log(`\nscripture refs — ${derived.length} prose-derived`)
  console.log(`  fabricated from a measurement       ${fabricated.length}  ${JSON.stringify(fabricated.map((f) => f.osis_ref))}`)
  if (persons.length)
    console.log(`  a person's name, not the book       ${byPerson.length}  ${JSON.stringify(byPerson.map((f) => f.osis_ref))}`)
  console.log(`  parser declines but the ref is real ${unreproducible.length}  ${JSON.stringify(unreproducible.map((f) => f.osis_ref))}`)
  console.log('    ^ left alone — these are the ambiguous-word-needs-verse defect, not junk')

  const doomed = [...fabricated, ...byPerson]
  if (!DRY && doomed.length) {
    for (let i = 0; i < doomed.length; i += 100) {
      const ids = doomed.slice(i, i + 100).map((d) => d.id)
      const { error } = await sb.from('scripture_refs').delete().in('id', ids)
      if (error) throw error
    }
    console.log(`  deleted ${doomed.length}`)
    // Several of these were a real reference fused with a footer — "John 3."
    // plus "48.2°F" became John.3.2. The parser now reads that same page as
    // John.3, so the reading is recovered, not lost, once refs are re-captured.
    console.log('  run `npm run backfill:scripture` to re-capture the pages they came from')
  } else if (doomed.length) {
    console.log(`  --dry: ${doomed.length} would be deleted`)
  }
}

console.log('')
