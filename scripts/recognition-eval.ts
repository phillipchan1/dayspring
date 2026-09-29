// Import-recognition eval — score what Dayspring actually notices in imported
// prose, against a hand-labeled corpus.
//
//   npm run eval:recognition -- --dry --compare
//   npm run eval:recognition -- --compare=openai,jev,cascade --tau=0.6,0.7,0.8,0.9 --split=dev --reruns=3 --json
//   npm run eval:recognition -- --provider=jev --split=test --json
//   npm run eval:recognition -- --provider=jev --limit=24 --reruns=1 --json
//   npm run eval:recognition -- --only=sentiment --compare=openai,jev --limit=48 --reruns=1 --json
//   npm run eval:recognition -- --only=sentiment --provider=jev --sentiment-variant=tight+denial --split=dev --json
//   npm run eval:recognition -- --only=sentiment --provider=jev --sentiment-variant=tight+denial+thresholds --split=dev --json
//   npm run eval:recognition -- --only=sentiment --provider=jev --sentiment-variant=tight+denial+thresholds --split=test --sentiment-thresholds=eval-results/jev-sentiment-thresholds.json --json
//
// Lab only. Synthetic corpus. Never fails the build (exit 0) except on missing
// env when a live provider is selected. Do not point this at real journals.
//
// --compare without a value means openai,jev.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  breakdownByTaskAndModel,
  costPerPass,
  dollarsForCalls,
  mean,
  meanScore,
  taskOf,
  type PricedCall,
} from '../src/lib/recognition/evalReport.ts'

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
const variantArg = args.find((a) => a.startsWith('--sentiment-variant='))?.slice('--sentiment-variant='.length)
const thresholdsArg = args.find((a) => a.startsWith('--sentiment-thresholds='))?.slice('--sentiment-thresholds='.length)
const THRESHOLDS_PATH =
  thresholdsArg ??
  join(dirname(fileURLToPath(import.meta.url)), '..', 'eval-results', 'jev-sentiment-thresholds.json')

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
  lunaCached: Number(process.env.LUNA_PRICE_CACHED ?? 0.01),
  nanoIn: 0.2,
  nanoOut: 1.25,
  nanoCached: 0.02,
  embedIn: Number(process.env.EMBED_PRICE_IN ?? 0.02),
} as const

function priceOf(model: string): { inn: number; out: number; cached: number } {
  if (model.startsWith('jev')) return { inn: PRICE.jevIn, out: PRICE.jevOut, cached: 0 }
  if (model.includes('embed')) return { inn: PRICE.embedIn, out: 0, cached: PRICE.embedIn }
  if (model.includes('nano')) return { inn: PRICE.nanoIn, out: PRICE.nanoOut, cached: PRICE.nanoCached }
  return { inn: PRICE.lunaIn, out: PRICE.lunaOut, cached: PRICE.lunaCached }
}

type UsageSnap = {
  calls: number
  in: number
  cached: number
  out: number
  reasoning: number
  ms: number[]
  models: string[]
  items: PricedCall[]
}

let usageCalls: PricedCall[] = []
const realLog = console.log
console.log = (...a: unknown[]) => {
  const line = typeof a[0] === 'string' ? a[0] : ''
  if (line.startsWith('[tokens]')) {
    const num = (k: string) => Number(new RegExp(`\\b${k}=(\\d+)`).exec(line)?.[1] ?? 0)
    usageCalls.push({
      name: /\bname=(\S+)/.exec(line)?.[1] ?? '',
      model: /\bmodel=(\S+)/.exec(line)?.[1] ?? '',
      in: num('in'),
      cached: num('cached'),
      out: num('out'),
      reasoning: num('reasoning'),
      ms: num('ms'),
    })
    return
  }
  realLog(...a)
}

function snapFromCalls(items: PricedCall[]): UsageSnap {
  return {
    calls: items.length,
    in: items.reduce((s, c) => s + c.in, 0),
    cached: items.reduce((s, c) => s + c.cached, 0),
    out: items.reduce((s, c) => s + c.out, 0),
    reasoning: items.reduce((s, c) => s + c.reasoning, 0),
    ms: items.map((c) => c.ms).filter((n) => n > 0),
    models: items.map((c) => c.model).filter(Boolean),
    items,
  }
}

const pct = (n: number): string => (Number.isFinite(n) ? n.toFixed(3) : '—')

function percentile(values: number[], p: number): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))
  return s[idx]!
}

