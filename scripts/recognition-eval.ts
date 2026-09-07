// Import-recognition eval — score what Dayspring actually notices in imported
// prose, against a hand-labeled corpus.
//
//   npx tsx scripts/recognition-eval.ts --dry            # PLAN: calls + est cost, $0, no network
//   npx tsx scripts/recognition-eval.ts                  # all axes
//   npx tsx scripts/recognition-eval.ts --only=prayers   # prayers | entities | subjects | scripture
//   npx tsx scripts/recognition-eval.ts --limit=20       # first N corpus entries
//   npx tsx scripts/recognition-eval.ts --model=gpt-5.4  # A/B a different model
//   npx tsx scripts/recognition-eval.ts --json           # machine-readable, for diffing runs
//
// NEEDS ONLY `OPENAI_API_KEY`. No Supabase, no service-role key, no owner, no
// writes, no cleanup — it runs the DB-free halves of the three builders
// (harvestTexts, extractCandidates, tagTexts) over an in-memory corpus. Nothing
// it does can touch anyone's journal. That is the whole point of the seams; run
// it as freely as you like.
//
// Cost: ~29 model calls for the full 127-entry corpus, roughly $0.03. Use
// --dry first if you want the number before you spend it.
//
// This DOES print prose in the misses section, which the other scripts never do
// (§8: log counts only, never entry text). That rule protects real journal
// text; this corpus is synthetic, committed to the repo, and never leaves this
// process. The misses are the entire value of the report — a score with no
// examples tells you nothing about what to fix.
//
// Never fails the build: model output is nondeterministic, and a flaky assertion
// is a muted assertion. It prints and exits 0. The deterministic half of the
// battery lives in Tier 1 (src/lib/recognition/*.test.ts) and IS asserted.

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
const JSON_OUT = args.includes('--json')
const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length)
const limitArg = args.find((a) => a.startsWith('--limit='))
const LIMIT = limitArg ? Number(limitArg.slice('--limit='.length)) : undefined
const modelArg = args.find((a) => a.startsWith('--model='))
if (modelArg) process.env.OPENAI_MODEL = modelArg.slice('--model='.length)

const AXES = ['scripture', 'prayers', 'entities', 'subjects'] as const
type Axis = (typeof AXES)[number]
const wants = (a: Axis): boolean => !only || only === a

if (only && !AXES.includes(only as Axis)) {
  console.error(`--only must be one of: ${AXES.join(', ')}`)
  process.exit(1)
}

const REQUIRED = DRY ? [] : ['OPENAI_API_KEY']
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  process.exit(1)
}

// ── token accounting ─────────────────────────────────────────────────────────
// callModel already emits one `[tokens] …` line per call via logUsage in
// api/_lib/openai.ts. Intercept and total those rather than adding new metering.

const usage = { calls: 0, in: 0, cached: 0, out: 0, reasoning: 0 }
const realLog = console.log
console.log = (...a: unknown[]) => {
  const line = typeof a[0] === 'string' ? a[0] : ''
  if (line.startsWith('[tokens]')) {
    const num = (k: string) => Number(new RegExp(`\\b${k}=(\\d+)`).exec(line)?.[1] ?? 0)
    usage.calls++
    usage.in += num('in')
    usage.cached += num('cached')
    usage.out += num('out')
    usage.reasoning += num('reasoning')
    return
  }
  realLog(...a)
}

const pct = (n: number): string => (Number.isFinite(n) ? n.toFixed(3) : '—')

