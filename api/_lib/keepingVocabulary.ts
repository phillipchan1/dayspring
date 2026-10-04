// The writer's known subjects, as the entry read sees them — shared by the
// playground endpoint (api/keeping/read.ts) and the gather engine's read step
// (api/_lib/entryRead.ts), so one page is read against one vocabulary however
// the read was asked for.
//
// The read may only JOIN a subject from this list; it never mints one
// (MOVEMENTS.md § Structural guarantees).

import type { SupabaseClient } from '@supabase/supabase-js'
import { MAX_SUBJECTS, type SubjectCandidate, type SubjectKind } from './keepingRead.js'

export interface ConcordanceRow {
  canonical: string
  surface_forms: string[] | null
  kind: 'person' | 'place' | 'org' | 'project' | 'term'
  status: 'suggested' | 'confirmed' | 'dormant' | 'superseded'
  source: 'import' | 'repetition' | 'correction' | 'explicit'
  first_seen: string | null
}

export interface KeptRow {
  subject_key: string
  label: string
  terms: string[] | null
  kind: string | null
}

const ADDRESSEE = new Set([
  'god',
  'jesus',
  'jesus christ',
  'christ',
  'lord',
  'lord jesus',
  'the lord',
  'holy spirit',
  'the holy spirit',
  'spirit',
  'yahweh',
  'jehovah',
  'abba',
])

const sectionFor = (kind: ConcordanceRow['kind']): SubjectKind => {
  if (kind === 'person' || kind === 'place') return kind
  if (kind === 'org' || kind === 'project') return 'domain'
  return 'matter'
}

const keptSection = (kind: string | null): SubjectKind =>
  kind === 'person' || kind === 'place' || kind === 'domain' || kind === 'matter'
    ? kind
    : 'matter'

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function appears(text: string, terms: string[]): boolean {
  const usable = terms.map((term) => term.trim()).filter((term) => term.length >= 2)
  if (usable.length === 0) return false
  const pattern = usable.map(escape).join('|')
  return new RegExp(`(^|[^a-z0-9])(${pattern})([^a-z0-9]|$)`, 'i').test(text)
}

/**
 * The vocabulary sent to one read.
 *
 * Literal subjects always enter. Writer-named/confirmed subjects also enter,
 * even when their label is absent, so a passage about the children can be
 * joined to a writer-named Family domain. Merely suggested absent subjects do
 * not enter: hundreds of plausible labels invite plausible but false joins.
 */
export function candidatesForEntry(
  markdown: string,
  concordance: ConcordanceRow[],
  kept: KeptRow[],
): SubjectCandidate[] {
  const byKey = new Map<string, SubjectCandidate & { direct: boolean; firstSeen: string }>()
  const keptKeys = new Set(kept.map((row) => row.subject_key))

  for (const row of concordance) {
    const label = row.canonical.trim()
    if (!label || row.status === 'superseded' || ADDRESSEE.has(label.toLowerCase())) continue
    const key = `c:${label.toLowerCase()}`
    const terms = [...new Set([label, ...(row.surface_forms ?? [])].map((term) => term.trim()).filter(Boolean))]
    const writerNamed =
      row.source === 'explicit' ||
      row.source === 'correction' ||
      row.status === 'confirmed' ||
      keptKeys.has(key)
    const direct = appears(markdown, terms)
    if (!direct && !writerNamed) continue
    const existing = byKey.get(key)
    if (existing) {
      existing.terms = [...new Set([...existing.terms, ...terms])]
      existing.direct ||= direct
      existing.writerNamed ||= writerNamed
      continue
    }
    byKey.set(key, {
      key,
      label,
      terms,
      kind: sectionFor(row.kind),
      writerNamed,
      direct,
      firstSeen: row.first_seen ?? '',
    })
  }

  for (const row of kept) {
    if (byKey.has(row.subject_key)) continue
    const label = row.label.trim()
    if (!label || ADDRESSEE.has(label.toLowerCase())) continue
    const terms = row.terms?.length ? row.terms : [label]
    byKey.set(row.subject_key, {
      key: row.subject_key,
      label,
      terms,
      kind: keptSection(row.kind),
      writerNamed: true,
      direct: appears(markdown, terms),
      firstSeen: '',
    })
  }

  return [...byKey.values()]
    .sort((a, b) => {
      if (a.direct !== b.direct) return a.direct ? -1 : 1
      if (a.writerNamed !== b.writerNamed) return a.writerNamed ? -1 : 1
      return a.firstSeen.localeCompare(b.firstSeen) || a.label.localeCompare(b.label)
    })
    .slice(0, MAX_SUBJECTS)
    .map(({ direct: _direct, firstSeen: _firstSeen, ...candidate }) => candidate)
}

/** An owner's whole vocabulary, loaded once and narrowed per entry. */
export interface Vocabulary {
  concordance: ConcordanceRow[]
  kept: KeptRow[]
}

export async function loadVocabulary(sb: SupabaseClient, owner: string): Promise<Vocabulary> {
  const [concordance, kept] = await Promise.all([
    sb
      .from('concordance')
      .select('canonical, surface_forms, kind, status, source, first_seen')
      .eq('owner', owner)
      .neq('status', 'superseded')
      .order('first_seen', { ascending: true })
      .limit(1000),
    sb
      .from('kept_subjects')
      .select('subject_key, label, terms, kind')
      .eq('owner', owner)
      .order('kept_at', { ascending: true }),
  ])
  if (concordance.error) throw concordance.error
  if (kept.error) throw kept.error
  return {
    concordance: (concordance.data ?? []) as ConcordanceRow[],
    kept: (kept.data ?? []) as KeptRow[],
  }
}