function costBlock(u: UsageSnap, entries: number, passes = 1): Record<string, unknown> {
  const compareCalls = u.items.filter((c) => taskOf(c.name) !== 'entities')
  const allPasses = dollarsForCalls(u.items, priceOf)
  const comparePasses = dollarsForCalls(compareCalls, priceOf)
  const headline = costPerPass(comparePasses, entries, passes)
  const entities = costPerPass(allPasses - comparePasses, entries, passes)
  const rows = breakdownByTaskAndModel(u.items, priceOf)
  const perPass = 1 / Math.max(1, passes)
  return {
    ...headline,
    entities: entities.total,
    allTasks: costPerPass(allPasses, entries, passes).total,
    byTaskModel: rows.map((r) => ({
      ...r,
      dollars: r.dollars * perPass,
      in: r.in * perPass,
      cached: r.cached * perPass,
      out: r.out * perPass,
      reasoning: r.reasoning * perPass,
      calls: r.calls * perPass,
    })),
  }
}

function fmtN(x: number): string {
  return Number.isInteger(x) || Math.abs(x - Math.round(x)) < 1e-6 ? String(Math.round(x)) : x.toFixed(1)
}

function scoreLine(
  name: string,
  s: { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number },
  tail = '',
): string {
  return (
    `${name.padEnd(14)} ${fmtN(s.tp).padStart(3)}  ${fmtN(s.fp).padStart(3)}  ${fmtN(s.fn).padStart(3)}` +
    `      ${pct(s.precision)}   ${pct(s.recall)}   ${pct(s.f1)}${tail ? '   ' + tail : ''}`
  )
}

function isScore(v: unknown): v is { tp: number; fp: number; fn: number; precision: number; recall: number; f1: number } {
  return !!v && typeof v === 'object' && 'f1' in v && 'precision' in v && 'tp' in v
}

