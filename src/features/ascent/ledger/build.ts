/**
 * THE YEAR'S LEDGER — built from what the writer actually did, in code.
 *
 * The Summit used to read the year through summaries of summaries: four quotes
 * a week, four of those a month, and a model asked to find the year in the
 * ~48 lines that survived. What survived was whatever quoted best, so the plain
 * thing someone prayed about for ten months never reached the year at all.
 *
 * Here the year is read directly. Every subject the writer's archive already
 * knows about — the Altar's declared threads (matters: what they prayed and
 * sensed about), the Concordance's names, the chapters of scripture they wrote
 * down — is counted month by month. The months merge into the year without
 * losing anything, so the year changes shape as months arrive. Then `score.ts`
 * ranks them by returning, never by eloquence.
 *
 * Everything carried out of here is the writer's own: verbatim lines, the
 * markings those lines already carry, verses from the same entries. Nothing
 * infers a mood; nothing paraphrases. Pure — no I/O — so it can be pinned.
 */

import { entryContentLines } from '@/lib/entryLabels'
import { stripMarkdownMarkers } from '@/lib/inlineMarkers'
import { ritualNamesIn } from '@/lib/ritualDisplay'
import { formatOsisRef } from '@/lib/scripture/format'
import {
  buildSubjectIndex,
  haystackFor,
  isAddressee,
  matchSubject,
  subjectMatcher,
  type Subject,
  type SubjectIndex,
} from '@/features/pages/subjects'
import type { Entry } from '@/lib/types'
import { DEFAULT_WEIGHTS, presence, score, type Weights } from './score'

// ── inputs ──────────────────────────────────────────────────────────────────

export type LineKind = 'prayer' | 'sense' | 'learned' | 'desire' | 'story'

/** A declared Altar thread and every line in it (all years). */
export interface MatterInput {
  id: string
  label: string
  members: { itemId: string; entryId: string | null; content: string; type: string }[]
}

export interface RefInput {
  entryId: string
  bookOsis: string
  chapter: number
  osisRef: string
  charStart: number | null
  charEnd: number | null
}

export interface MarkingInput {
  entryId: string
  type: string
  content: string
}

/** A movement the writer named on an Altar thread (`encounters`). */
export interface EncounterInput {
  threadId: string
  movement: string
  namedAt: string
  sourceEntryId: string | null
  reflection: string | null
}

export interface LedgerInput {
  entries: Pick<Entry, 'id' | 'created_at' | 'body_markdown' | 'word_count'>[]
  matters: MatterInput[]
  names: Subject[]
  refs: RefInput[]
  /** Markings for the year's entries (the only ones needed). */
  markings: MarkingInput[]
  encounters: EncounterInput[]
}

// ── outputs ─────────────────────────────────────────────────────────────────

export type ThreadKind = 'matter' | 'name' | 'verse'

export interface LedgerLine {
  entryId: string
  /** YYYY-MM-DD of the entry. */
  date: string
  month: number
  /** Verbatim. */
  text: string
  kind: LineKind
  flag: 'ask' | 'answered' | 'turn' | null
  /** Chapters of scripture written in the same entry, formatted. */
  refs: string[]
  /** Other shortlisted threads that share this entry (ids). */
  with: string[]
}

export interface LedgerEvent {
  month: number
  type: 'answered' | 'turn'
  label: string
}

export interface LedgerThread {
  id: string
  label: string
  kind: ThreadKind
  /** Entries carrying it, per month (index 0 = January). */
  perMonth: number[]
  lines: LedgerLine[]
  events: LedgerEvent[]
  markedMonths: number[]
  /** Came back after two or more quiet months. */
  returned: boolean
  /** Never shown to the writer. Decides order only. */
  score: number
  /** What the score was made of — for tuning (alpha only), never shown as a measure. */
  facts: { months: number; mentions: number; returns: number; movement: number; marked: number; prior: number }
}

export interface LedgerStoneMark {
  entryId: string
  date: string
  text: string
}

export interface LedgerStone {
  id: string
  threadId: string
  ask: LedgerStoneMark
  later: LedgerStoneMark
}

/** A ledger over any span of dates — a month, a season, a year. */
export interface LedgerRange {
  /** YYYY-MM-DD, inclusive. */
  from: string
  /** YYYY-MM-DD, inclusive. Pass today for a span that's still running. */
  to: string
}

