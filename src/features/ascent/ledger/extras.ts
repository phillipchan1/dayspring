/**
 * The other things a span holds — photos, and who was new in its pages.
 *
 * Both are facts with no interpretation in them: a photo is on a page with a
 * date; a name's first appearance is the date of the first page that carries
 * it (the Concordance's `first_seen` is the ENTRY's date, not when the
 * extractor read it — see supabase/migrations/20260611120000_concordance.sql).
 */

import { ATTACHMENT_REF_RE } from '@/lib/attachments'
import { buildSubjectIndex, haystackFor, isAddressee, matchSubject, subjectMatcher, type Subject } from '@/features/pages/subjects'
import { entryContentLines } from '@/lib/entryLabels'
import { stripMarkdownMarkers } from '@/lib/inlineMarkers'
import { writerWords } from '@/lib/writerWords'
import type { Entry } from '@/lib/types'
import { clip } from './build'

type PageLike = Pick<Entry, 'id' | 'created_at' | 'body_markdown'>

export interface SpanPhoto {
  entryId: string
  /** YYYY-MM-DD of the page. */
  date: string
  hash: string
  ext: string
  alt: string
}

const inSpan = (iso: string, from: string, to: string) => iso.slice(0, 10) >= from && iso.slice(0, 10) <= to

/** Every photo on a page inside the span, oldest first. */
export function photosIn(entries: PageLike[], from: string, to: string): SpanPhoto[] {
  const out: SpanPhoto[] = []
  for (const e of entries) {
    if (!inSpan(e.created_at, from, to)) continue
    const re = new RegExp(ATTACHMENT_REF_RE.source, 'g')
    for (const m of e.body_markdown.matchAll(re)) {
      out.push({ entryId: e.id, date: e.created_at.slice(0, 10), alt: m[1] ?? '', hash: m[2]!, ext: m[3]! })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** One photo per month, for a year's filmstrip — the first of each month. */
export function onePerMonth(photos: SpanPhoto[]): Map<string, SpanPhoto> {
  const out = new Map<string, SpanPhoto>()
  for (const p of photos) if (!out.has(p.date.slice(0, 7))) out.set(p.date.slice(0, 7), p)
  return out
}

export interface NewName {
  label: string
  /** YYYY-MM-DD of the first page that carries it. */
  date: string
  entryId: string
  /** The line it came in on, verbatim. */
  line: string
}

/** People, places and projects — not stray terms — whose first page falls in the span. */
const WHO_KINDS = new Set(['person', 'place', 'org', 'project'])

export function newIn(names: Subject[], entries: PageLike[], from: string, to: string, limit = 6): NewName[] {
  const span = entries
    .filter((e) => inSpan(e.created_at, from, to))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  if (span.length === 0) return []
  const index = buildSubjectIndex(span as unknown as Entry[], haystackFor)
  const byId = new Map(span.map((e) => [e.id, e]))
  const out: NewName[] = []
  for (const s of names) {
    if (!s.firstSeen || isAddressee(s.label)) continue
    if (!WHO_KINDS.has(s.section ?? s.kind)) continue
    const first = s.firstSeen.slice(0, 10)
    if (first < from || first > to) continue
    const hits = [...matchSubject(index, s)].map((id) => byId.get(id)!).sort((a, b) => a.created_at.localeCompare(b.created_at))
    const page = hits[0]
    if (!page) continue
    const re = subjectMatcher([s])
    // "The line it came in on" is shown as hers — so read writerWords (Guardrail
    // H3), or a name first met in a quoted verse comes in on the Bible's line.
    const line = entryContentLines(writerWords(page.body_markdown))
      .map((l) => stripMarkdownMarkers(l).replace(/^#{1,6}\s+/, '').trim())
      .find((l) => {
        if (!re) return false
        re.lastIndex = 0
        return re.test(l)
      })
    if (!line) continue
    out.push({ label: s.label, date: page.created_at.slice(0, 10), entryId: page.id, line: clip(line, re) })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit)
}