function meanPassScores(reports: Record<string, unknown>[]): Record<string, unknown> {
  if (reports.length === 0) return {}
  if (reports.length === 1) return { ...reports[0] }
  const out: Record<string, unknown> = {}
  const keys = new Set(reports.flatMap((r) => Object.keys(r)))
  for (const k of keys) {
    const vals = reports.map((r) => r[k]).filter((v) => v !== undefined)
    if (vals.length === 0) continue
    if (k === 'prayers' && isScore(vals[0])) {
      const spans = vals as Array<
        ReturnType<typeof meanScore> & {
          typeAgreement?: { agreed: number; matched: number }
          failed?: number
          failures?: unknown[]
        }
      >
      out[k] = {
        ...meanScore(spans),
        typeAgreement: {
          agreed: mean(spans.map((s) => s.typeAgreement?.agreed ?? 0)),
          matched: mean(spans.map((s) => s.typeAgreement?.matched ?? 0)),
        },
        failed: mean(spans.map((s) => s.failed ?? 0)),
        failures: spans.flatMap((s) => (Array.isArray(s.failures) ? s.failures : [])),
      }
    } else if ((k === 'gate' || k === 'subjectAssignment') && isScore(vals[0])) {
      out[k] = meanScore(vals as Parameters<typeof meanScore>[0])
    } else if (
      (k === 'sentiment' || k === 'sentimentDev' || k === 'sentimentTest') &&
      vals[0] &&
      typeof vals[0] === 'object' &&
      'micro' in (vals[0] as object)
    ) {
      const rows = vals as Array<{
        present: { accuracy: number; n: number }
        valenceBucket: { accuracy: number; n: number }
        valenceMae: number
        micro: Parameters<typeof meanScore>[0][number]
        macro: { precision: number; recall: number; f1: number }
        perEmotion: Array<Parameters<typeof meanScore>[0][number] & { label: string }>
        misses: unknown
      }>
      out[k] = {
        ...rows[0],
        present: { accuracy: mean(rows.map((r) => r.present.accuracy)), n: rows[0]!.present.n },
        valenceBucket: {
          accuracy: mean(rows.map((r) => r.valenceBucket.accuracy)),
          n: rows[0]!.valenceBucket.n,
        },
        valenceMae: mean(rows.map((r) => r.valenceMae)),
        micro: meanScore(rows.map((r) => r.micro)),
        macro: {
          precision: mean(rows.map((r) => r.macro.precision)),
          recall: mean(rows.map((r) => r.macro.recall)),
          f1: mean(rows.map((r) => r.macro.f1)),
        },
        perEmotion: rows[0]!.perEmotion.map((lab, i) => ({
          ...meanScore(rows.map((r) => r.perEmotion[i] ?? lab)),
          label: lab.label,
        })),
      }
    } else {
      out[k] = vals[0]
    }
  }
  return out
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
  const { CORPUS, DESIGNED_THREADS, asEntryRows, filterSplit, splitForId, stratifiedSample } = await import(
    '../src/lib/recognition/corpus/index.ts'
  )
  const score = await import('../src/lib/recognition/score.ts')
  const { parseReferences } = await import('../src/lib/scripture/parse.ts')
  const { HARVEST_CUE, harvestTexts } = await import('../api/_lib/altar.ts')
  const { extractCandidates } = await import('../api/_lib/concordance.ts')
  const { tagTexts, groupTagged } = await import('../api/_lib/declared.ts')
  const { env } = await import('../api/_lib/env.ts')
  const { jevHarvestTexts, chunkForHarvest, estimateHarvestTokens, estimateGateTokens } = await import('../api/_lib/jev/harvest.ts')
  const { jevTagTexts, evalSubjectVocabulary } = await import('../api/_lib/jev/subjects.ts')
  const {
    estimateSentimentTokens,
    formatSentimentVariant,
    jevSentiment,
    parseSentimentVariant,
  } = await import('../api/_lib/jev/sentiment.ts')
  const { finalizeEmotions, fitEmotionThresholds } = await import('../api/_lib/jev/sentimentThresholds.ts')
  const { cascadeHarvest, cascadeTag, cascadeSentiment } = await import('../api/_lib/jev/cascade.ts')
  const { openaiSentiment } = await import('../api/_lib/jev/openaiSentiment.ts')
  const { estimateJevTokens } = await import('../api/_lib/typesafe.ts')
  const { splitSentences } = await import('../api/_lib/jev/sentences.ts')
  const { noul, choice } = await import('@typesafe-ai/sdk')

  let SENTIMENT_VARIANT
  try {
    SENTIMENT_VARIANT = parseSentimentVariant(variantArg)
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
  const variantLabel = formatSentimentVariant(SENTIMENT_VARIANT)
  type Fitted = Awaited<ReturnType<typeof fitEmotionThresholds>>
  const loadFittedThresholds = (): Fitted | null => {
    if (!SENTIMENT_VARIANT.thresholds) return null
    if (!existsSync(THRESHOLDS_PATH)) return null
    try {
      const raw = JSON.parse(readFileSync(THRESHOLDS_PATH, 'utf8')) as Fitted
      if (raw?.fittedOn === 'dev' && raw?.byEmotion) return raw
    } catch {
      return null
    }
    return null
  }
  const preloadedThresholds =
    SENTIMENT_VARIANT.thresholds && (Boolean(thresholdsArg) || SPLIT === 'test')
      ? loadFittedThresholds()
      : null

  const splitRows = filterSplit(asEntryRows(), SPLIT)
  const allRows = LIMIT
    ? stratifiedSample(splitRows, LIMIT, (r) => CORPUS.find((e) => e.id === r.id)?.category ?? 'unknown')
    : splitRows
  const keep = new Set(allRows.map((r) => r.id))
  const corpus = CORPUS.filter((e) => keep.has(e.id))
  const model = env.model()

  const cueHits = allRows.filter((r) => HARVEST_CUE.test(r.body_markdown))
  const prayerCalls = wants('prayers') ? Math.ceil(cueHits.length / 6) : 0
  const entityCalls = wants('entities') ? Math.ceil(allRows.length / 8) : 0
  const subjectLines = corpus.flatMap((e) => e.passages ?? [])
  const subjectCalls = wants('subjects') ? Math.ceil(subjectLines.length / 6) : 0
  const sentimentCalls = wants('sentiment') ? corpus.filter((e) => e.sentiment).length : 0
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
          jevTok += estimateGateTokens(r.body_markdown)
          const gold = CORPUS.find((e) => e.id === r.id)
          const likely = (gold?.passages?.length ?? 0) > 0 || HARVEST_CUE.test(r.body_markdown)
          if (likely) {
            const sentences = splitSentences(r.body_markdown)
            for (const chunk of chunkForHarvest(sentences)) {
              jevTok += estimateHarvestTokens(chunk)
            }
          }
        }
        if (wants('sentiment') && CORPUS.find((e) => e.id === r.id)?.sentiment) {
          jevTok += estimateSentimentTokens(r.body_markdown, SENTIMENT_VARIANT)
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
      `  corpus            ${allRows.length} entries (${CORPUS.length} available, split=${SPLIT}${LIMIT ? `, limit=${LIMIT} stratified` : ''})`,
      `  openai model      ${model}`,
      `  jev model         ${env.typesafeModel()}`,
      `  providers         ${selected.join(', ')}`,
      `  only              ${only ?? 'all axes'}`,
      `  sentiment variant ${variantLabel}`,
      `  tau               ${TAUS.join(', ')}`,
      `  reruns            ${RERUNS}`,
      `  cue prefilter     ${cueHits.length}/${allRows.length} entries would reach the OpenAI harvest`,
      `  openai calls      prayers=${prayerCalls} entities=${entityCalls} subjects=${subjectCalls} sentiment=${sentimentCalls}  TOTAL=${openaiCalls}`,
      `  openai est. $     ~$${openaiCost.toFixed(3)} (rough; live run uses token logs)`,
      `  jev calls         harvest=1 gate + sentences only if gate-positive/low-τ (est. from gold/cue)  tag=${jevTagCalls} sentiment=${jevSentimentCalls}`,
      `  jev est. tokens   ${jevTok}  (~$${(jevCost).toFixed(4)} at $${PRICE.jevIn}/1M in, out free)`,
      `  vocab (subjects)  ${vocab.length} labels + none_of_these  — gold + DESIGNED_THREADS.forms + sibling/virtue distractors`,
      `  thread formation  ${process.env.OPENAI_API_KEY ? 'on (groupTagged embeddings)' : 'skipped without OPENAI_API_KEY; assignment still scored'}`,
      ``,
      `  scripture is deterministic and always free.`,
      `  Live: npm run eval:recognition -- --compare=openai,jev,cascade --tau=0.8 --split=test --json`,
      `  Sentiment A/B: npm run eval:recognition -- --only=sentiment --compare=openai,jev --sentiment-variant=${variantLabel} --split=dev --json`,
    ]
    realLog(lines.join('\n'))
    writeReports(
      {
        dry: true,
        split: SPLIT,
        only: only ?? null,
        sentimentVariant: variantLabel,
        providers: selected,
        taus: TAUS,
        entries: allRows.length,
        openaiCalls,
        jevTok,
        jevCost,
        openaiCost,
        vocab,
      },
      lines,
    )
    return
  }

  const arms: ArmResult[] = []

  const runArm = async (provider: Provider, tau: number, armName: string): Promise<ArmResult> => {
    usageCalls = []
    const report: Record<string, unknown> = {
      provider,
      tau,
      model: provider === 'jev' ? env.typesafeModel() : model,
      entries: allRows.length,
      split: SPLIT,
      sentimentVariant: variantLabel,
      only: only ?? null,
    }
    const lines: string[] = []
    const misses: string[] = []
    const calSamples: { p: number; ok: boolean }[] = []
    const esc = {
      harvest: { n: 0, d: 0 },
      subjects: { n: 0, d: 0 },
      sentiment: { n: 0, d: 0 },
    }

    lines.push(
      `recognition eval — ${armName} — ${allRows.length} entries (split=${SPLIT}${LIMIT ? `, limit=${LIMIT} stratified` : ''}${RERUNS > 1 ? `, ${RERUNS}-run mean` : ''}${wants('sentiment') ? `, sentiment=${variantLabel}` : ''})`,
    )
    lines.push(`model output varies run to run; a 1–2 point move is noise. use --json to diff runs.`)
    lines.push('')
    lines.push(`axis            TP   FP   FN   precision  recall     F1`)

    const row = (name: string, s: score.Score, tail = ''): void => {
      lines.push(scoreLine(name, s, tail))
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
    type PassBundle = { disc: Discrete; scores: Record<string, unknown>; misses: string[] }
    const snapshots: Discrete[] = []

    const once = async (): Promise<PassBundle> => {
      const disc: Discrete = {}
      const scores: Record<string, unknown> = {}
      const passMisses: string[] = []

      if (wants('prayers')) {
        let byEntry = new Map<string, { type: 'prayer' | 'sense'; text: string }[]>()
        let failed: string[] = []
        let failures: { id: string; status?: number; code?: string; message: string }[] = []
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
          failures = harvested.failures
          scores.skippedSentences = harvested.skippedSentences.length
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
          failures = harvested.failures
          scores.skippedSentences = harvested.skippedSentences.length
          for (const r of allRows) {
            const g = harvested.gate.get(r.id)
            gateMap.set(r.id, g ? g.containsPrayer || g.containsSense : (byEntry.get(r.id) ?? []).length > 0)
            if (harvested.route.get(r.id) === 'llm') esc.harvest.n++
            esc.harvest.d++
          }
        }

        const actual = [...byEntry].flatMap(([entryId, ps]) =>
          ps.map((p) => ({ entryId, type: p.type, text: p.text })),
        )
        const s = score.scorePassages(actual, keep)
        scores.prayers = { ...s.span, typeAgreement: s.typeAgreement, failed: failed.length, failures }

        const gate = score.scoreGate((id) => gateMap.get(id) === true, keep)
        scores.gate = gate

        for (const m of s.misses.slice(0, 8)) {
          passMisses.push(`  prayers ${m.kind.toUpperCase()}    ${m.entryId.padEnd(26)} ${JSON.stringify(m.detail)}`)
        }
        for (const f of failures) {
          passMisses.push(
            `  harvest ERR    ${f.id.padEnd(26)} HTTP ${f.status ?? '—'} ${f.code ?? f.message}`,
          )
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
        scores.entities = { ...s.identity, kindAgreement: s.kindAgreement, descriptors: s.descriptors, failed: failed.length }
        for (const m of s.misses.slice(0, 8)) {
          passMisses.push(`  entities ${m.kind.toUpperCase()}   ${m.entryId.padEnd(26)} ${m.detail}`)
        }
      } else if (wants('entities') && provider !== 'openai') {
        scores.entitiesSkipped = provider
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
            if (res.route.get(l.key) === 'llm') esc.subjects.n++
            esc.subjects.d++
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

        const canEmbed = Boolean(process.env.OPENAI_API_KEY)
        if (canEmbed) {
          const plan = await groupTagged(items)
          const formed = plan.subjects.map((s) => s.label.toLowerCase())
          const shouldForm = DESIGNED_THREADS.forms.map((f) => f.toLowerCase())
          const shouldNot = DESIGNED_THREADS.nearMisses.map((n) => n.label.toLowerCase())
          const got = shouldForm.filter((f) => formed.includes(f))
          const wrong = shouldNot.filter((f) => formed.includes(f))
          const extra = formed.filter((f) => !shouldForm.includes(f) && !shouldNot.includes(f))
          scores.subjects = { formed, expected: shouldForm, wronglyFormed: wrong, extra, skipped: false }
          for (const f of shouldForm.filter((x) => !got.includes(x))) {
            passMisses.push(`  subjects FN    ${'—'.padEnd(26)} "${f}" did not form a thread`)
          }
          for (const f of wrong) {
            const why = DESIGNED_THREADS.nearMisses.find((n) => n.label.toLowerCase() === f)?.fails
            passMisses.push(`  subjects FP    ${'—'.padEnd(26)} "${f}" formed despite ${why}`)
          }
        } else {
          console.log(
            'thread formation skipped — OPENAI_API_KEY absent (groupTagged embeddings). Subject assignment still scored.',
          )
          scores.subjects = { skipped: true, reason: 'OPENAI_API_KEY absent' }
        }

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
        scores.subjectAssignment = assign
        for (const [id, labels] of byEntry) disc[`subj:${id}`] = labels.map((x) => x.toLowerCase()).sort().join('|')
      }

      if (wants('sentiment')) {
        const annotated = corpus.filter((e) => e.sentiment)
        type Raw = {
          entryId: string
          present: boolean
          valence: score.ModelSentiment['valence']
          valenceNumeric?: number
          probs: Partial<Record<string, number>>
          denied: string[]
          primary: string | null
          emotions: score.ModelSentiment['emotions']
        }
        const raw: Raw[] = []
        for (const e of annotated) {
          try {
            const reading =
              provider === 'openai'
                ? await openaiSentiment(e.body)
                : provider === 'jev'
                  ? await jevSentiment(e.body, { tau, variant: SENTIMENT_VARIANT, thresholds: preloadedThresholds })
                  : await cascadeSentiment(e.body, { tau, variant: SENTIMENT_VARIANT, thresholds: preloadedThresholds })
            if (provider === 'cascade') {
              esc.sentiment.d++
              if ('route' in reading && reading.route === 'llm') esc.sentiment.n++
            }
            if (provider === 'jev') {
              calSamples.push({ p: reading.confidence, ok: reading.present === e.sentiment!.present })
            }
            raw.push({
              entryId: e.id,
              present: reading.present,
              valence: reading.valenceBucket,
              valenceNumeric: reading.valenceExpected ?? reading.valence,
              probs: reading.probs.emotions ?? {},
              denied: reading.denied ?? [],
              primary: reading.primary,
              emotions: reading.emotions,
            })
          } catch {
            passMisses.push(`  sentiment ERR   ${e.id}`)
          }
        }

        let usedThresholds = preloadedThresholds
        if (SENTIMENT_VARIANT.thresholds && provider !== 'openai') {
          if (!usedThresholds) {
            const devSamples = raw
              .filter((r) => splitForId(r.entryId) === 'dev')
              .map((r) => ({
                id: r.entryId,
                gold: CORPUS.find((e) => e.id === r.entryId)?.sentiment?.emotions ?? [],
                probs: r.probs,
              }))
            if (SPLIT === 'test' && devSamples.length === 0) {
              passMisses.push(
                '  sentiment NOTE  thresholds requested on --split=test but no fitted file — using the shared 0.5 bar. Fit on --split=dev first.',
              )
            } else if (devSamples.length) {
              usedThresholds = fitEmotionThresholds(devSamples, { variant: variantLabel })
              mkdirSync(dirname(THRESHOLDS_PATH), { recursive: true })
              writeFileSync(THRESHOLDS_PATH, JSON.stringify(usedThresholds, null, 2) + '\n')
              scores.sentimentThresholdsPath = THRESHOLDS_PATH
              scores.sentimentThresholds = usedThresholds
            }
          } else {
            scores.sentimentThresholdsPath = THRESHOLDS_PATH
            scores.sentimentThresholds = usedThresholds
          }
          for (const row of raw) {
            row.emotions = finalizeEmotions({
              present: row.present,
              probs: row.probs,
              denied: row.denied,
              primary: row.primary,
              thresholds: usedThresholds,
            })
          }
        }

        const actual: score.ModelSentiment[] = raw.map((r) => ({
          entryId: r.entryId,
          present: r.present,
          valence: r.valence,
          valenceNumeric: r.valenceNumeric,
          emotions: r.emotions,
        }))
        for (const r of raw) {
          disc[`sent:${r.entryId}`] = `${r.present ? 1 : 0}:${r.valence}:${[...r.emotions].sort().join(',')}`
        }
        const s = score.scoreSentiment(actual, keep)
        scores.sentiment = s
        const devIds = new Set(actual.filter((a) => splitForId(a.entryId) === 'dev').map((a) => a.entryId))
        const testIds = new Set(actual.filter((a) => splitForId(a.entryId) === 'test').map((a) => a.entryId))
        if (devIds.size) scores.sentimentDev = score.scoreSentiment(actual, devIds)
        if (testIds.size) scores.sentimentTest = score.scoreSentiment(actual, testIds)
        scores.sentimentSplitNote =
          SENTIMENT_VARIANT.thresholds && usedThresholds
            ? usedThresholds.fittedOn === 'dev'
              ? 'thresholds fitted on dev only; sentimentTest is the honest number'
              : 'thresholds loaded from file'
            : null
        for (const m of s.misses.slice(0, 8)) {
          passMisses.push(`  sentiment ${m.kind.toUpperCase()}  ${m.entryId.padEnd(26)} ${m.detail}`)
        }
      }

      return { disc, scores, misses: passMisses }
    }

    const passes: PassBundle[] = []
    for (let r = 0; r < RERUNS; r++) {
      const pass = await once()
      snapshots.push(pass.disc)
      passes.push(pass)
    }

    const meanScores = meanPassScores(passes.map((p) => p.scores))
    Object.assign(report, meanScores)
    report['reruns'] = passes.map((p) => p.scores)
    misses.push(...(passes[0]?.misses ?? []))

    const prayers = meanScores.prayers as
      | (score.Score & {
          typeAgreement?: { agreed: number; matched: number }
          failed?: number
          failures?: { id: string; status?: number; code?: string; message: string }[]
        })
      | undefined
    if (prayers && isScore(prayers)) {
      lines.push(scoreLine('prayers', prayers))
      if (prayers.typeAgreement) {
        lines.push(
          `  type agree    ${fmtN(prayers.typeAgreement.agreed)}/${fmtN(prayers.typeAgreement.matched)} (${pct(
            prayers.typeAgreement.matched ? prayers.typeAgreement.agreed / prayers.typeAgreement.matched : 1,
          )})`,
        )
      }
      const harvestFails = prayers.failures ?? []
      if (harvestFails.length) {
        lines.push(`  ${harvestFails.length} harvest failures`)
        for (const f of harvestFails.slice(0, 16)) {
          lines.push(`    ${f.id}  HTTP ${f.status ?? '—'}  ${f.code ?? f.message}`)
        }
      } else if (prayers.failed) {
        lines.push(`  ${fmtN(prayers.failed)} entries in failed batches (not scored)`)
      }
    }
    if (typeof meanScores.skippedSentences === 'number') {
      lines.push(
        `  gate-first     skipped sentence harvest for ${fmtN(meanScores.skippedSentences as number)}/${allRows.length} entries`,
      )
    }
    if (isScore(meanScores.gate)) lines.push(scoreLine('gate', meanScores.gate))
    if (meanScores.entitiesSkipped) {
      lines.push(`entities       —    —    —      (OpenAI-only axis; skipped for ${meanScores.entitiesSkipped})`)
    } else if (meanScores.entities && typeof meanScores.entities === 'object') {
      const ent = meanScores.entities as score.Score & {
        kindAgreement?: { agreed: number; matched: number }
        descriptors?: { kept: number; proposed: number }
        failed?: number
      }
      if (isScore(ent)) {
        lines.push(scoreLine('entities', ent))
        if (ent.kindAgreement) {
          lines.push(
            `  kind agree    ${ent.kindAgreement.agreed}/${ent.kindAgreement.matched} (${pct(
              ent.kindAgreement.matched ? ent.kindAgreement.agreed / ent.kindAgreement.matched : 1,
            )})`,
          )
        }
        if (ent.descriptors) {
          lines.push(
            `  descriptors   ${ent.descriptors.kept}/${ent.descriptors.proposed} survived the evaluative gate correctly`,
          )
        }
        lines.push(`  NOTE: entity precision is a lower bound — see the misses, not the number`)
        if (ent.failed) lines.push(`  ${ent.failed} entries in failed batches (not scored)`)
      }
    }
    const subjects = meanScores.subjects as
      | { skipped?: boolean; reason?: string; formed?: string[]; expected?: string[]; wronglyFormed?: string[]; extra?: string[] }
      | undefined
    if (subjects?.skipped) {
      lines.push(
        `subjects      —    —    —      thread formation skipped (${subjects.reason}); assignment still scored`,
      )
    } else if (subjects?.expected) {
      const formed = subjects.formed ?? []
      const shouldForm = subjects.expected
      const got = shouldForm.filter((f) => formed.includes(f))
      const extra = subjects.extra ?? []
      const wrong = subjects.wronglyFormed ?? []
      lines.push(
        `subjects      ${String(got.length).padStart(3)}  ${String(extra.length).padStart(3)}  ` +
          `${String(shouldForm.length - got.length).padStart(3)}` +
          `      ${pct(formed.length ? got.length / formed.length : 1)}   ` +
          `${pct(shouldForm.length ? got.length / shouldForm.length : 1)}           ${wrong.length} near-miss threads wrongly formed`,
      )
    }
    if (isScore(meanScores.subjectAssignment)) lines.push(scoreLine('subj assign', meanScores.subjectAssignment))
    const sentShape = (s: unknown) =>
      s && typeof s === 'object' && 'micro' in s
        ? (s as {
            present: { accuracy: number }
            valenceBucket: { accuracy: number }
            valenceMae: number
            micro: { f1: number }
            macro: { f1: number }
            perEmotion: Array<score.Score & { label: string; tp: number; fp: number; fn: number; precision: number; recall: number }>
          })
        : undefined
    const printSent = (sent: NonNullable<ReturnType<typeof sentShape>>, title: string, note?: string): void => {
      lines.push(
        `${title.padEnd(14)} present acc=${pct(sent.present.accuracy)}  valence acc=${pct(sent.valenceBucket.accuracy)}  MAE=${sent.valenceMae.toFixed(3)}  micro F1=${pct(sent.micro.f1)}  macro F1=${pct(sent.macro.f1)}${note ? `  ${note}` : ''}`,
      )
      for (const lab of sent.perEmotion) {
        lines.push(
          `  ${lab.label.padEnd(12)} ${fmtN(lab.tp).padStart(3)}  ${fmtN(lab.fp).padStart(3)}  ${fmtN(lab.fn).padStart(3)}      ${pct(lab.precision)}   ${pct(lab.recall)}   ${pct(lab.f1)}`,
        )
      }
    }
    const sent = sentShape(meanScores.sentiment)
    const sentDev = sentShape(meanScores.sentimentDev)
    const sentTest = sentShape(meanScores.sentimentTest)
    if (sent && sentDev && sentTest) {
      printSent(sentDev, 'sentiment dev', SENTIMENT_VARIANT.thresholds ? '(thresholds fitted here — optimistic)' : undefined)
      printSent(sentTest, 'sentiment test', SENTIMENT_VARIANT.thresholds ? '(thresholds applied, not fitted)' : undefined)
    } else if (sent) {
      const note =
        SPLIT === 'dev' && SENTIMENT_VARIANT.thresholds
          ? '(dev — thresholds fitted here; do not ship on this number)'
          : SPLIT === 'test' && SENTIMENT_VARIANT.thresholds
            ? '(test — thresholds from file or shared 0.5 bar)'
            : undefined
      printSent(sent, 'sentiment', note)
    }
    if (meanScores.sentimentThresholdsPath) {
      lines.push(`  thresholds    ${meanScores.sentimentThresholdsPath}`)
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

    const snap = snapFromCalls([...usageCalls])
    const costEntries = only === 'sentiment' ? corpus.filter((e) => e.sentiment).length : allRows.length
    const cost = costBlock(snap, costEntries, RERUNS)
    const lat = {
      p50: percentile(snap.ms, 50),
      p95: percentile(snap.ms, 95),
      p99: percentile(snap.ms, 99),
    }
    lines.push('')
    const perPassIn = RERUNS ? snap.in / RERUNS : snap.in
    const perPassOut = RERUNS ? snap.out / RERUNS : snap.out
    const perPassCalls = RERUNS ? snap.calls / RERUNS : snap.calls
    lines.push(
      `tokens  in=${Math.round(perPassIn)}  cached=${Math.round(snap.cached / RERUNS)}  out=${Math.round(perPassOut)}  reasoning=${Math.round(snap.reasoning / RERUNS)}` +
        `   ${Math.round(perPassCalls)} calls/pass` +
        (RERUNS > 1 ? `  (${RERUNS} passes; $ and $/1k are per pass)` : ''),
    )
    const costTotal = cost.total as number
    const costPer1k = cost.per1k as number
    const costPer2000 = cost.per2000 as number
    const costPerItem = (cost.perItem as number) ?? (costEntries ? costTotal / costEntries : 0)
    lines.push(
      `latency p50=${lat.p50}ms  p95=${lat.p95}ms  p99=${lat.p99}ms   $${costTotal.toFixed(5)}` +
        `   $/item=${costPerItem.toFixed(5)}   $/1k=${costPer1k.toFixed(4)}   $/2k-import=${costPer2000.toFixed(4)}` +
        `   (compare $; entities excluded${only === 'sentiment' ? `; $/item over ${costEntries} sentiment items` : ''})`,
    )
    if (typeof cost.entities === 'number' && cost.entities > 0) {
      lines.push(`  entities (OpenAI-only, not in compare $)  $${(cost.entities as number).toFixed(5)}`)
    }
    const byTask = (cost.byTaskModel as { task: string; model: string; calls: number; in: number; dollars: number }[]) ?? []
    if (byTask.length) {
      lines.push(`  cost by task/model`)
      for (const row of byTask) {
        lines.push(
          `    ${row.task.padEnd(10)} ${row.model.padEnd(22)} calls=${fmtN(row.calls)}  in=${Math.round(row.in)}  $${row.dollars.toFixed(5)}`,
        )
      }
    }
    const escRate = (pair: { n: number; d: number }) => (pair.d ? pair.n / pair.d : 0)
    const escalation = {
      harvest: escRate(esc.harvest),
      subjects: escRate(esc.subjects),
      sentiment: escRate(esc.sentiment),
      combined: escRate({
        n: esc.harvest.n + esc.subjects.n + esc.sentiment.n,
        d: esc.harvest.d + esc.subjects.d + esc.sentiment.d,
      }),
      counts: esc,
    }
    if (provider === 'cascade') {
      lines.push(
        `escalation     harvest=${pct(escalation.harvest)}  subjects=${pct(escalation.subjects)}  sentiment=${pct(escalation.sentiment)}  combined=${pct(escalation.combined)}  at τ=${tau}`,
      )
    }
    report['usage'] = { calls: snap.calls, in: snap.in, cached: snap.cached, out: snap.out, reasoning: snap.reasoning, models: [...new Set(snap.models)] }
    report['latency'] = lat
    report['cost'] = cost
    report['escalation'] = escalation
    report['sentimentVariant'] = variantLabel
    report['only'] = only ?? null

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
      escalation: escalation.combined,
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
    outLines.push(`$total / $/1k exclude entity extraction (OpenAI-only). Escalation column is combined; per-task rates are in each arm.`)
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
      const se = (
        (SENTIMENT_VARIANT.thresholds
          ? (arm.report.sentimentTest as { micro?: { f1?: number } } | undefined)
          : undefined) ?? (arm.report.sentiment as { micro?: { f1?: number } } | undefined)
      )?.micro?.f1
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
    only: only ?? null,
    sentimentVariant: variantLabel,
    entries: allRows.length,
    limit: LIMIT ?? null,
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
