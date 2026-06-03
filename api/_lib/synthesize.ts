// The core. FACTS are computed in code. QUOTES / EXCERPTS / EBENEZER pairings
// are selected by the model but validated server-side — anything that doesn't
// exact-match a real source is discarded. PROSE (synthesis, letter, gain,
// throughline, themes) is generated, grounded by feeding only the level beneath
// + strict prompt rules. Never log entry text (§8): ids and counts only.

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from './supabaseAdmin'
import { env } from './env'
import { computeFacts, type FactEntry } from './facts'
import { callModel } from './openai'
import {
  WEEKLY_SYSTEM_PROMPT,
  MONTHLY_SYSTEM_PROMPT,
  QUARTERLY_SYSTEM_PROMPT,
  YEARLY_SYSTEM_PROMPT,
  WEEKLY_SCHEMA,
  MONTHLY_SCHEMA,
  QUARTERLY_SCHEMA,
  YEARLY_SCHEMA,
} from './prompts'
import { addDays, dateStrToUTC, periodWindow, toDateStr, type Period } from './dates'
import { deriveTitle, humanizeObservationText, labelsFromEntries } from './entryLabels'
import type {
  Arc,
  EbenezerPair,
  Excerpt,
  Highlight,
  MonthlyModelOutput,
  Observation,
  QuarterlyModelOutput,
  Quote,
  RawArc,
  RawExcerpt,
  RawHighlight,
  RawPair,
  RawQuestion,
  RawRefrain,
  RawTension,
  ReflectionContent,
  ReflectionQuestion,
  Refrain,
  RollupPayload,
  RollupType,
  Tension,
  Topic,
  WeeklyModelOutput,
  WinCandidate,
  YearlyModelOutput,
} from './types'

export interface BuildResult {
  type: RollupType
  period: Period
  status: 'built' | 'skipped'
  reason?: string
  quotes?: number
  topics?: number
  observation?: boolean
  ebenezer?: number
  questions?: number
  arcs?: number
  tensions?: number
  refrain?: boolean
  highlights?: number
}

// ── validation (the no-fabrication gate) ───────────────────────────────────

/** Max chars of each entry body fed to the weekly model (input-token cap). */
const MAX_ENTRY_CHARS = 1800

interface Source {
  date: string
  text: string
}

