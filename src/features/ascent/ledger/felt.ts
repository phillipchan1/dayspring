/**
 * WHAT YOUR WORDS CARRIED — the emotions the gather engine's stored read found
 * in a span's pages (entry_reads, D-035), arranged the way the rest of the
 * ledger arranges things: by the calendar, each with the writer's own line.
 *
 * An emotion here is an observation about LANGUAGE (D-029, Principle 1): every
 * one arrives with the verbatim words that earned it and the page they are on.
 * Nothing here scores a span, ranks one season above another, or says whether a
 * feeling was good — there is deliberately no pleasant/unpleasant line, no
 * average, and no arrow. Order is by how many pages carried it, never by tone.
 *
 * Pure — no I/O — so it can be pinned.
 */

import type { Entry } from '@/lib/types'
import { dayOf } from './build'

/** One page's stored read, as the ledger needs it. */
export interface ReadInput {
  entryId: string
  emotions: { emotion: string; intensity: number; quote: string }[]
}

export interface FeltLine {
  entryId: string
  /** YYYY-MM-DD of the page. */
  date: string
  /** Verbatim — the words the read pointed to. */
  text: string
}

export interface FeltEmotion {
  emotion: string
  /** Pages in the span carrying it — decides order only. */
  pages: number
  /** Pages per month of the span (index into `Felt.months`). */
  perMonth: number[]
  /** Its clearest lines, strongest first, one per page. */
  lines: FeltLine[]
  /** Whether it was on any page of the span compared against (null: no comparison). */
  before: boolean | null
}

export interface Felt {
  /** YYYY-MM keys the span covers, in order. */
  months: string[]
  /** Pages in the span where the read found felt emotion. */
  read: number
  emotions: FeltEmotion[]
}

/** Below this, a label is the read's faintest guess — not shown. */
export const MIN_INTENSITY = 0.25
/** Emotions kept per span. */
export const KEEP_EMOTIONS = 6
/** Lines shown per emotion. */
export const LINES_PER_EMOTION = 2

export interface Span {
  /** YYYY-MM-DD, inclusive. */
  from: string
  /** YYYY-MM-DD, inclusive. */
  to: string
}

export function monthsOf(span: Span): string[] {
  const out: string[] = []
  let y = +span.from.slice(0, 4)
  let m = +span.from.slice(5, 7)
  const end = span.to.slice(0, 7)
  for (;;) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    out.push(key)
    if (key >= end) return out
    m++
    if (m === 13) {
      m = 1
      y++
    }
  }
}

type EntryLike = Pick<Entry, 'id' | 'created_at'>

function inSpan(entries: EntryLike[], span: Span): EntryLike[] {
  return entries.filter((e) => {
    const d = dayOf(e.created_at)
    return d >= span.from && d <= span.to
  })
}

function emotionsOn(entries: EntryLike[], byEntry: Map<string, ReadInput>): Set<string> {
  const out = new Set<string>()
  for (const e of entries) {
    for (const x of byEntry.get(e.id)?.emotions ?? []) if (x.intensity >= MIN_INTENSITY) out.add(x.emotion)
  }
  return out
}

/** What a span's pages carried. `before` is the span to compare against. */
export function feltIn(entries: EntryLike[], reads: ReadInput[], span: Span, before?: Span): Felt {
  const months = monthsOf(span)
  const byEntry = new Map(reads.map((r) => [r.entryId, r]))
  const pages = inSpan(entries, span)
  const earlier = before ? emotionsOn(inSpan(entries, before), byEntry) : null

  const tally = new Map<string, { pages: number; weight: number; perMonth: number[]; lines: (FeltLine & { strength: number })[] }>()
  let read = 0
  for (const e of pages) {
    const r = byEntry.get(e.id)
    if (!r) continue
    read++
    const date = dayOf(e.created_at)
    const month = months.indexOf(date.slice(0, 7))
    for (const x of r.emotions) {
      if (x.intensity < MIN_INTENSITY || !x.quote.trim()) continue
      const t = tally.get(x.emotion) ?? { pages: 0, weight: 0, perMonth: months.map(() => 0), lines: [] }
      t.pages++
      t.weight += x.intensity
      if (month >= 0) t.perMonth[month]!++
      t.lines.push({ entryId: e.id, date, text: x.quote.trim(), strength: x.intensity })
      tally.set(x.emotion, t)
    }
  }

  const emotions = [...tally.entries()]
    .sort((a, b) => b[1].pages - a[1].pages || b[1].weight - a[1].weight || a[0].localeCompare(b[0]))
    .slice(0, KEEP_EMOTIONS)
    .map(([emotion, t]) => ({
      emotion,
      pages: t.pages,
      perMonth: t.perMonth,
      lines: t.lines
        .sort((a, b) => b.strength - a.strength || b.date.localeCompare(a.date))
        .slice(0, LINES_PER_EMOTION)
        .map(({ strength: _strength, ...line }) => line),
      before: earlier ? earlier.has(emotion) : null,
    }))

  return { months, read, emotions }
}
