// Import-recognition eval — score what Dayspring actually notices in imported
// prose, against a hand-labeled corpus.
//
//   npm run eval:recognition -- --dry --compare
//   npm run eval:recognition -- --compare=openai,jev,cascade --tau=0.6,0.7,0.8,0.9 --split=dev --reruns=3 --json
//   npm run eval:recognition -- --provider=jev --split=test --json
//
// Lab only. Synthetic corpus. Never fails the build (exit 0) except on missing
// env when a live provider is selected. Do not point this at real journals.
//
// --compare without a value means openai,jev.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const PROVIDERS = ['openai', 'jev', 'cascade'] as const
type Provider = (typeof PROVIDERS)[number]

function parseList(flag: string, fallback: string[]): string[] {
  const bare = args.includes(flag)
  const keyed = args.find((a) => a.startsWith(`${flag}=`))
  if (keyed) {
    return keyed
      .slice(flag.length + 1)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (bare) return fallback
  return []
}

const compareList = parseList('--compare', ['openai', 'jev'])
const providerArg = args.find((a) => a.startsWith('--provider='))?.slice('--provider='.length)
const selected: Provider[] = (
  compareList.length
    ? compareList
    : [providerArg ?? process.env.CLASSIFIER_PROVIDER ?? 'openai']
).filter((p): p is Provider => (PROVIDERS as readonly string[]).includes(p))

if (selected.length === 0) {
  console.error(`--provider / --compare must be one of: ${PROVIDERS.join(', ')}`)
  process.exit(1)
}

const tauList = (args.find((a) => a.startsWith('--tau='))?.slice('--tau='.length) ?? '0.8')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n))
const TAUS = tauList.length ? tauList : [0.8]
const rerunsArg = args.find((a) => a.startsWith('--reruns='))
const RERUNS = Math.max(1, rerunsArg ? Number(rerunsArg.slice('--reruns='.length)) : 1)
const splitArg = args.find((a) => a.startsWith('--split='))?.slice('--split='.length) ?? 'all'
const SPLIT = splitArg === 'dev' || splitArg === 'test' ? splitArg : 'all'

const AXES = ['scripture', 'prayers', 'entities', 'subjects', 'sentiment'] as const
type Axis = (typeof AXES)[number]
const wants = (a: Axis): boolean => !only || only === a || (only === 'gate' && a === 'prayers')

if (only && ![...AXES, 'gate'].includes(only as Axis)) {
  console.error(`--only must be one of: ${[...AXES, 'gate'].join(', ')}`)
  process.exit(1)
}

