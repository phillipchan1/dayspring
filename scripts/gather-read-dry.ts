// Dry run for the stored entry read (GATHER_READ, D-035). Writes nothing to the
// database, ever. Run it before turning the flag on.
//
//   npx tsx scripts/gather-read-dry.ts --owner <uuid|email>              # PLAN: $0, no model calls
//   npx tsx scripts/gather-read-dry.ts --all                             # PLAN for every account
//   npx tsx scripts/gather-read-dry.ts --owner <..> --sample 10          # READ 10 pages, store nothing
//   npx tsx scripts/gather-read-dry.ts --owner <..> --sample 10 --usd-in 0.05 --usd-out 0.40
//
// PLAN counts what the engine would read when GATHER_READ=on — every page with no
// read yet, or a read older than its words — and estimates tokens from the text
// that would be sent. It cannot know the output side; the number it prints for
// output is a rough guess and is labelled so.
//
// SAMPLE runs the real read (same prompt, same vocabulary, same sanitizer as the
// engine) on the N most recent pages the engine would read first, measures the
// tokens each call actually used, and projects that over the whole backlog. It
// prints each page's emotions, learning, change, desire and story — with the
// writer's own words as evidence — so the read can be judged before it is stored.
// The full result is saved locally to .gather-read/ (gitignored: it holds journal
// text) and never leaves this machine except as the model call itself.
//
// Rates are per million tokens, from your provider's price page; without them the
// script prints tokens only. Needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
// .env, and OPENAI_API_KEY (or the AI Gateway vars) for --sample.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

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

// ── pure: what gets estimated (tested in gather-read-dry.test.ts) ────────────

/** ~4 characters per token for English prose — the usual planning ratio. */
export const CHARS_PER_TOKEN = 4
/** Engine tick with the read on, and the cron that drives it (once a minute). */
export const PER_TICK = 24

export const tokensFor = (chars: number): number => Math.ceil(chars / CHARS_PER_TOKEN)

export interface PagePlan {
  /** Characters of page text the read would send (after fences are unwrapped and the cap applied). */
  textChars: number
  /** Characters of the subject list sent alongside it. */
  vocabChars: number
}

export interface Estimate {
  pages: number
  /** Pages too short to read (<40 chars): stored with no model call. */
  free: number
  calls: number
  inputTokens: number
  /** A guess. Measure with --sample. */
  outputTokensGuess: number
  /** Minutes for the engine to drain this at one tick a minute. */
  minutes: number
}

/**
 * Estimate the backlog. The system prompt is sent on every call; output is
 * guessed at half the page's tokens plus a fixed overhead, capped at the read's
 * 4096-token ceiling.
 */
export function estimate(pages: PagePlan[], systemChars: number): Estimate {
  let calls = 0
  let free = 0
  let inputTokens = 0
  let outputTokensGuess = 0
  for (const p of pages) {
    if (p.textChars < 40) {
      free++
      continue
    }
    calls++
    inputTokens += tokensFor(systemChars + p.textChars + p.vocabChars) + 30
    outputTokensGuess += Math.min(4096, Math.round(tokensFor(p.textChars) * 0.5) + 250)
  }
  return {
    pages: pages.length,
    free,
    calls,
    inputTokens,
    outputTokensGuess,
    minutes: Math.ceil(pages.length / PER_TICK),
  }
}

export interface Measured {
  calls: number
  in: number
  cached: number
  out: number
  reasoning: number
}

/** Scale what N real calls used to the whole backlog's call count. */
export function project(measured: Measured, backlogCalls: number): { in: number; out: number } {
  if (measured.calls === 0) return { in: 0, out: 0 }
  const scale = backlogCalls / measured.calls
  return { in: Math.round(measured.in * scale), out: Math.round(measured.out * scale) }
}

/** Dollars for a token count at per-million rates; null when no rates were given. */
export function dollars(tokens: { in: number; out: number }, usdIn?: number, usdOut?: number): number | null {
  if (usdIn === undefined || usdOut === undefined) return null
  return (tokens.in / 1e6) * usdIn + (tokens.out / 1e6) * usdOut
}

// ── the run ─────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const argv = process.argv
  const eq = argv.find((a) => a.startsWith(`--${name}=`))
  if (eq) return eq.slice(name.length + 3)
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith('--') ? argv[i + 1] : undefined
}
const num = (name: string): number | undefined => {
  const v = arg(name)
  return v === undefined ? undefined : Number(v)
}

interface Row {
  id: string
  created_at: string
  body_markdown: string | null
  read_words_hash?: string | null
}

const fmt = (n: number) => n.toLocaleString('en-US')
const usd = (n: number | null) => (n === null ? '— (pass --usd-in/--usd-out per 1M tokens)' : `$${n.toFixed(2)}`)
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex')