/** Keep only quotes that exact-match (as a substring) a real source we passed. */
export function validateQuotes(quotes: Quote[], sources: Map<string, Source[]>): Quote[] {
  const out: Quote[] = []
  const seen = new Set<string>()
  for (const q of quotes ?? []) {
    const text = (q?.text ?? '').trim()
    if (!text) continue
    const candidates = sources.get(q.entry_id)
    if (!candidates) continue
    const match = candidates.find((c) => c.text.includes(text))
    if (!match) continue
    const key = `${q.entry_id} ${text}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ entry_id: q.entry_id, date: match.date, text })
    if (out.length >= 4) break
  }
  return out
}

/** Topics with only real ids; count is forced to equal the verified id list. */
export function validateTopics(topics: Topic[], validIds: Set<string>): Topic[] {
  return (topics ?? [])
    .slice(0, 5)
    .map((t) => {
      const ids = [...new Set((t?.entry_ids ?? []).filter((id) => validIds.has(id)))]
      return { label: String(t?.label ?? '').trim(), count: ids.length, entry_ids: ids }
    })
    .filter((t) => t.label.length > 0 && t.entry_ids.length > 0)
}

/** ≤1 sentence, neutral, evidence-cited — or null so the UI hides the block. */
export function validateObservation(
  observation: { text?: string; evidence?: { topic?: string; entry_ids?: string[] }[] } | undefined,
  validIds: Set<string>,
  entryLabels: Record<string, string> = {},
): Observation | null {
  const raw = (observation?.text ?? '').trim()
  if (!raw) return null
  const text = humanizeObservationText(raw, entryLabels)
  const evidence = (observation?.evidence ?? [])
    .map((e) => {
      const ids = [...new Set((e?.entry_ids ?? []).filter((id) => validIds.has(id)))]
      return { topic: String(e?.topic ?? '').trim(), count: ids.length, entry_ids: ids }
    })
    .filter((e) => e.entry_ids.length > 0)
  return { text, evidence }
}

const UUID_SRC = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_RE = new RegExp(UUID_SRC, 'gi')
const UUID_PAREN_RE = new RegExp(`\\(\\s*${UUID_SRC}\\s*,?\\s*`, 'gi')

/** Belt-and-braces: strip any raw entry UUIDs the model slipped into prose, and
 *  tidy the punctuation/whitespace left behind (e.g. "(uuid, 2026-04-07)" → "(2026-04-07)"). */
function stripIds(s: string): string {
  return s
    .replace(UUID_PAREN_RE, '(')
    .replace(UUID_RE, '')
    .replace(/\(\s*,\s*/g, '(')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+([.,;:)])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Trim prose paragraphs, strip stray ids, drop empties. Not verbatim-validated. */
function cleanProse(arr: string[] | undefined): string[] {
  return (arr ?? []).map((s) => stripIds((s ?? '').trim())).filter((s) => s.length > 0)
}

/** Reflective-Prompting output: non-empty, addressee ∈ {self,God}, max 3. */
function validateQuestions(qs: RawQuestion[] | undefined): ReflectionQuestion[] {
  const out: ReflectionQuestion[] = []
  for (const q of qs ?? []) {
    // Drop a redundant addressee label: "self," / "self:" / "God:" — but keep a
    // natural prayer vocative ("God, …" / "Lord, …") on questions to God.
    const text = stripIds((q?.text ?? '').trim())
      .replace(/^self\s*[:,]\s*/i, '')
      .replace(/^god\s*:\s*/i, '')
    if (!text) continue
    out.push({ id: `q${out.length + 1}`, text, addressee: q.addressee === 'God' ? 'God' : 'self' })
    if (out.length >= 3) break
  }
  return out
}

/** AI-prefilled win candidates: non-empty, max 3. */
function candidateWins(list: string[] | undefined, prefix: string): WinCandidate[] {
  const out: WinCandidate[] = []
  for (const t of list ?? []) {
    const text = (t ?? '').trim()
    if (!text) continue
    out.push({ id: `${prefix}${out.length + 1}`, text })
    if (out.length >= 3) break
  }
  return out
}

function matchExcerpt(e: RawExcerpt | undefined, sources: Map<string, Source[]>): Excerpt | null {
  const text = (e?.text ?? '').trim()
  if (!e || !text) return null
  const cands = sources.get(e.entry_id)
  if (!cands) return null
  const m = cands.find((c) => c.text.includes(text))
  if (!m) return null
  return { entry_id: e.entry_id, date: m.date, text }
}

/** Ebenezer pairings: both texts must validate verbatim; "later" dated ≥ "ask". */
function validatePairs(pairs: RawPair[] | undefined, sources: Map<string, Source[]>): EbenezerPair[] {
  const out: EbenezerPair[] = []
  for (const p of pairs ?? []) {
    const ask = matchExcerpt(p?.ask, sources)
    const later = matchExcerpt(p?.later, sources)
    if (!ask || !later) continue
    if (later.date < ask.date) continue
    out.push({ id: `s${out.length + 1}`, ask, later })
    if (out.length >= 6) break
  }
  return out
}

function excerptsFromQuotes(quotes: Quote[]): Excerpt[] {
  return quotes.map((q) => ({ entry_id: q.entry_id, date: q.date, text: q.text }))
}

/** THEMES grounded in the writer's own words. Each highlight's quotes run through
 *  the SAME verbatim gate as `quotes` — fabricated lines are dropped — and a theme
 *  needs ≥2 surviving quotes to stand (a theme is a pattern, not a single line).
 *  The label is the one interpretive move (cleaned, never a verdict). Max 4. */
function validateHighlights(raw: RawHighlight[] | undefined, sources: Map<string, Source[]>): Highlight[] {
  const out: Highlight[] = []
  for (const h of raw ?? []) {
    const label = stripIds((h?.label ?? '').trim())
    if (!label) continue
    const quotes = validateQuotes((h?.quotes ?? []) as Quote[], sources)
    if (quotes.length < 2) continue
    out.push({ id: `h${out.length + 1}`, label, quotes: excerptsFromQuotes(quotes) })
    if (out.length >= 4) break
  }
  return out
}

/** HILLSIDE arcs: keep only real entry_ids; weight is the verified id count (the
 *  app shows it). name/note are the tentative interpretive move — cleaned, never
 *  fabricated into a verdict. Drop empty or zero-weight arcs; max 5. */
function validateArcs(arcs: RawArc[] | undefined, validIds: Set<string>): Arc[] {
  const out: Arc[] = []
  for (const a of arcs ?? []) {
    const ids = [...new Set((a?.entry_ids ?? []).filter((id) => validIds.has(id)))]
    const name = stripIds((a?.name ?? '').trim())
    const note = stripIds((a?.note ?? '').trim())
    if (!name || ids.length === 0) continue
    out.push({ id: `a${out.length + 1}`, name, note, weight: ids.length, entry_ids: ids })
    if (out.length >= 5) break
  }
  return out
}

/** RIDGE tensions: non-empty thread + question, ids stripped. The question is
 *  handed back, never a verdict — same prefix-cleanup as questions; max 3. */
function validateTensions(tensions: RawTension[] | undefined): Tension[] {
  const out: Tension[] = []
  for (const t of tensions ?? []) {
    const thread = stripIds((t?.thread ?? '').trim()).replace(/^self\s*[:,]\s*/i, '')
    const question = stripIds((t?.question ?? '').trim()).replace(/^self\s*[:,]\s*/i, '')
    if (!thread || !question) continue
    out.push({ id: `t${out.length + 1}`, thread, question })
    if (out.length >= 3) break
  }
  return out
}

/** SUMMIT refrain (hard guardrail): the text must exact-match a candidate source
 *  verbatim, AND be found in the real entry body so we can store true offsets.
 *  Anything paraphrased or unlocatable is dropped — null, never invented. */
async function validateRefrain(
  raw: RawRefrain | null | undefined,
  sources: Map<string, Source[]>,
  sb: SupabaseClient,
  ownerId: string,
): Promise<Refrain | null> {
  const matched = matchExcerpt(raw ?? undefined, sources)
  if (!matched) return null
  const { data, error } = await sb
    .from('entries')
    .select('body_markdown')
    .eq('owner', ownerId)
    .eq('id', matched.entry_id)
    .maybeSingle()
  if (error) throw error
  const body = (data as { body_markdown?: string } | null)?.body_markdown ?? ''
  const at = body.indexOf(matched.text)
  if (at < 0) return null
  return {
    entry_id: matched.entry_id,
    date: matched.date,
    text: matched.text,
    char_start: at,
    char_end: at + matched.text.length,
  }
}

// ── persistence (idempotent upsert; partial index can't be an arbiter) ──────

interface InsightRow {
  owner: string
  type: RollupType
  period_start: string
  period_end: string
  source_ids: string[]
  structured_payload: RollupPayload
  source_model: string
}

async function upsertInsight(sb: SupabaseClient, row: InsightRow): Promise<void> {
  const { data: existing, error: selErr } = await sb
    .from('insights')
    .select('id')
    .eq('owner', row.owner)
    .eq('type', row.type)
    .eq('period_start', row.period_start)
    .eq('period_end', row.period_end)
    .maybeSingle()
  if (selErr) throw selErr

  const fields = {
    source_ids: row.source_ids,
    structured_payload: row.structured_payload,
    source_model: row.source_model,
    entry_id: null,
  }

  if (existing) {
    const { error } = await sb.from('insights').update(fields).eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await sb.from('insights').insert({
      owner: row.owner,
      type: row.type,
      period_start: row.period_start,
      period_end: row.period_end,
      ...fields,
    })
    if (error) throw error
  }
}

// ── reads ───────────────────────────────────────────────────────────────────

interface RawEntry {
  id: string
  created_at: string
  body_markdown: string
  word_count: number
}

async function fetchEntries(sb: SupabaseClient, ownerId: string, period: Period): Promise<RawEntry[]> {
  const { fromISO, toExclusiveISO } = periodWindow(period)
  const { data, error } = await sb
    .from('entries')
    .select('id, created_at, body_markdown, word_count')
    .eq('owner', ownerId)
    .gte('created_at', fromISO)
    .lt('created_at', toExclusiveISO)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as RawEntry[]
}

interface ChildInsightRow {
  id: string
  period_start: string
  period_end: string
  structured_payload: RollupPayload
}

/** Read child rollups of a given type whose period_start falls within `period`. */
async function fetchChildRollups(
  sb: SupabaseClient,
  ownerId: string,
  type: RollupType,
  period: Period,
): Promise<ChildInsightRow[]> {
  const { data, error } = await sb
    .from('insights')
    .select('id, period_start, period_end, structured_payload')
    .eq('owner', ownerId)
    .eq('type', type)
    .gte('period_start', period.start)
    .lte('period_start', period.end)
    .order('period_start', { ascending: true })
  if (error) throw error
  return (data ?? []) as ChildInsightRow[]
}

/** Build a verbatim-source map (entry_id → candidate texts) from rollup quotes. */
function sourcesFromRollups(rows: { structured_payload: RollupPayload }[]): {
  sources: Map<string, Source[]>
  validIds: Set<string>
} {
  const sources = new Map<string, Source[]>()
  const validIds = new Set<string>()
  for (const r of rows) {
    for (const q of r.structured_payload?.quotes ?? []) {
      const list = sources.get(q.entry_id) ?? []
      list.push({ date: q.date, text: q.text })
      sources.set(q.entry_id, list)
      validIds.add(q.entry_id)
    }
  }
  return { sources, validIds }
}

// ── builders ──────────────────────────────────────────────────────────────

/** Weekly: read raw entries → quotes/topics/observation + synthesis/wins/questions. */
export async function buildWeekly(ownerId: string, period: Period): Promise<BuildResult> {
  const sb = supabaseAdmin()
  const entries = await fetchEntries(sb, ownerId, period)
  if (entries.length === 0) {
    return { type: 'weekly', period, status: 'skipped', reason: 'no entries' }
  }

  const facts = computeFacts(entries as FactEntry[], period.start, period.end, null)
  const entryLabels = labelsFromEntries(entries)

  // Token diet: the model only needs enough text to pick quotes + read themes.
  // Validation below uses the FULL body, so quotes stay verbatim regardless.
  const input = entries.map((e) => ({
    id: e.id,
    date: e.created_at.slice(0, 10),
    title: deriveTitle(e.body_markdown) || 'Untitled',
    text: e.body_markdown.slice(0, MAX_ENTRY_CHARS),
  }))

  const sources = new Map<string, Source[]>()
  for (const e of entries) {
    sources.set(e.id, [{ date: e.created_at.slice(0, 10), text: e.body_markdown }])
  }
  const validIds = new Set(entries.map((e) => e.id))

  // Prior-week context for the backward (Gain-lens) comparison.
  const priorStart = toDateStr(addDays(dateStrToUTC(period.start), -7))
  const { data: priorRow } = await sb
    .from('insights')
    .select('structured_payload')
    .eq('owner', ownerId)
    .eq('type', 'weekly')
    .eq('period_start', priorStart)
    .maybeSingle()
  const prior = (priorRow?.structured_payload ?? null) as RollupPayload | null
  const priorWeek = prior
    ? {
        observation: prior.observation?.text ?? '',
        topics: (prior.topics ?? []).map((t) => ({ label: t.label, count: t.count })),
      }
    : null

  const model = await callModel<WeeklyModelOutput>(
    WEEKLY_SYSTEM_PROMPT,
    { this_week: input, prior_week: priorWeek },
    WEEKLY_SCHEMA as Record<string, unknown>,
    'weekly',
  )

  const quotes = validateQuotes(model.quotes, sources)
  const topics = validateTopics(model.topics, validIds)
  const observation = validateObservation(model.observation, validIds, entryLabels)
  const reflection: ReflectionContent = {
    synthesis: cleanProse(model.synthesis),
    citations: excerptsFromQuotes(quotes),
    wins: {
      thisWeek: candidateWins(model.wins?.this_week, 'wt'),
      nextWeek: candidateWins(model.wins?.next_week, 'wn'),
    },
    questions: validateQuestions(model.questions),
    highlights: validateHighlights(model.highlights, sources),
  }

  const payload: RollupPayload = {
    period: { type: 'weekly', start: period.start, end: period.end },
    quotes,
    facts,
    observation,
    topics,
    entry_labels: entryLabels,
    reflection,
    meta: { model: env.model(), generated_at: new Date().toISOString() },
  }

  await upsertInsight(sb, {
    owner: ownerId,
    type: 'weekly',
    period_start: period.start,
    period_end: period.end,
    source_ids: entries.map((e) => e.id),
    structured_payload: payload,
    source_model: env.model(),
  })

  return {
    type: 'weekly',
    period,
    status: 'built',
    quotes: quotes.length,
    topics: topics.length,
    observation: observation !== null,
    questions: reflection.questions?.length ?? 0,
    highlights: reflection.highlights?.length ?? 0,
  }
}

/** Monthly: read the WEEKLY insights → quotes + the letter/gain/themes. */
export async function buildMonthly(ownerId: string, period: Period): Promise<BuildResult> {
  const sb = supabaseAdmin()
  const weeklies = await fetchChildRollups(sb, ownerId, 'weekly', period)
  if (weeklies.length === 0) {
    return { type: 'monthly', period, status: 'skipped', reason: 'no weekly insights' }
  }

  // Facts: one cheap raw read of the month's entries for the numbers only.
  const entries = await fetchEntries(sb, ownerId, period)
  const facts = computeFacts(entries as FactEntry[], period.start, period.end, weeklies.length)

  const { sources, validIds } = sourcesFromRollups(weeklies)

  // Topics aggregated in code (deterministic; navigation, not insight).
  const topicMerge = new Map<string, { label: string; ids: Set<string> }>()
  for (const w of weeklies) {
    for (const t of w.structured_payload?.topics ?? []) {
      const key = t.label.trim().toLowerCase()
      if (!key) continue
      const merged = topicMerge.get(key) ?? { label: t.label.trim(), ids: new Set<string>() }
      for (const id of t.entry_ids ?? []) merged.ids.add(id)
      topicMerge.set(key, merged)
    }
  }
  const topics: Topic[] = [...topicMerge.values()]
    .map((m) => ({ label: m.label, count: m.ids.size, entry_ids: [...m.ids] }))
    .filter((t) => t.entry_ids.length > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  const entryLabels = labelsFromEntries(entries)

  const input = weeklies.map((w) => ({
    week_start: w.structured_payload?.period?.start,
    week_end: w.structured_payload?.period?.end,
    synthesis: w.structured_payload?.reflection?.synthesis ?? [],
    observation: w.structured_payload?.observation?.text ?? '',
    candidate_quotes: (w.structured_payload?.quotes ?? []).map((q) => ({
      entry_id: q.entry_id,
      date: q.date,
      title: deriveTitle(q.text) || 'Untitled',
      text: q.text,
    })),
    topics: (w.structured_payload?.topics ?? []).map((t) => ({
      label: t.label,
      count: t.count,
      entry_ids: t.entry_ids,
    })),
  }))

  const model = await callModel<MonthlyModelOutput>(
    MONTHLY_SYSTEM_PROMPT,
    input,
    MONTHLY_SCHEMA as Record<string, unknown>,
    'monthly',
  )

  const quotes = validateQuotes(model.quotes, sources) // candidates only
  const observation = validateObservation(model.observation, validIds, entryLabels)
  const gapWatch = stripIds((model.gap_watch ?? '').trim())
  // Arcs may cite any entry the model saw — weekly quote ids OR topic ids.
  const arcIds = new Set<string>(validIds)
  for (const w of weeklies) {
    for (const t of w.structured_payload?.topics ?? []) {
      for (const id of t.entry_ids ?? []) arcIds.add(id)
    }
  }
  const reflection: ReflectionContent = {
    letter: cleanProse(model.letter),
    gain: cleanProse(model.gain),
    ...(gapWatch ? { gapWatch } : {}),
    themes: cleanProse(model.themes),
    gainEvidence: excerptsFromQuotes(quotes),
    arcs: validateArcs(model.arcs, arcIds),
    highlights: validateHighlights(model.highlights, sources),
  }

  const payload: RollupPayload = {
    period: { type: 'monthly', start: period.start, end: period.end },
    quotes,
    facts,
    observation,
    topics,
    entry_labels: entryLabels,
    reflection,
    meta: { model: env.model(), generated_at: new Date().toISOString() },
  }

  await upsertInsight(sb, {
    owner: ownerId,
    type: 'monthly',
    period_start: period.start,
    period_end: period.end,
    source_ids: weeklies.map((w) => w.id),
    structured_payload: payload,
    source_model: env.model(),
  })

  return {
    type: 'monthly',
    period,
    status: 'built',
    quotes: quotes.length,
    topics: topics.length,
    observation: observation !== null,
    arcs: reflection.arcs?.length ?? 0,
    highlights: reflection.highlights?.length ?? 0,
  }
}

/** Quarterly: read the MONTHLY insights → retreat synthesis + questions + Ebenezer. */
export async function buildQuarterly(ownerId: string, period: Period): Promise<BuildResult> {
  const sb = supabaseAdmin()
  const monthlies = await fetchChildRollups(sb, ownerId, 'monthly', period)
  if (monthlies.length === 0) {
    return { type: 'quarterly', period, status: 'skipped', reason: 'no monthly insights' }
  }

  const entries = await fetchEntries(sb, ownerId, period)
  const facts = computeFacts(entries as FactEntry[], period.start, period.end, null)
  const { sources } = sourcesFromRollups(monthlies)

  const input = monthlies.map((m) => ({
    month_start: m.structured_payload?.period?.start,
    letter: m.structured_payload?.reflection?.letter ?? [],
    themes: m.structured_payload?.reflection?.themes ?? [],
    observation: m.structured_payload?.observation?.text ?? '',
    candidate_quotes: (m.structured_payload?.quotes ?? []).map((q) => ({
      entry_id: q.entry_id,
      date: q.date,
      text: q.text,
    })),
  }))

  const model = await callModel<QuarterlyModelOutput>(
    QUARTERLY_SYSTEM_PROMPT,
    input,
    QUARTERLY_SCHEMA as Record<string, unknown>,
    'quarterly',
    'medium',
  )

  const ebenezer = validatePairs(model.ebenezer, sources)
  const tensions = validateTensions(model.tensions)
  const reflection: ReflectionContent = {
    synthesis: cleanProse(model.synthesis),
    questions: validateQuestions(model.questions),
    ebenezer,
    tensions,
  }

  const payload: RollupPayload = {
    period: { type: 'quarterly', start: period.start, end: period.end },
    quotes: [],
    facts,
    observation: null,
    topics: [],
    reflection,
    meta: { model: env.model(), generated_at: new Date().toISOString() },
  }

  await upsertInsight(sb, {
    owner: ownerId,
    type: 'quarterly',
    period_start: period.start,
    period_end: period.end,
    source_ids: monthlies.map((m) => m.id),
    structured_payload: payload,
    source_model: env.model(),
  })

  return {
    type: 'quarterly',
    period,
    status: 'built',
    ebenezer: ebenezer.length,
    questions: reflection.questions?.length ?? 0,
    tensions: tensions.length,
  }
}

/** Yearly: read the MONTHLY insights → throughline + themes + answered stones. */
export async function buildYearly(ownerId: string, period: Period): Promise<BuildResult> {
  const sb = supabaseAdmin()
  const monthlies = await fetchChildRollups(sb, ownerId, 'monthly', period)
  if (monthlies.length === 0) {
    return { type: 'yearly', period, status: 'skipped', reason: 'no monthly insights' }
  }

  const entries = await fetchEntries(sb, ownerId, period)
  const facts = computeFacts(entries as FactEntry[], period.start, period.end, null)
  const { sources } = sourcesFromRollups(monthlies)

  const input = monthlies.map((m) => ({
    month_start: m.structured_payload?.period?.start,
    letter: m.structured_payload?.reflection?.letter ?? [],
    themes: m.structured_payload?.reflection?.themes ?? [],
    observation: m.structured_payload?.observation?.text ?? '',
    candidate_quotes: (m.structured_payload?.quotes ?? []).map((q) => ({
      entry_id: q.entry_id,
      date: q.date,
      text: q.text,
    })),
  }))

  const model = await callModel<YearlyModelOutput>(
    YEARLY_SYSTEM_PROMPT,
    input,
    YEARLY_SCHEMA as Record<string, unknown>,
    'yearly',
    'medium',
  )

  const stones = validatePairs(model.stones, sources)
  const refrain = await validateRefrain(model.refrain, sources, sb, ownerId)
  const reflection: ReflectionContent = {
    throughline: cleanProse(model.throughline),
    themes: cleanProse(model.themes),
    stones,
    ...(refrain ? { refrain } : {}),
  }

  const payload: RollupPayload = {
    period: { type: 'yearly', start: period.start, end: period.end },
    quotes: [],
    facts,
    observation: null,
    topics: [],
    reflection,
    meta: { model: env.model(), generated_at: new Date().toISOString() },
  }

  await upsertInsight(sb, {
    owner: ownerId,
    type: 'yearly',
    period_start: period.start,
    period_end: period.end,
    source_ids: monthlies.map((m) => m.id),
    structured_payload: payload,
    source_model: env.model(),
  })

  return { type: 'yearly', period, status: 'built', ebenezer: stones.length, refrain: refrain !== null }
}