export interface LedgerOptions {
  /** Threads kept after ranking. Infinity keeps every thread present. */
  keep?: number
  /** Pages a subject needs in the span to count as a thread at all. */
  minMentions?: number
  weights?: Weights
}

export interface RangeLedger {
  from: string
  to: string
  /** YYYY-MM keys the span covers, in order. `perMonth` and `month` index into it. */
  months: string[]
  threads: LedgerThread[]
  stones: LedgerStone[]
}

export interface YearLedger {
  year: number
  /** Months of the year the ledger covers (12 for a sealed year). */
  throughMonth: number
  /** Ranked, most significant first. Only subjects with a real presence. */
  threads: LedgerThread[]
  stones: LedgerStone[]
}

// ── helpers ─────────────────────────────────────────────────────────────────

const MAX_LINE = 260
/** A subject needs this many entries in the year to be a thread at all. */
const MIN_MENTIONS = 2
/** How many threads the ledger keeps (the Summit shows fewer). */
const KEEP = 12
/** Names carried past the cheap year-only pass. */
const NAME_CANDIDATES = 40

const PRAYER_MOVEMENTS = new Set(['answered', 'redirected', 'he_met_me', 'surrendered', 'he_changed_me'])
const MOVEMENT_LABEL: Record<string, string> = {
  answered: 'answered',
  redirected: 'redirected',
  he_met_me: 'He met you',
  surrendered: 'surrendered',
  he_changed_me: 'He changed you',
  borne_out: 'borne out',
  confirmed: 'confirmed',
  released: 'released',
  held: 'held',
  weighing: 'weighing',
}

export function dayOf(iso: string): string {
  return iso.slice(0, 10)
}
function yearOf(iso: string): number {
  return Number(iso.slice(0, 4))
}

export function toLineKind(type: string): LineKind {
  return type === 'prayer' || type === 'sense' || type === 'learned' || type === 'desire' ? type : 'story'
}

/** One verbatim line, trimmed to the sentence that holds the match when long. */
export function clip(text: string, match?: RegExp | null): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= MAX_LINE) return t
  const sentences = t.split(/(?<=[.!?])\s+/)
  if (match) {
    for (const s of sentences) {
      match.lastIndex = 0
      if (match.test(s)) return s.length <= MAX_LINE ? s : s.slice(0, MAX_LINE).trimEnd()
    }
  }
  const first = sentences[0] ?? t
  return first.length <= MAX_LINE ? first : first.slice(0, MAX_LINE).trimEnd()
}

