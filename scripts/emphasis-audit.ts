// Emphasis audit — the gate that decides whether `emphasis` ships as a source
// for the Remember surface.
//
//   npx tsx scripts/emphasis-audit.ts                 # this owner (or the only one)
//   npx tsx scripts/emphasis-audit.ts --owner phil@…  # a specific account
//   npx tsx scripts/emphasis-audit.ts --sample 80     # show more spans to eyeball
//
// The worry: in imported prose, bold is headers, names, and dialogue emphasis at
// least as often as it is significance. If that's what this reports, Remember
// ships on blockquote + /pray + /scripture — which are unambiguous — and drops
// emphasis. So this reads and writes NOTHING; it prints and exits.
//
// It calls the real extractor in src/lib/remember.ts on purpose. An audit that
// measures a throwaway regex tells you about the regex, not about the feature.

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
const SAMPLE = sampleArg >= 0 ? Number(args[sampleArg + 1]) || 50 : 50

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
const { extractEmphasis, extractQuotes, passagesForEntry, MIN_WORDS } = await import(
  '../src/lib/remember.ts'
)
const { parseReferences } = await import('../src/lib/scripture/parse.ts')
const { requireOwner } = await import('./_owner.ts')

interface EntryRow {
  id: string
  created_at: string
  body_markdown: string
}

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length

/**
 * Does this span look like a header rather than a thought?
 *
 * The signature of a header is that it IS the line — nothing else on it — and
 * that it doesn't end like a sentence. "**Morning**" and "**Prayer requests**"
 * match; a bolded sentence inside a paragraph doesn't.
 */