async function main(): Promise<void> {
  const { CORPUS, DESIGNED_THREADS, asEntryRows, corpusFor } = await import(
    '../src/lib/recognition/corpus/index.ts'
  )
  const score = await import('../src/lib/recognition/score.ts')
  const { parseReferences } = await import('../src/lib/scripture/parse.ts')
  const { HARVEST_CUE, harvestTexts } = await import('../api/_lib/altar.ts')
  const { extractCandidates } = await import('../api/_lib/concordance.ts')
  const { tagTexts, groupTagged } = await import('../api/_lib/declared.ts')
  const { env } = await import('../api/_lib/env.ts')

  const allRows = asEntryRows()
  const rows = LIMIT ? allRows.slice(0, LIMIT) : allRows
  const keep = new Set(rows.map((r) => r.id))
  const model = env.model()

  // Batch sizes are the real constants from the builders, so the estimate is
  // the number of calls that would actually be made.
  const cueHits = rows.filter((r) => HARVEST_CUE.test(r.body_markdown))
  const prayerCalls = wants('prayers') ? Math.ceil(cueHits.length / 6) : 0
  const entityCalls = wants('entities') ? Math.ceil(rows.length / 8) : 0
  const subjectLines = CORPUS.filter((e) => keep.has(e.id)).flatMap((e) => e.passages ?? [])
  const subjectCalls = wants('subjects') ? Math.ceil(subjectLines.length / 6) : 0
  const totalCalls = prayerCalls + entityCalls + subjectCalls

  if (DRY) {
    realLog(`recognition eval — DRY RUN, $0, no network`)
    realLog(`  corpus            ${rows.length} entries (${CORPUS.length} available)`)
    realLog(`  model             ${model}`)
    realLog(`  cue prefilter     ${cueHits.length}/${rows.length} entries would reach the model`)
    realLog(`  prayer calls      ${prayerCalls}  (batch 6)`)
    realLog(`  entity calls      ${entityCalls}  (batch 8)`)
    realLog(`  subject calls     ${subjectCalls}  (batch 6, over ${subjectLines.length} labeled lines)`)
    realLog(`  TOTAL             ${totalCalls} calls, roughly $${(totalCalls * 0.0011).toFixed(3)} on a nano-class model`)
    realLog(`\n  scripture is deterministic and always free.`)
    return
  }

  const report: Record<string, unknown> = { model, entries: rows.length }
  const lines: string[] = []
  const misses: string[] = []

  lines.push(`recognition eval — model ${model} — ${rows.length} entries`)
  lines.push(`model output varies run to run; a 1–2 point move is noise. use --json to diff runs.`)
  lines.push('')
  lines.push(`axis            TP   FP   FN   precision  recall     F1`)

  const row = (name: string, s: score.Score, tail = ''): void => {
    lines.push(
      `${name.padEnd(14)} ${String(s.tp).padStart(3)}  ${String(s.fp).padStart(3)}  ${String(s.fn).padStart(3)}` +
        `      ${pct(s.precision)}   ${pct(s.recall)}   ${pct(s.f1)}${tail ? '   ' + tail : ''}`,
    )
  }

  // ── scripture (deterministic, $0) ──────────────────────────────────────────
  if (wants('scripture')) {
    const s = score.scoreScripture(parseReferences, keep)
    row('scripture', s.explicit, '(deterministic, $0)')
    lines.push(
      `  allusions      0    0  ${String(s.allusions.total).padStart(3)}      —        0.000           no detector exists`,
    )
    report['scripture'] = { ...s.explicit, allusions: s.allusions }
    for (const m of s.misses.slice(0, 8)) {
      misses.push(`  scripture ${m.kind.toUpperCase()}  ${m.entryId.padEnd(26)} ${m.detail}`)
    }
  }

  // ── cue prefilter (deterministic, $0) ──────────────────────────────────────
  if (wants('prayers')) {
    const cue = score.scoreCuePrefilter((t) => HARVEST_CUE.test(t), keep)
    row('cue prefilter', cue)
    report['cuePrefilter'] = cue
  }

  // ── prayers (model) ────────────────────────────────────────────────────────
  if (wants('prayers')) {
    const { byEntry, failed } = await harvestTexts(
      cueHits.map((r) => ({ id: r.id, body: r.body_markdown })),
    )
    const actual = [...byEntry].flatMap(([entryId, ps]) =>
      ps.map((p) => ({ entryId, type: p.type, text: p.text })),
    )
    const s = score.scorePassages(actual, keep)
    row('prayers', s.span)
    lines.push(
      `  type agree    ${s.typeAgreement.agreed}/${s.typeAgreement.matched} (${pct(
        s.typeAgreement.matched ? s.typeAgreement.agreed / s.typeAgreement.matched : 1,
      )})`,
    )
    if (failed.length) lines.push(`  ${failed.length} entries in failed batches (not scored)`)
    report['prayers'] = { ...s.span, typeAgreement: s.typeAgreement, failed: failed.length }
    for (const m of s.misses.slice(0, 8)) {
      misses.push(`  prayers ${m.kind.toUpperCase()}    ${m.entryId.padEnd(26)} ${JSON.stringify(m.detail)}`)
    }
  }

  // ── entities (model) ───────────────────────────────────────────────────────
  if (wants('entities')) {
    const { byEntry, failed } = await extractCandidates(
      rows.map((r) => ({ id: r.id, body: r.body_markdown })),
    )
    const actual = [...byEntry].flatMap(([entryId, cs]) =>
      cs.map((c) => ({
        entryId,
        kind: c.kind as string,
        canonical: c.canonical,
        surfaceForm: c.surface_form,
        descriptor: c.descriptor ?? '',
      })),
    )
    const s = score.scoreEntities(actual, keep)
    row('entities', s.identity)
    lines.push(
      `  kind agree    ${s.kindAgreement.agreed}/${s.kindAgreement.matched} (${pct(
        s.kindAgreement.matched ? s.kindAgreement.agreed / s.kindAgreement.matched : 1,
      )})`,
    )
    lines.push(
      `  descriptors   ${s.descriptors.kept}/${s.descriptors.proposed} survived the evaluative gate correctly`,
    )
    // Entity precision is a LOWER BOUND, not a measurement. The corpus labels
    // the entities each entry was written to test, not every proper noun in it,
    // so a correct extraction the annotation didn't anticipate scores as a false
    // positive. Read the misses, not the number. (Recall and the descriptor
    // figure are sound — those denominators are complete.)
    lines.push(`  NOTE: entity precision is a lower bound — see the misses, not the number`)
    if (failed.length) lines.push(`  ${failed.length} entries in failed batches (not scored)`)
    report['entities'] = { ...s.identity, kindAgreement: s.kindAgreement, descriptors: s.descriptors }
    for (const m of s.misses.slice(0, 8)) {
      misses.push(`  entities ${m.kind.toUpperCase()}   ${m.entryId.padEnd(26)} ${m.detail}`)
    }
  }

  // ── subjects (model tag + deterministic grouping) ──────────────────────────
  if (wants('subjects')) {
    const labeled = CORPUS.filter((e) => keep.has(e.id) && (e.passages ?? []).length > 0).flatMap(
      (e) => (e.passages ?? []).map((p, i) => ({ entry: e, p, key: `${e.id}#${i}` })),
    )
    const tagged = await tagTexts(labeled.map((l) => ({ id: l.key, content: l.p.text })))
    const items = labeled
      .filter((l) => tagged.has(l.key))
      .map((l) => ({
        id: l.key,
        type: l.p.type,
        date: l.entry.created_at,
        tags: tagged.get(l.key)!,
        content: l.p.text,
      }))
    const plan = await groupTagged(items)
    const formed = plan.subjects.map((s) => s.label.toLowerCase())

    const shouldForm = DESIGNED_THREADS.forms.map((f) => f.toLowerCase())
    const shouldNot = DESIGNED_THREADS.nearMisses.map((n) => n.label.toLowerCase())
    const got = shouldForm.filter((f) => formed.includes(f))
    const wrong = shouldNot.filter((f) => formed.includes(f))
    const extra = formed.filter((f) => !shouldForm.includes(f))

    lines.push(
      `subjects      ${String(got.length).padStart(3)}  ${String(extra.length).padStart(3)}  ` +
        `${String(shouldForm.length - got.length).padStart(3)}` +
        `      ${pct(formed.length ? got.length / formed.length : 1)}   ` +
        `${pct(got.length / shouldForm.length)}           ${wrong.length} near-miss threads wrongly formed`,
    )
    report['subjects'] = { formed, expected: shouldForm, wronglyFormed: wrong, extra }
    for (const f of shouldForm.filter((x) => !got.includes(x))) {
      misses.push(`  subjects FN    ${'—'.padEnd(26)} "${f}" did not form a thread`)
    }
    for (const f of wrong) {
      const why = DESIGNED_THREADS.nearMisses.find((n) => n.label.toLowerCase() === f)?.fails
      misses.push(`  subjects FP    ${'—'.padEnd(26)} "${f}" formed despite ${why}`)
    }
  }

  if (misses.length) {
    lines.push('')
    lines.push('misses')
    lines.push(...misses)
  }

  lines.push('')
  lines.push(
    `tokens  in=${usage.in}  cached=${usage.cached}  out=${usage.out}  reasoning=${usage.reasoning}` +
      `   ${usage.calls} calls`,
  )
  report['usage'] = usage

  if (JSON_OUT) realLog(JSON.stringify(report, null, 2))
  else realLog(lines.join('\n'))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