/** Lines of an entry as the writer reads them: fences out, markers unwrapped. */
function plainLines(body: string): string[] {
  return entryContentLines(body)
    .map((l) => stripMarkdownMarkers(l).replace(/^#{1,6}\s+/, '').replace(/^[-*>]\s+/, '').trim())
    .filter((l) => l.length > 0)
}

/**
 * The writer set this entry apart: a highlight, an underline, a ritual.
 *
 * Deliberately NOT headings or length. On a real archive `##` headings are how
 * the writer files a page (Domains), and length is how they write on a full
 * morning — both were true of almost every entry, so every dot wore a ring and
 * the signal meant nothing. What's left is a gesture made on purpose.
 */
export function isMarkedEntry(body: string): boolean {
  if (/==(?:\{[^}]*\})?\S[^=\n]*==/.test(body)) return true
  if (/\+\+\S[^+\n]*\+\+/.test(body)) return true
  return ritualNamesIn(body).length > 0
}

/** Altar labels arrive lowercase ("trading"); names and acronyms keep theirs. */
export function displayLabel(label: string): string {
  const t = label.trim()
  return t.length > 0 && t[0] === t[0]!.toLowerCase() ? t[0]!.toUpperCase() + t.slice(1) : t
}

/** Share of the writer's EARLIER years (that hold any writing) a subject was in. */
function priorShare(yearsPresent: Set<number>, year: number, writtenYears: Set<number>): number {
  let earlier = 0
  let hit = 0
  for (const y of writtenYears) {
    if (y >= year) continue
    earlier++
    if (yearsPresent.has(y)) hit++
  }
  return earlier === 0 ? 0 : hit / earlier
}

// ── the build ───────────────────────────────────────────────────────────────

interface Draft {
  id: string
  label: string
  kind: ThreadKind
  /** entryId → lines found in it (kept in entry order). */
  byEntry: Map<string, { text: string; kind: LineKind; flag: LedgerLine['flag'] }[]>
  events: LedgerEvent[]
  prior: number
}

/** YYYY-MM keys from `from` to `to`, inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = []
  let y = +from.slice(0, 4)
  let m = +from.slice(5, 7)
  const endY = +to.slice(0, 4)
  const endM = +to.slice(5, 7)
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

/** Last day of a YYYY-MM month, as YYYY-MM-DD. */
export function monthEnd(ym: string): string {
  const y = +ym.slice(0, 4)
  const m = +ym.slice(5, 7)
  return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`
}

/**
 * The all-years subject index is the one costly read (every page flattened),
 * and a climb builds several spans from the same archive — so it is kept per
 * entries array and reused.
 */
const fullIndexCache = new WeakMap<object, SubjectIndex>()
function fullIndexFor(entries: LedgerInput['entries']): SubjectIndex {
  let idx = fullIndexCache.get(entries)
  if (!idx) {
    idx = buildSubjectIndex(entries as unknown as Entry[], haystackFor)
    fullIndexCache.set(entries, idx)
  }
  return idx
}

/** The year, as it always was: January through `throughMonth`, twelve slots. */
export function buildYearLedger(
  input: LedgerInput,
  year: number,
  throughMonth = 12,
  weights: Weights = DEFAULT_WEIGHTS,
): YearLedger {
  const from = `${year}-01-01`
  const to = monthEnd(`${year}-${String(throughMonth).padStart(2, '0')}`)
  const r = buildLedger(input, { from, to }, { weights })
  const pad = (a: number[]) => [...a, ...Array.from({ length: 12 - a.length }, () => 0)]
  return {
    year,
    throughMonth,
    threads: r.threads.map((t) => ({ ...t, perMonth: pad(t.perMonth) })),
    stones: r.stones,
  }
}

export function buildLedger(input: LedgerInput, range: LedgerRange, opts: LedgerOptions = {}): RangeLedger {
  const weights = opts.weights ?? DEFAULT_WEIGHTS
  const keep = opts.keep ?? KEEP
  const minMentions = opts.minMentions ?? MIN_MENTIONS
  const months = monthsBetween(range.from, range.to)
  const monthIx = (iso: string) => months.indexOf(iso.slice(0, 7))
  const year = yearOf(range.from)
  const inYear = (iso: string) => dayOf(iso) >= range.from && dayOf(iso) <= range.to
  const monthOf = monthIx
  const entryById = new Map(input.entries.map((e) => [e.id, e]))
  const yearEntries = input.entries.filter((e) => inYear(e.created_at))
  const yearIds = new Set(yearEntries.map((e) => e.id))
  const writtenYears = new Set(input.entries.map((e) => yearOf(e.created_at)))
  const markedEntries = new Set(yearEntries.filter((e) => isMarkedEntry(e.body_markdown)).map((e) => e.id))

  const markingsByEntry = new Map<string, MarkingInput[]>()
  for (const m of input.markings) {
    if (!yearIds.has(m.entryId)) continue
    const list = markingsByEntry.get(m.entryId) ?? []
    list.push(m)
    markingsByEntry.set(m.entryId, list)
  }

  // Scripture written in each entry, formatted at chapter grain.
  const refsByEntry = new Map<string, string[]>()
  for (const r of input.refs) {
    const e = entryById.get(r.entryId)
    if (!e || !yearIds.has(e.id)) continue
    const label = formatOsisRef(r.osisRef)
    const list = refsByEntry.get(r.entryId) ?? []
    if (!list.includes(label)) list.push(label)
    refsByEntry.set(r.entryId, list)
  }

  const drafts: Draft[] = []
  const matterByLabel = new Map<string, Draft>()

  // 1 · MATTERS — the Altar's declared threads. Their lines ARE markings.
  for (const t of input.matters) {
    const yearsPresent = new Set<number>()
    const byEntry: Draft['byEntry'] = new Map()
    for (const m of t.members) {
      if (!m.entryId) continue
      const e = entryById.get(m.entryId)
      if (!e) continue
      yearsPresent.add(yearOf(e.created_at))
      if (!yearIds.has(e.id)) continue
      const text = clip(m.content)
      if (!text) continue
      const list = byEntry.get(e.id) ?? []
      if (!list.some((l) => l.text === text)) list.push({ text, kind: toLineKind(m.type), flag: null })
      byEntry.set(e.id, list)
    }
    if (byEntry.size === 0) continue
    const d: Draft = {
      id: `m:${t.id}`,
      label: t.label,
      kind: 'matter',
      byEntry,
      events: [],
      prior: priorShare(yearsPresent, year, writtenYears),
    }
    drafts.push(d)
    matterByLabel.set(t.label.trim().toLowerCase(), d)
  }

  // 2 · NAMES — literal, whole-word, across the year's pages. A name the Altar
  // already holds as a matter folds into it (same subject, two ways in).
  // The vocabulary runs to thousands, so only the names most present this year
  // (by months, then pages) go on to the costlier all-years presence read.
  const yearIndex: SubjectIndex = buildSubjectIndex(yearEntries as unknown as Entry[], haystackFor)
  const candidates: { s: Subject; hits: Set<string>; months: number }[] = []
  for (const s of input.names) {
    if (isAddressee(s.label)) continue
    const hits = matchSubject(yearIndex, s)
    if (hits.size < minMentions) continue
    const present = new Set([...hits].map((id) => entryById.get(id)!.created_at.slice(0, 7))).size
    candidates.push({ s, hits, months: present })
  }
  candidates.sort((a, b) => b.months - a.months || b.hits.size - a.hits.size)
  for (const { s, hits } of candidates.slice(0, NAME_CANDIDATES)) {
    const re = subjectMatcher([s])
    const byEntry: Draft['byEntry'] = new Map()
    for (const id of hits) {
      const e = entryById.get(id)!
      // Prefer a marking that names it — it already says what kind of line it is.
      const marked = (markingsByEntry.get(id) ?? []).find((m) => {
        if (!re) return false
        re.lastIndex = 0
        return re.test(m.content)
      })
      let line: { text: string; kind: LineKind; flag: null } | null = null
      if (marked) line = { text: clip(marked.content, re), kind: toLineKind(marked.type), flag: null }
      else {
        const hit = plainLines(e.body_markdown).find((l) => {
          if (!re) return false
          re.lastIndex = 0
          return re.test(l)
        })
        if (hit) line = { text: clip(hit, re), kind: 'story', flag: null }
      }
      byEntry.set(id, line ? [line] : [])
    }
    // Same subject, two ways in: the Altar calls it "Dad's health", the page
    // calls him Dad. Fold when the matter's own label names it and most of the
    // name's pages this year are already the matter's.
    const folded =
      matterByLabel.get(s.label.trim().toLowerCase()) ??
      s.terms.map((t) => matterByLabel.get(t.trim().toLowerCase())).find(Boolean) ??
      [...matterByLabel.values()]
        .filter((m) => {
          if (!re) return false
          re.lastIndex = 0
          return re.test(m.label)
        })
        .map((m) => ({ m, overlap: [...hits].filter((id) => m.byEntry.has(id)).length }))
        .filter((x) => x.overlap / hits.size >= 0.5)
        .sort((a, b) => b.overlap - a.overlap)[0]?.m
    if (folded) {
      for (const [id, lines] of byEntry) if (!folded.byEntry.has(id)) folded.byEntry.set(id, lines)
      continue
    }
    const yearsPresent = new Set<number>()
    for (const id of matchSubject(fullIndexFor(input.entries), s)) {
      const e = entryById.get(id)
      if (e) yearsPresent.add(yearOf(e.created_at))
    }
    drafts.push({
      id: `n:${s.key}`,
      label: s.label,
      kind: 'name',
      byEntry,
      events: [],
      prior: priorShare(yearsPresent, year, writtenYears),
    })
  }

  // 3 · VERSES — chapters of scripture the writer wrote down, at chapter grain.
  const chapters = new Map<string, { label: string; refs: RefInput[]; years: Set<number> }>()
  for (const r of input.refs) {
    const e = entryById.get(r.entryId)
    if (!e) continue
    const key = `${r.bookOsis}.${r.chapter}`
    const c = chapters.get(key) ?? { label: formatOsisRef(key), refs: [], years: new Set<number>() }
    c.years.add(yearOf(e.created_at))
    if (yearIds.has(e.id)) c.refs.push(r)
    chapters.set(key, c)
  }
  for (const [key, c] of chapters) {
    const ids = new Set(c.refs.map((r) => r.entryId))
    if (ids.size < minMentions) continue
    const byEntry: Draft['byEntry'] = new Map()
    for (const id of ids) {
      const e = entryById.get(id)!
      const r = c.refs.find((x) => x.entryId === id)!
      let text = ''
      if (r.charStart != null) {
        // The raw line the reference sits on, verbatim.
        const body = e.body_markdown
        const start = body.lastIndexOf('\n', r.charStart) + 1
        const endNl = body.indexOf('\n', r.charStart)
        const raw = body.slice(start, endNl < 0 ? body.length : endNl)
        text = clip(stripMarkdownMarkers(raw).replace(/^#{1,6}\s+/, '').replace(/^[-*>]\s+/, ''))
      }
      const marking = (markingsByEntry.get(id) ?? []).find((m) => text && m.content.includes(text.slice(0, 40)))
      byEntry.set(id, text ? [{ text, kind: marking ? toLineKind(marking.type) : 'story', flag: null }] : [])
    }
    drafts.push({
      id: `v:${key}`,
      label: c.label,
      kind: 'verse',
      byEntry,
      events: [],
      prior: priorShare(c.years, year, writtenYears),
    })
  }

  // 4 · MOVEMENT — named on the Altar (encounters), and turns visible in the
  // markings themselves: a prayer that later comes back as something sensed or
  // learned. Stones come from answered prayers, paired with the writer's ask.
  const stones: LedgerStone[] = []
  const matterDraft = new Map(drafts.filter((d) => d.kind === 'matter').map((d) => [d.id.slice(2), d]))
  const matterInput = new Map(input.matters.map((t) => [t.id, t]))
  for (const enc of input.encounters) {
    if (!inYear(enc.namedAt)) continue
    const d = matterDraft.get(enc.threadId)
    if (!d) continue
    const month = monthOf(enc.namedAt)
    d.events.push({ month, type: 'answered', label: MOVEMENT_LABEL[enc.movement] ?? enc.movement })
    if (!PRAYER_MOVEMENTS.has(enc.movement)) continue
    // The ask: the prayer that opened this stretch of asking — the first prayer
    // line in the thread in the year before it was met. ("Pray for Dad's tests"
    // in March is what October's clear scan answered, not September's "Pray
    // for Dad.")
    const t = matterInput.get(enc.threadId)!
    const yearBefore = new Date(Date.parse(enc.namedAt) - 365 * 86_400_000).toISOString().slice(0, 10)
    const asks = t.members
      .map((m) => ({ m, e: m.entryId ? entryById.get(m.entryId) : undefined }))
      .filter((x): x is { m: MatterInput['members'][number]; e: NonNullable<typeof x.e> } =>
        !!x.e &&
        x.m.type === 'prayer' &&
        dayOf(x.e.created_at) < dayOf(enc.namedAt) &&
        dayOf(x.e.created_at) >= yearBefore)
      .sort((a, b) => a.e.created_at.localeCompare(b.e.created_at))
    const ask = asks[0]
    let later: LedgerStoneMark | null = null
    if (enc.reflection?.trim()) later = { entryId: enc.sourceEntryId ?? ask?.e.id ?? '', date: dayOf(enc.namedAt), text: clip(enc.reflection) }
    else if (enc.sourceEntryId && entryById.get(enc.sourceEntryId)) {
      const e = entryById.get(enc.sourceEntryId)!
      const own = d.byEntry.get(e.id)?.[0]?.text ?? plainLines(e.body_markdown)[0]
      if (own) later = { entryId: e.id, date: dayOf(e.created_at), text: clip(own) }
    }
    if (ask && later && later.entryId) {
      stones.push({
        id: `s:${enc.threadId}:${enc.namedAt}`,
        threadId: d.id,
        ask: { entryId: ask.e.id, date: dayOf(ask.e.created_at), text: clip(ask.m.content) },
        later,
      })
      const askLine = d.byEntry.get(ask.e.id)?.find((l) => l.text === clip(ask.m.content))
      if (askLine) askLine.flag = 'ask'
      const laterLine = d.byEntry.get(later.entryId)?.[0]
      if (laterLine) laterLine.flag = 'answered'
    }
  }

  // Turns: a prayer that later comes back as something LEARNED (or, failing
  // that, sensed) — read off the writer's own markings. Learned wins: "I think
  // I've forgiven Tom" is the turn, not February's first sensed line.
  for (const d of drafts) {
    const ordered = [...d.byEntry.entries()]
      .map(([id, lines]) => ({ e: entryById.get(id)!, lines }))
      .sort((a, b) => a.e.created_at.localeCompare(b.e.created_at))
    const firstPrayer = ordered.find((x) => x.lines.some((l) => l.kind === 'prayer'))
    if (!firstPrayer) continue
    const prayedMonth = monthOf(firstPrayer.e.created_at)
    const after = ordered.filter((x) => monthOf(x.e.created_at) > prayedMonth)
    for (const kind of ['learned', 'sense'] as const) {
      const hit = after.find((x) => x.lines.some((l) => l.kind === kind && l.flag === null))
      if (!hit) continue
      hit.lines.find((l) => l.kind === kind && l.flag === null)!.flag = 'turn'
      d.events.push({
        month: monthOf(hit.e.created_at),
        type: 'turn',
        label: `prayer → ${kind === 'learned' ? 'learned' : 'sensed'}`,
      })
      break
    }
  }

  // One subject, one thread: two sources can arrive at the same label (an
  // Altar thread and a name, or two Altar threads the writer named alike).
  // Fold them together rather than show "Drove" twice.
  const byLabel = new Map<string, Draft>()
  const merged: Draft[] = []
  for (const d of drafts) {
    const key = displayLabel(d.label).toLowerCase()
    const into = byLabel.get(key)
    if (!into) {
      byLabel.set(key, d)
      merged.push(d)
      continue
    }
    for (const [id, lines] of d.byEntry) {
      const have = into.byEntry.get(id)
      if (!have) into.byEntry.set(id, lines)
      else for (const l of lines) if (!have.some((x) => x.text === l.text)) have.push(l)
    }
    into.events.push(...d.events)
    into.prior = Math.max(into.prior, d.prior)
  }

  // 5 · SCORE + RANK.
  const scored = merged
    .map((d) => {
      const perMonth = Array.from({ length: months.length }, () => 0)
      const marked = new Set<number>()
      let markedCount = 0
      for (const id of d.byEntry.keys()) {
        const e = entryById.get(id)!
        const m = monthOf(e.created_at)
        perMonth[m]!++
        if (markedEntries.has(id)) {
          markedCount++
          marked.add(m)
        }
      }
      const p = presence(perMonth, months.length)
      const s = score({ ...p, movement: d.events.length, marked: markedCount }, d.prior, weights)
      return { d, perMonth, marked, markedCount, p, s }
    })
    .filter((x) => x.p.mentions >= minMentions)
    .sort((a, b) => b.s - a.s || b.p.mentions - a.p.mentions || a.d.label.localeCompare(b.d.label))
    .slice(0, keep)

  // Which kept threads share an entry — "shared a page with".
  const threadsByEntry = new Map<string, string[]>()
  for (const x of scored) {
    for (const id of x.d.byEntry.keys()) {
      const list = threadsByEntry.get(id) ?? []
      list.push(x.d.id)
      threadsByEntry.set(id, list)
    }
  }

  const threads: LedgerThread[] = scored.map(({ d, perMonth, marked, markedCount, p, s }) => {
    const lines: LedgerLine[] = []
    const ordered = [...d.byEntry.entries()]
      .map(([id, ls]) => ({ e: entryById.get(id)!, ls }))
      .sort((a, b) => a.e.created_at.localeCompare(b.e.created_at))
    for (const { e, ls } of ordered) {
      for (const l of ls) {
        lines.push({
          entryId: e.id,
          date: dayOf(e.created_at),
          month: monthOf(e.created_at),
          text: l.text,
          kind: l.kind,
          flag: l.flag,
          refs: d.kind === 'verse' ? [] : (refsByEntry.get(e.id) ?? []),
          with: (threadsByEntry.get(e.id) ?? []).filter((t) => t !== d.id),
        })
      }
    }
    return {
      id: d.id,
      label: displayLabel(d.label),
      kind: d.kind,
      perMonth,
      lines,
      events: d.events.sort((a, b) => a.month - b.month),
      markedMonths: [...marked].sort((a, b) => a - b),
      returned: p.returns > 0,
      score: s,
      facts: { ...p, movement: d.events.length, marked: markedCount, prior: d.prior },
    }
  })

  const kept = new Set(threads.map((t) => t.id))
  return {
    from: range.from,
    to: range.to,
    months,
    threads,
    stones: stones.filter((st) => kept.has(st.threadId)).sort((a, b) => a.later.date.localeCompare(b.later.date)),
  }
}