const needsOpenAI = !DRY && selected.some((p) => p === 'openai' || p === 'cascade') && (wants('prayers') || wants('entities') || wants('subjects') || wants('sentiment'))
const needsJev = !DRY && selected.some((p) => p === 'jev' || p === 'cascade') && (wants('prayers') || wants('subjects') || wants('sentiment'))
const REQUIRED = [
  ...(needsOpenAI ? ['OPENAI_API_KEY'] : []),
  ...(needsJev ? ['TYPESAFE_API_KEY'] : []),
]
const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing required env in .env: ${missing.join(', ')}`)
  console.error(`Hint: --dry works without keys. Live --compare needs both keys when jev/cascade is selected.`)
  process.exit(1)
}

// Prices per 1M tokens. Override with JEV_PRICE_IN / LUNA_PRICE_IN / LUNA_PRICE_OUT.
const PRICE = {
  jevIn: Number(process.env.JEV_PRICE_IN ?? 0.042),
  jevOut: 0,
  lunaIn: Number(process.env.LUNA_PRICE_IN ?? 0.1),
  lunaOut: Number(process.env.LUNA_PRICE_OUT ?? 0.5),
  nanoIn: 0.2,
  nanoOut: 1.25,
} as const

function priceOf(model: string): { inn: number; out: number } {
  if (model.startsWith('jev')) return { inn: PRICE.jevIn, out: PRICE.jevOut }
  if (model.includes('nano')) return { inn: PRICE.nanoIn, out: PRICE.nanoOut }
  return { inn: PRICE.lunaIn, out: PRICE.lunaOut }
}

function dollars(model: string, inn: number, out: number, reasoning: number): number {
  const p = priceOf(model)
  return (inn * p.inn + (out + reasoning) * p.out) / 1_000_000
}

type UsageSnap = {
  calls: number
  in: number
  cached: number
  out: number
  reasoning: number
  ms: number[]
  models: string[]
}

function emptyUsage(): UsageSnap {
  return { calls: 0, in: 0, cached: 0, out: 0, reasoning: 0, ms: [], models: [] }
}

let usage = emptyUsage()
const realLog = console.log
console.log = (...a: unknown[]) => {
  const line = typeof a[0] === 'string' ? a[0] : ''
  if (line.startsWith('[tokens]')) {
    const num = (k: string) => Number(new RegExp(`\\b${k}=(\\d+)`).exec(line)?.[1] ?? 0)
    const model = /\bmodel=(\S+)/.exec(line)?.[1] ?? ''
    usage.calls++
    usage.in += num('in')
    usage.cached += num('cached')
    usage.out += num('out')
    usage.reasoning += num('reasoning')
    if (num('ms')) usage.ms.push(num('ms'))
    if (model) usage.models.push(model)
    return
  }
  realLog(...a)
}

const pct = (n: number): string => (Number.isFinite(n) ? n.toFixed(3) : '—')

function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))
  return s[idx]!
}

function costBlock(u: UsageSnap, entries: number, modelHint: string): Record<string, number> {
  const model = u.models[0] ?? modelHint
  const total = dollars(model, u.in, u.out, u.reasoning)
  const per = entries ? total / entries : 0
  return {
    total,
    per1k: per * 1000,
    per2000: per * 2000,
  }
}

type ArmName = string

interface ArmResult {
  name: ArmName
  provider: Provider
  tau: number
  report: Record<string, unknown>
  lines: string[]
  usage: UsageSnap
  flipRate?: number
  escalation?: number
  calibration?: { bin: number; count: number; meanProb: number; accuracy: number }[]
}

async function main(): Promise<void> {
  const { CORPUS, DESIGNED_THREADS, asEntryRows, filterSplit } = await import(
    '../src/lib/recognition/corpus/index.ts'
  )
  const score = await import('../src/lib/recognition/score.ts')
  const { parseReferences } = await import('../src/lib/scripture/parse.ts')
  const { HARVEST_CUE, harvestTexts } = await import('../api/_lib/altar.ts')
  const { extractCandidates } = await import('../api/_lib/concordance.ts')
  const { tagTexts, groupTagged } = await import('../api/_lib/declared.ts')
  const { env } = await import('../api/_lib/env.ts')
  const { jevHarvestTexts } = await import('../api/_lib/jev/harvest.ts')
  const { jevTagTexts, evalSubjectVocabulary } = await import('../api/_lib/jev/subjects.ts')
  const { jevSentiment } = await import('../api/_lib/jev/sentiment.ts')
  const { cascadeHarvest, cascadeTag, cascadeSentiment } = await import('../api/_lib/jev/cascade.ts')
  const { openaiSentiment } = await import('../api/_lib/jev/openaiSentiment.ts')
  const { estimateJevTokens } = await import('../api/_lib/typesafe.ts')
  const { splitSentences } = await import('../api/_lib/jev/sentences.ts')
  const { noul, choice } = await import('@typesafe-ai/sdk')

  const splitRows = filterSplit(asEntryRows(), SPLIT)
  const allRows = LIMIT ? splitRows.slice(0, LIMIT) : splitRows
  const keep = new Set(allRows.map((r) => r.id))
  const corpus = CORPUS.filter((e) => keep.has(e.id))
  const model = env.model()

  const cueHits = allRows.filter((r) => HARVEST_CUE.test(r.body_markdown))
  const prayerCalls = wants('prayers') ? Math.ceil(cueHits.length / 6) : 0
  const entityCalls = wants('entities') ? Math.ceil(allRows.length / 8) : 0
  const subjectLines = corpus.flatMap((e) => e.passages ?? [])
  const subjectCalls = wants('subjects') ? Math.ceil(subjectLines.length / 6) : 0
  const sentimentCalls = wants('sentiment') ? corpus.filter((e) => e.sentiment).length : 0
  const jevHarvestCalls = wants('prayers') ? allRows.length : 0
  const jevTagCalls = wants('subjects') ? subjectLines.length : 0
  const jevSentimentCalls = wants('sentiment') ? sentimentCalls : 0

  const vocab = evalSubjectVocabulary([
    ...corpus.flatMap((e) => (e.subjects ?? []).map((s) => s.label)),
    ...DESIGNED_THREADS.forms,
  ])

  if (DRY) {
    let jevTok = 0
    if (selected.some((p) => p === 'jev' || p === 'cascade')) {
      for (const r of allRows) {
        if (wants('prayers')) {
          const sentences = splitSentences(r.body_markdown).map((s) => s.text)
          const questions: Record<string, unknown> = {
            contains_prayer: noul('x'),
            contains_sense: noul('x'),
          }
          for (let i = 0; i < sentences.length; i++) questions[`s${i}`] = choice('x', { prayer: 'a', sense: 'b', neither: 'c' })
          jevTok += estimateJevTokens({ sentences }, questions)
        }
        if (wants('sentiment') && CORPUS.find((e) => e.id === r.id)?.sentiment) {
          jevTok += estimateJevTokens({ text: r.body_markdown.slice(0, 500) }, { present: noul('x') })
        }
      }
      if (wants('subjects')) {
        jevTok += subjectLines.length * estimateJevTokens({ line: 'x' }, { keep: noul('x'), kind: choice('x', { person: 'a', place: 'b', theme: 'c' }) })
      }
    }

    const jevCost = (jevTok * PRICE.jevIn) / 1_000_000
    const openaiCalls = prayerCalls + entityCalls + subjectCalls + sentimentCalls
    const openaiCost = openaiCalls * 0.0011
    const lines = [
      `recognition eval — DRY RUN, $0, no network`,
      `  corpus            ${allRows.length} entries (${CORPUS.length} available, split=${SPLIT})`,
      `  openai model      ${model}`,
      `  jev model         ${env.typesafeModel()}`,
      `  providers         ${selected.join(', ')}`,
      `  tau               ${TAUS.join(', ')}`,
      `  reruns            ${RERUNS}`,
      `  cue prefilter     ${cueHits.length}/${allRows.length} entries would reach the OpenAI harvest`,
      `  openai calls      prayers=${prayerCalls} entities=${entityCalls} subjects=${subjectCalls} sentiment=${sentimentCalls}  TOTAL=${openaiCalls}`,
      `  openai est. $     ~$${openaiCost.toFixed(3)} (rough; live run uses token logs)`,
      `  jev calls         harvest=${jevHarvestCalls} tag=${jevTagCalls} sentiment=${jevSentimentCalls} (one request per item)`,
      `  jev est. tokens   ${jevTok}  (~$${(jevCost).toFixed(4)} at $${PRICE.jevIn}/1M in, out free)`,
      `  vocab (subjects)  ${vocab.length} labels + none_of_these  — gold + DESIGNED_THREADS.forms + sibling/virtue distractors`,
      ``,
      `  scripture is deterministic and always free.`,
      `  Live: npm run eval:recognition -- --compare=openai,jev,cascade --tau=0.8 --split=test --json`,
    ]
    realLog(lines.join('\n'))
    writeReports({ dry: true, split: SPLIT, providers: selected, taus: TAUS, entries: allRows.length, openaiCalls, jevTok, jevCost, openaiCost, vocab }, lines)
    return
  }

  const arms: ArmResult[] = []

  const runArm = async (provider: Provider, tau: number, armName: string): Promise<ArmResult> => {
    usage = emptyUsage()
    const report: Record<string, unknown> = {
      provider,
      tau,
      model: provider === 'jev' ? env.typesafeModel() : model,
      entries: allRows.length,
      split: SPLIT,
    }
    const lines: string[] = []
    const misses: string[] = []
    const calSamples: { p: number; ok: boolean }[] = []
    let escalationN = 0
    let escalationD = 0

    lines.push(`recognition eval — ${armName} — ${allRows.length} entries (split=${SPLIT})`)
    lines.push(`model output varies run to run; a 1–2 point move is noise. use --json to diff runs.`)
    lines.push('')
    lines.push(`axis            TP   FP   FN   precision  recall     F1`)

    const row = (name: string, s: score.Score, tail = ''): void => {
      lines.push(
        `${name.padEnd(14)} ${String(s.tp).padStart(3)}  ${String(s.fp).padStart(3)}  ${String(s.fn).padStart(3)}` +
          `      ${pct(s.precision)}   ${pct(s.recall)}   ${pct(s.f1)}${tail ? '   ' + tail : ''}`,
      )
    }

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

    if (wants('prayers')) {
      const cue = score.scoreCuePrefilter((t) => HARVEST_CUE.test(t), keep)
      row('cue prefilter', cue)
      report['cuePrefilter'] = cue
    }

    type Discrete = Record<string, string>
    const snapshots: Discrete[] = []

    const once = async (): Promise<Discrete> => {
      const disc: Discrete = {}

      if (wants('prayers')) {
        let byEntry = new Map<string, { type: 'prayer' | 'sense'; text: string }[]>()
        let failed: string[] = []
        const gateMap = new Map<string, boolean>()

        if (provider === 'openai') {
          const harvested = await harvestTexts(cueHits.map((r) => ({ id: r.id, body: r.body_markdown })))
          byEntry = harvested.byEntry
          failed = harvested.failed
          for (const r of allRows) gateMap.set(r.id, (byEntry.get(r.id) ?? []).length > 0)
        } else if (provider === 'jev') {
          const harvested = await jevHarvestTexts(
            allRows.map((r) => ({ id: r.id, body: r.body_markdown })),
            { tau },
          )
          byEntry = harvested.byEntry
          failed = harvested.failed
          for (const [id, g] of harvested.gate) {
            gateMap.set(id, g.containsPrayer || g.containsSense)
            const gold = (CORPUS.find((e) => e.id === id)?.passages ?? []).length > 0
            calSamples.push({ p: Math.max(g.prayerNoul, g.senseNoul), ok: gold === (g.containsPrayer || g.containsSense) })
          }
        } else {
          const harvested = await cascadeHarvest(
            allRows.map((r) => ({ id: r.id, body: r.body_markdown })),
            { tau },
          )
          byEntry = harvested.byEntry
          failed = harvested.failed
          for (const r of allRows) {
            const g = harvested.gate.get(r.id)
            gateMap.set(r.id, g ? g.containsPrayer || g.containsSense : (byEntry.get(r.id) ?? []).length > 0)
            if (harvested.route.get(r.id) === 'llm') escalationN++
            escalationD++
          }
        }

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

        const gate = score.scoreGate((id) => gateMap.get(id) === true, keep)
        row('gate', gate)
        report['gate'] = gate

        for (const m of s.misses.slice(0, 8)) {
          misses.push(`  prayers ${m.kind.toUpperCase()}    ${m.entryId.padEnd(26)} ${JSON.stringify(m.detail)}`)
        }
        for (const r of allRows) {
          const ps = (byEntry.get(r.id) ?? []).map((p) => `${p.type}:${p.text}`).sort().join('|')
          disc[`pray:${r.id}`] = ps
          disc[`gate:${r.id}`] = gateMap.get(r.id) ? '1' : '0'
        }
      }

      if (wants('entities') && provider === 'openai') {
        const { byEntry, failed } = await extractCandidates(
          allRows.map((r) => ({ id: r.id, body: r.body_markdown })),
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
        lines.push(`  NOTE: entity precision is a lower bound — see the misses, not the number`)
        if (failed.length) lines.push(`  ${failed.length} entries in failed batches (not scored)`)
        report['entities'] = { ...s.identity, kindAgreement: s.kindAgreement, descriptors: s.descriptors }
        for (const m of s.misses.slice(0, 8)) {
          misses.push(`  entities ${m.kind.toUpperCase()}   ${m.entryId.padEnd(26)} ${m.detail}`)
        }
      } else if (wants('entities') && provider !== 'openai') {
        lines.push(`entities       —    —    —      (OpenAI-only axis; skipped for ${provider})`)
      }

      if (wants('subjects')) {
        const labeled = corpus
          .filter((e) => (e.passages ?? []).length > 0)
          .flatMap((e) => (e.passages ?? []).map((p, i) => ({ entry: e, p, key: `${e.id}#${i}` })))

        let tagged = new Map<string, { label: string; kind: string }[]>()
        if (provider === 'openai') {
          tagged = await tagTexts(labeled.map((l) => ({ id: l.key, content: l.p.text })))
        } else if (provider === 'jev') {
          const res = await jevTagTexts(
            labeled.map((l) => ({ id: l.key, content: l.p.text })),
            vocab,
            { tau },
          )
          tagged = res.tags
          for (const [id, a] of res.assignments) {
            const entryId = id.split('#')[0]!
            const gold = (CORPUS.find((e) => e.id === entryId)?.subjects ?? []).map((s) => s.label.toLowerCase())
            calSamples.push({ p: a.confidence, ok: a.subject === 'none_of_these' ? gold.length === 0 : gold.includes(a.subject.toLowerCase()) })
          }
        } else {
          const res = await cascadeTag(
            labeled.map((l) => ({ id: l.key, content: l.p.text })),
            vocab,
            { tau },
          )
          tagged = res.tags
          for (const l of labeled) {
            if (res.route.get(l.key) === 'llm') escalationN++
            escalationD++
          }
        }

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
        const extra = formed.filter((f) => !shouldForm.includes(f) && !shouldNot.includes(f))

        lines.push(
          `subjects      ${String(got.length).padStart(3)}  ${String(extra.length).padStart(3)}  ` +
            `${String(shouldForm.length - got.length).padStart(3)}` +
            `      ${pct(formed.length ? got.length / formed.length : 1)}   ` +
            `${pct(got.length / shouldForm.length)}           ${wrong.length} near-miss threads wrongly formed`,
        )
        report['subjects'] = { formed, expected: shouldForm, wronglyFormed: wrong, extra }

        const byEntry = new Map<string, string[]>()
        for (const l of labeled) {
          const labels = (tagged.get(l.key) ?? []).map((t) => t.label)
          const cur = byEntry.get(l.entry.id) ?? []
          byEntry.set(l.entry.id, [...cur, ...labels])
        }
        const assign = score.scoreSubjectAssignment(
          [...byEntry].map(([entryId, labels]) => ({ entryId, labels })),
          keep,
        )
        row('subj assign', assign)
        report['subjectAssignment'] = assign

        for (const f of shouldForm.filter((x) => !got.includes(x))) {
          misses.push(`  subjects FN    ${'—'.padEnd(26)} "${f}" did not form a thread`)
        }
        for (const f of wrong) {
          const why = DESIGNED_THREADS.nearMisses.find((n) => n.label.toLowerCase() === f)?.fails
          misses.push(`  subjects FP    ${'—'.padEnd(26)} "${f}" formed despite ${why}`)
        }
        for (const [id, labels] of byEntry) disc[`subj:${id}`] = labels.map((x) => x.toLowerCase()).sort().join('|')
      }

      if (wants('sentiment')) {
        const annotated = corpus.filter((e) => e.sentiment)
        const actual: score.ModelSentiment[] = []
        for (const e of annotated) {
          try {
            const reading =
              provider === 'openai'
                ? await openaiSentiment(e.body)
                : provider === 'jev'
                  ? await jevSentiment(e.body, { tau })
                  : await cascadeSentiment(e.body, { tau })
            if (provider === 'cascade') {
              escalationD++
              if ('route' in reading && reading.route === 'llm') escalationN++
            }
            if (provider === 'jev') {
              calSamples.push({ p: reading.confidence, ok: reading.present === e.sentiment!.present })
            }
            actual.push({
              entryId: e.id,
              present: reading.present,
              valence: reading.valenceBucket,
              valenceNumeric: reading.valence,
              emotions: reading.emotions,
            })
            disc[`sent:${e.id}`] = `${reading.present ? 1 : 0}:${reading.valenceBucket}:${[...reading.emotions].sort().join(',')}`
          } catch {
            misses.push(`  sentiment ERR   ${e.id}`)
          }
        }
        const s = score.scoreSentiment(actual, keep)
        lines.push(
          `sentiment      present acc=${pct(s.present.accuracy)}  valence acc=${pct(s.valenceBucket.accuracy)}  MAE=${s.valenceMae.toFixed(3)}  micro F1=${pct(s.micro.f1)}  macro F1=${pct(s.macro.f1)}`,
        )
        for (const lab of s.perEmotion) {
          lines.push(
            `  ${lab.label.padEnd(12)} ${String(lab.tp).padStart(3)}  ${String(lab.fp).padStart(3)}  ${String(lab.fn).padStart(3)}      ${pct(lab.precision)}   ${pct(lab.recall)}   ${pct(lab.f1)}`,
          )
        }
        report['sentiment'] = s
        for (const m of s.misses.slice(0, 8)) {
          misses.push(`  sentiment ${m.kind.toUpperCase()}  ${m.entryId.padEnd(26)} ${m.detail}`)
        }
      }

      return disc
    }

    const first = await once()
    snapshots.push(first)
    for (let r = 1; r < RERUNS; r++) {
      // Subsequent reruns only collect discrete labels; scoring stays on run 1.
      const savedLines = lines.length
      const savedMisses = misses.length
      snapshots.push(await once())
      lines.length = savedLines
      misses.length = savedMisses
    }

    let flipRate = 0
    if (RERUNS > 1 && snapshots.length > 1) {
      const keys = Object.keys(snapshots[0]!)
      let flips = 0
      for (const k of keys) {
        const vals = new Set(snapshots.map((s) => s[k] ?? ''))
        if (vals.size > 1) flips++
      }
      flipRate = keys.length ? flips / keys.length : 0
      lines.push(`rerun flip-rate ${pct(flipRate)}  (${RERUNS} runs, ${keys.length} item-labels)`)
      report['flipRate'] = flipRate
    }

    if (misses.length) {
      lines.push('')
      lines.push('misses')
      lines.push(...misses)
    }

    const snap = { ...usage, ms: [...usage.ms], models: [...usage.models] }
    const cost = costBlock(snap, allRows.length, provider === 'jev' ? env.typesafeModel() : model)
    const lat = {
      p50: percentile(snap.ms, 50),
      p95: percentile(snap.ms, 95),
      p99: percentile(snap.ms, 99),
    }
    lines.push('')
    lines.push(
      `tokens  in=${snap.in}  cached=${snap.cached}  out=${snap.out}  reasoning=${snap.reasoning}` +
        `   ${snap.calls} calls`,
    )
    lines.push(
      `latency p50=${lat.p50}ms  p95=${lat.p95}ms  p99=${lat.p99}ms   $${cost.total.toFixed(5)}` +
        `   $/1k=${cost.per1k.toFixed(4)}   $/2k-import=${cost.per2000.toFixed(4)}`,
    )
    const escalation = escalationD ? escalationN / escalationD : 0
    if (provider === 'cascade') {
      lines.push(`escalation     ${pct(escalation)}  (${escalationN}/${escalationD}) at τ=${tau}`)
    }
    report['usage'] = { ...snap, ms: undefined }
    report['latency'] = lat
    report['cost'] = cost
    report['escalation'] = escalation

    const calibration = bins(calSamples)
    if (calibration.length) {
      report['calibration'] = calibration
      lines.push(
        `calibration    ${calibration.map((b) => `${b.bin.toFixed(1)}:${b.count}/${b.accuracy.toFixed(2)}`).join('  ')}`,
      )
    }

    return {
      name: armName,
      provider,
      tau,
      report,
      lines,
      usage: snap,
      flipRate,
      escalation,
      calibration,
    }
  }

  for (const provider of selected) {
    const taus = provider === 'cascade' ? TAUS : [TAUS[0]!]
    for (const tau of taus) {
      const name = provider === 'cascade' ? `cascade@${tau}` : provider
      arms.push(await runArm(provider, tau, name))
    }
  }

  const outLines: string[] = []
  if (arms.length === 1) {
    outLines.push(...arms[0]!.lines)
  } else {
    outLines.push(`recognition eval — COMPARE ${arms.map((a) => a.name).join(' vs ')} — ${allRows.length} entries (split=${SPLIT})`)
    outLines.push('')
    outLines.push(
      'arm'.padEnd(16) +
        'prayersF1'.padStart(10) +
        'gateF1'.padStart(10) +
        'sentF1'.padStart(10) +
        'p50ms'.padStart(8) +
        'p95ms'.padStart(8) +
        '$total'.padStart(10) +
        '$/1k'.padStart(10) +
        'esc'.padStart(8),
    )
    for (const arm of arms) {
      const pr = (arm.report.prayers as { f1?: number } | undefined)?.f1
      const gt = (arm.report.gate as { f1?: number } | undefined)?.f1
      const se = (arm.report.sentiment as { micro?: { f1?: number } } | undefined)?.micro?.f1
      const lat = arm.report.latency as { p50: number; p95: number }
      const cost = arm.report.cost as { total: number; per1k: number }
      outLines.push(
        arm.name.padEnd(16) +
          pct(pr ?? NaN).padStart(10) +
          pct(gt ?? NaN).padStart(10) +
          pct(se ?? NaN).padStart(10) +
          String(lat.p50).padStart(8) +
          String(lat.p95).padStart(8) +
          cost.total.toFixed(5).padStart(10) +
          cost.per1k.toFixed(4).padStart(10) +
          pct(arm.escalation ?? 0).padStart(8),
      )
    }
    outLines.push('')
    for (const arm of arms) {
      outLines.push('─'.repeat(72))
      outLines.push(...arm.lines)
    }
  }

  const payload = {
    split: SPLIT,
    entries: allRows.length,
    reruns: RERUNS,
    arms: arms.map((a) => a.report),
  }

  writeReports(payload, outLines)
  if (JSON_OUT) realLog(JSON.stringify(payload, null, 2))
  else realLog(outLines.join('\n'))
}

function bins(samples: { p: number; ok: boolean }[]): { bin: number; count: number; meanProb: number; accuracy: number }[] {
  if (!samples.length) return []
  return Array.from({ length: 10 }, (_, i) => {
    const lo = i / 10
    const hi = (i + 1) / 10
    const inBin = samples.filter((s) => (i === 9 ? s.p >= lo && s.p <= hi : s.p >= lo && s.p < hi))
    const mean = inBin.length ? inBin.reduce((a, s) => a + s.p, 0) / inBin.length : 0
    const acc = inBin.length ? inBin.filter((s) => s.ok).length / inBin.length : 0
    return { bin: lo, count: inBin.length, meanProb: mean, accuracy: acc }
  })
}

function writeReports(json: unknown, lines: string[]): void {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'eval-results')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'recognition-eval.json'), JSON.stringify(json, null, 2) + '\n')
  writeFileSync(join(dir, 'recognition-eval.md'), `# Recognition eval\n\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
