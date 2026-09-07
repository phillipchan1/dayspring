import type { Entry, Line, Subject } from './corpus'
import { ENTRIES, linesOf } from './corpus'

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function termRegex(terms: string[], flags: string): RegExp | null {
  const parts = terms
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2)
    .map(escape)
  if (parts.length === 0) return null
  return new RegExp(`(^|[^a-z0-9])(${parts.join('|')})([^a-z0-9]|$)`, flags)
}

export function subjectMatcher(subject: Subject): RegExp | null {
  const parts = subject.terms
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2)
    .map(escape)
  if (parts.length === 0) return null
  return new RegExp(`(?<![a-z0-9])(${parts.join('|')})(?:['’]s)?(?![a-z0-9])`, 'gi')
}

export function entryMatches(entry: Entry, subject: Subject): boolean {
  const re = termRegex(subject.terms, 'i')
  if (!re) return false
  return re.test(entry.paragraphs.join('\n').toLowerCase())
}

export function matchingEntries(subject: Subject, entries: Entry[] = ENTRIES): Entry[] {
  return entries.filter((e) => entryMatches(e, subject))
}

export function matchingLines(subject: Subject, entries: Entry[] = ENTRIES): Line[] {
  const re = termRegex(subject.terms, 'i')
  if (!re) return []
  return linesOf(entries).filter((line) => re.test(line.text.toLowerCase()))
}

export function occurrenceCount(subject: Subject, entries: Entry[] = ENTRIES): number {
  return matchingLines(subject, entries).length
}

export function splitOnMatch(text: string, match: RegExp | null): string[] {
  if (!match) return [text]
  match.lastIndex = 0
  const out: string[] = []
  let at = 0
  let m: RegExpExecArray | null
  while ((m = match.exec(text))) {
    out.push(text.slice(at, m.index), m[0])
    at = m.index + m[0].length
    if (m[0].length === 0) match.lastIndex++
  }
  out.push(text.slice(at))
  return out
}

export type MonthCell = { key: string; year: number; month: number; count: number }

/** Inclusive month range covering the whole corpus. */
export function monthBand(subject: Subject, entries: Entry[] = ENTRIES): MonthCell[] {
  const hits = matchingLines(subject, entries)
  const first = entries[0]?.date ?? '2025-01-01'
  const last = entries[entries.length - 1]?.date ?? '2026-08-01'
  const [fy, fm] = first.split('-').map(Number)
  const [ly, lm] = last.split('-').map(Number)
  const cells: MonthCell[] = []
  let y = fy
  let m = fm
  while (y < ly || (y === ly && m <= lm)) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    const count = hits.filter((h) => h.date.startsWith(key)).length
    cells.push({ key, year: y, month: m, count })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return cells
}

export function coOccurs(subject: Subject, others: Subject[], entries: Entry[] = ENTRIES): { label: string; count: number }[] {
  const mine = new Set(matchingEntries(subject, entries).map((e) => e.id))
  return others
    .filter((o) => o.key !== subject.key)
    .map((o) => ({
      label: o.label,
      count: matchingEntries(o, entries).filter((e) => mine.has(e.id)).length,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
}

export function wordSubject(raw: string): Subject | null {
  const word = raw.trim()
  if (word.length < 2) return null
  return { key: `word:${word.toLowerCase()}`, label: word, terms: [word] }
}