function headerish(span: string, markdown: string): boolean {
  const line = markdown
    .split('\n')
    .find((l) => l.includes(span))
    ?.trim()
  if (!line) return false
  const bare = line.replace(/[*_>#\s]/g, '')
  const isWholeLine = bare === span.replace(/[*_\s]/g, '')
  return isWholeLine && span.length <= 60 && !/[.!?…]$/.test(span.trim())
}

/**
 * Does the span sound like the writer, or like something they copied down?
 *
 * The first audit run got this wrong: it only looked for headers, found 4%, and
 * declared victory. Reading the actual sample showed the real contaminant is
 * quoted scripture and sermon notes — "shepherd the flock of God that is among
 * you," "tribute is given to the priests." Those are bold because they're being
 * transcribed, not because the writer was declaring anything.
 *
 * First-person pronouns are a crude proxy and labelled as such. It's the
 * difference the product cares about: Remember is supposed to hand back what
 * YOU said.
 */
function ownVoice(span: string): boolean {
  return /\b(i|i'm|i've|my|me|mine|we|our|us)\b/i.test(span)
}

/** A clipped phrase rather than a finished thought. */
function fragment(span: string): boolean {
  return !/[.!?…"']$/.test(span.trim())
}

function bar(n: number, max: number, width = 28): string {
  return '█'.repeat(Math.max(0, Math.round((n / Math.max(1, max)) * width)))
}

function pct(n: number, d: number): string {
  return d === 0 ? '  0%' : `${String(Math.round((n / d) * 100)).padStart(3)}%`
}

async function main(): Promise<void> {
  const owner = await requireOwner()
  const sb = supabaseAdmin()

  const entries: EntryRow[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('entries')
      .select('id, created_at, body_markdown')
      .eq('owner', owner)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    entries.push(...(data as EntryRow[]))
    if (data.length < PAGE) break
  }

  if (entries.length === 0) {
    console.log('No entries for this owner.')
    return
  }

  let withEmph = 0
  let withQuote = 0
  const emphAll: { text: string; entry: string }[] = []
  const quoteAll: string[] = []
  let headers = 0

  const lenBuckets = [0, 0, 0, 0, 0] // 1, 2-3, 4-9, 10-25, 26+ words

  for (const e of entries) {
    const md = e.body_markdown ?? ''
    const emph = extractEmphasis(md)
    const quotes = extractQuotes(md)
    if (emph.length) withEmph++
    if (quotes.length) withQuote++

    for (const span of emph) {
      const w = words(span)
      const i = w === 1 ? 0 : w <= 3 ? 1 : w <= 9 ? 2 : w <= 25 ? 3 : 4
      lenBuckets[i] = (lenBuckets[i] ?? 0) + 1
      if (headerish(span, md)) headers++
      emphAll.push({ text: span, entry: e.created_at.slice(0, 10) })
    }
    for (const q of quotes) quoteAll.push(q)
  }

  // Measure what SHIPS, not what the raw regex matched — passagesForEntry is
  // what the surface calls, and it cleans markup and dedupes.
  const shipped = entries.flatMap((e) => passagesForEntry(e))
  const kept = shipped
    .filter((p) => p.source === 'emphasis')
    .map((p) => ({ text: p.text, entry: p.date.slice(0, 10) }))
  const keptQuotes = shipped.filter((p) => p.source === 'quote').map((p) => p.text)

  // Provenance, not just volume.
  //
  // `spiritual_items` looks like a huge free source until you split it: the
  // Altar's harvest (api/_lib/altar.ts) inserts rows with source='scanned',
  // which are MODEL-HARVESTED. Showing those under "what you set apart" would
  // be the app asserting significance it inferred — a Principle 1 and 4
  // violation. Only rows the editor wrote (source IS NULL, from a /pray or
  // /sense block) are writer-declared.
  const H = { count: 'exact' as const, head: true }
  const [declaredRes, scannedRes, scriptureRes] = await Promise.all([
    sb.from('spiritual_items').select('*', H).eq('owner', owner).is('source', null),
    sb.from('spiritual_items').select('*', H).eq('owner', owner).eq('source', 'scanned'),
    sb.from('scripture_refs').select('*', H).eq('owner', owner),
  ])
  const declaredRows = declaredRes.count ?? 0
  const scannedRows = scannedRes.count ?? 0
  const scriptureRows = scriptureRes.count ?? 0

  console.log(`\n  ${entries.length} entries · owner ${owner.slice(0, 8)}…\n`)

  console.log('  COVERAGE')
  console.log(`    entries with emphasis     ${String(withEmph).padStart(6)}  ${pct(withEmph, entries.length)}`)
  console.log(`    entries with a blockquote ${String(withQuote).padStart(6)}  ${pct(withQuote, entries.length)}`)

  console.log('\n  ROW SOURCES — WHO DECLARED THEM')
  console.log(`    /pray, /sense (writer)    ${String(declaredRows).padStart(6)}  usable`)
  console.log(`    altar harvest (model)     ${String(scannedRows).padStart(6)}  EXCLUDED — inferred, not declared`)
  console.log(`    scripture_refs (parsed)   ${String(scriptureRows).padStart(6)}  usable — the writer wrote the citation`)

  console.log('\n  EMPHASIS SPANS')
  const labels = ['1 word', '2-3 words', '4-9 words', '10-25 words', '26+ words']
  const max = Math.max(...lenBuckets)
  lenBuckets.forEach((n, i) => {
    console.log(`    ${labels[i]!.padEnd(12)} ${String(n).padStart(6)}  ${pct(n, emphAll.length)}  ${bar(n, max)}`)
  })
  console.log(`    ${'total'.padEnd(12)} ${String(emphAll.length).padStart(6)}`)

  console.log('\n  WHAT SURVIVES THE FLOOR')
  console.log(`    look like headers/labels  ${String(headers).padStart(6)}  ${pct(headers, emphAll.length)}  of all spans`)
  console.log(`    survive the ${MIN_WORDS}-word floor ${String(kept.length).padStart(6)}  ${pct(kept.length, emphAll.length)}  of all spans`)
  console.log(`    blockquotes surviving     ${String(keptQuotes.length).padStart(6)}`)

  const verse = kept.filter((s) => parseReferences(s.text).length > 0 || !ownVoice(s.text))
  const mine = kept.filter((s) => ownVoice(s.text))
  const frags = kept.filter((s) => fragment(s.text))
  const qMine = keptQuotes.filter(ownVoice)

  console.log('\n  WHOSE WORDS ARE THEY  (first-person as a crude proxy)')
  console.log(`    emphasis in own voice     ${String(mine.length).padStart(6)}  ${pct(mine.length, kept.length)}`)
  console.log(`    emphasis copied/quoted    ${String(verse.length).padStart(6)}  ${pct(verse.length, kept.length)}`)
  console.log(`    emphasis that's a fragment${String(frags.length).padStart(6)}  ${pct(frags.length, kept.length)}`)
  console.log(`    blockquotes in own voice  ${String(qMine.length).padStart(6)}  ${pct(qMine.length, keptQuotes.length)}`)

  // `kept` already comes from passagesForEntry, so the shipped completeness
  // filter has run. This is the surface, not an estimate of it.
  const surfaceTotal = kept.length + keptQuotes.length + declaredRows
  console.log('\n  WHAT REMEMBER ACTUALLY HOLDS  (derived only — before any marks)')
  console.log(`    emphasis, complete        ${String(kept.length).padStart(6)}`)
  console.log(`    blockquotes               ${String(keptQuotes.length).padStart(6)}`)
  console.log(`    declared prayers          ${String(declaredRows).padStart(6)}`)
  console.log(`    scripture (Lamp owns it)  ${String(scriptureRows).padStart(6)}  excluded`)
  console.log(`    ${'─'.repeat(30)}`)
  console.log(`    total passages            ${String(surfaceTotal).padStart(6)}`)
  const years = Math.max(
    1,
    (Date.parse(entries[entries.length - 1]!.created_at) - Date.parse(entries[0]!.created_at)) /
      (365.25 * 864e5),
  )
  console.log(`    over ${years.toFixed(1)} years          ${(surfaceTotal / years).toFixed(0).padStart(6)}  a year`)

  console.log('')
  if (surfaceTotal < 100) {
    console.log(`    → ${surfaceTotal} derived passages. Too thin to open on its own —`)
    console.log('      the mark gesture has to carry the surface.')
  } else {
    console.log(`    → ${surfaceTotal} derived passages seed the surface on day one.`)
    console.log('      Marks accumulate on top of that from re-reading.')
  }

  console.log(`\n  SAMPLE — ${Math.min(SAMPLE, kept.length)} of ${kept.length} surviving spans (read these)\n`)
  const step = Math.max(1, Math.floor(kept.length / SAMPLE))
  for (let i = 0, shown = 0; i < kept.length && shown < SAMPLE; i += step, shown++) {
    const s = kept[i]!
    const t = s.text.length > 96 ? `${s.text.slice(0, 93)}…` : s.text
    console.log(`    ${s.entry}  ${t}`)
  }
  console.log('')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