async function main(): Promise<void> {
  loadDotEnv()
  const sample = num('sample') ?? 0
  const usdIn = num('usd-in')
  const usdOut = num('usd-out')

  const { requireOwner, resolveOwners } = await import('./_owner.ts')
  const { supabaseAdmin } = await import('../api/_lib/supabaseAdmin.ts')
  const { writerWords } = await import('../api/_lib/writerWords.ts')
  const { entryTextForKeeping, keepingReadSystem, keepingReadVersion } = await import('../api/_lib/keepingRead.ts')
  const { candidatesForEntry, loadVocabulary } = await import('../api/_lib/keepingVocabulary.ts')
  const { readPages } = await import('../api/_lib/entryRead.ts')

  const owners = process.argv.includes('--all') ? await resolveOwners() : [await requireOwner()]
  if (sample > 0 && owners.length !== 1) throw new Error('--sample reads one account: pass --owner')
  const sb = supabaseAdmin()
  const systemChars = keepingReadSystem().length
  console.log(`Read version: ${keepingReadVersion()}  ·  database writes: none`)

  let migrated = true
  for (const owner of owners) {
    // Every entry, most recent first — the order the engine reads in.
    const rows: Row[] = []
    for (let from = 0; ; from += 1000) {
      const cols = migrated ? 'id, created_at, body_markdown, read_words_hash' : 'id, created_at, body_markdown'
      const { data, error } = await sb
        .from('entries')
        .select(cols)
        .eq('owner', owner)
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + 999)
      if (error && migrated && /read_words_hash/.test(error.message)) {
        migrated = false
        console.log('Note: migration 20261004120000 is not applied — counting every entry as unread.')
        from -= 1000
        continue
      }
      if (error) throw error
      rows.push(...((data ?? []) as unknown as Row[]))
      if ((data ?? []).length < 1000) break
    }

    const vocabulary = await loadVocabulary(sb, owner)
    const pending = rows
      .map((r) => ({ ...r, body_markdown: r.body_markdown ?? '' }))
      .map((r) => ({ ...r, wordsHash: md5(writerWords(r.body_markdown)) }))
      .filter((r) => (r.read_words_hash ?? null) !== r.wordsHash)

    const plans: PagePlan[] = pending.map((r) => ({
      textChars: entryTextForKeeping(r.body_markdown).text.length,
      vocabChars: JSON.stringify(candidatesForEntry(r.body_markdown, vocabulary.concordance, vocabulary.kept)).length,
    }))
    const est = estimate(plans, systemChars)
    const guessCost = dollars({ in: est.inputTokens, out: est.outputTokensGuess }, usdIn, usdOut)

    console.log(`\n── ${owner}`)
    console.log(`  entries ${fmt(rows.length)}  ·  to read ${fmt(est.pages)}  (${fmt(est.free)} too short: stored free)`)
    console.log(`  model calls     ${fmt(est.calls)}`)
    console.log(`  input tokens    ~${fmt(est.inputTokens)}`)
    console.log(`  output tokens   ~${fmt(est.outputTokensGuess)}  (GUESS — measure with --sample)`)
    console.log(`  est. cost       ${usd(guessCost)}`)
    console.log(`  engine time     ~${fmt(est.minutes)} min at ${PER_TICK} pages/tick, one tick a minute`)

    if (sample <= 0) continue

    // ── SAMPLE: real reads, nothing stored ──────────────────────────────────
    const usage: Measured = { calls: 0, in: 0, cached: 0, out: 0, reasoning: 0 }
    const realLog = console.log
    console.log = (...a: unknown[]) => {
      const line = typeof a[0] === 'string' ? a[0] : ''
      if (line.startsWith('[tokens]')) {
        const n = (k: string) => Number(new RegExp(`\\b${k}=(\\d+)`).exec(line)?.[1] ?? 0)
        usage.calls++
        usage.in += n('in')
        usage.cached += n('cached')
        usage.out += n('out')
        usage.reasoning += n('reasoning')
        return
      }
      realLog(...a)
    }
    const picked = pending.filter((r) => entryTextForKeeping(r.body_markdown).text.length >= 40).slice(0, sample)
    let result: Awaited<ReturnType<typeof readPages>>
    try {
      result = await readPages(sb, owner, picked, { vocabulary })
    } finally {
      console.log = realLog
    }

    const byId = new Map(picked.map((r) => [r.id, r]))
    console.log(`\n  SAMPLE — ${result.rows.length} read, ${result.failedIds.length} failed`)
    for (const row of result.rows.sort((a, b) =>
      (byId.get(b.entry_id)?.created_at ?? '').localeCompare(byId.get(a.entry_id)?.created_at ?? ''),
    )) {
      const date = byId.get(row.entry_id)?.created_at.slice(0, 10)
      const feel = row.present
        ? `valence ${row.valence.toFixed(2)}  energy ${row.activation.toFixed(2)}  conf ${row.confidence.toFixed(2)}`
        : 'no felt emotion'
      console.log(`\n  ${date}  ${row.entry_id}\n    ${feel}`)
      for (const e of row.emotions) console.log(`    · ${e.emotion} ${e.intensity.toFixed(2)}  “${e.quote}”`)
      for (const i of row.ingredients.filter((x) => x.kind !== 'scripture' && x.kind !== 'prayer')) {
        console.log(`    + ${i.kind}  “${i.quote.length > 160 ? `${i.quote.slice(0, 157)}…` : i.quote}”`)
      }
    }

    const backlog = project(usage, est.calls)
    console.log(`\n  measured over ${usage.calls} calls: in ${fmt(usage.in)} (cached ${fmt(usage.cached)}), out ${fmt(usage.out)} (reasoning ${fmt(usage.reasoning)})`)
    console.log(`  per call        in ~${fmt(Math.round(usage.in / Math.max(1, usage.calls)))}, out ~${fmt(Math.round(usage.out / Math.max(1, usage.calls)))}`)
    console.log(`  whole backlog   in ~${fmt(backlog.in)}, out ~${fmt(backlog.out)}  →  ${usd(dollars(backlog, usdIn, usdOut))}`)

    mkdirSync('.gather-read', { recursive: true })
    const file = `.gather-read/sample-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    writeFileSync(
      file,
      JSON.stringify({ owner, version: keepingReadVersion(), usage, backlog: est, rows: result.rows, failed: result.failedIds }, null, 2),
    )
    console.log(`  full reads saved to ${file} (local only — holds journal text)`)
  }
}

// Only run when invoked directly, so the test can import the estimators.
if (process.argv[1]?.endsWith('gather-read-dry.ts')) {
  main().catch((err) => {
    console.error('gather-read-dry failed:', err instanceof Error ? err.message : JSON.stringify(err))
    process.exit(1)
  })
}
