// POST /api/keeping/read
//
// Private, evaluative entry read. The client sends only an entry id; the server
// loads that authenticated owner's text and vocabulary, then returns one
// grounded read. Nothing is persisted. This is the seam a future processing job
// can call after the playground proves the read is trustworthy.

import { getAuthedUser, notAuthenticated } from '../_lib/userAuth.js'
import { supabaseAdmin } from '../_lib/supabaseAdmin.js'
import { preflight, withCors } from '../_lib/cors.js'
import {
  MAX_SUBJECTS,
  readEntryWithKeeping,
  type SubjectCandidate,
  type SubjectKind,
} from '../_lib/keepingRead.js'

interface ConcordanceRow {
  canonical: string
  surface_forms: string[] | null
  kind: 'person' | 'place' | 'org' | 'project' | 'term'
  status: 'suggested' | 'confirmed' | 'dormant' | 'superseded'
  source: 'import' | 'repetition' | 'correction' | 'explicit'
  first_seen: string | null
}

interface KeptRow {
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

export async function OPTIONS(req: Request): Promise<Response> {
  return preflight(req) ?? new Response(null, { status: 204 })
}

export async function POST(req: Request): Promise<Response> {
  const user = await getAuthedUser(req)
  if (!user) return withCors(req, notAuthenticated())

  let body: { entryId?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    body = {}
  }
  const entryId = body.entryId?.trim() ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) {
    return withCors(req, Response.json({ error: 'valid entryId is required' }, { status: 400 }))
  }

  const sb = supabaseAdmin()
  const [{ data: entry, error: entryError }, { data: concordance }, { data: kept }] =
    await Promise.all([
      sb
        .from('entries')
        .select('id, created_at, body_markdown')
        .eq('owner', user.id)
        .eq('id', entryId)
        .maybeSingle(),
      sb
        .from('concordance')
        .select('canonical, surface_forms, kind, status, source, first_seen')
        .eq('owner', user.id)
        .neq('status', 'superseded')
        .order('first_seen', { ascending: true })
        .limit(1000),
      sb
        .from('kept_subjects')
        .select('subject_key, label, terms, kind')
        .eq('owner', user.id)
        .order('kept_at', { ascending: true }),
    ])

  if (entryError) {
    return withCors(req, Response.json({ error: 'could not load entry' }, { status: 500 }))
  }
  if (!entry) return withCors(req, Response.json({ error: 'entry not found' }, { status: 404 }))

  try {
    const subjects = candidatesForEntry(
      String(entry.body_markdown ?? ''),
      (concordance ?? []) as ConcordanceRow[],
      (kept ?? []) as KeptRow[],
    )
    const reading = await readEntryWithKeeping(
      {
        id: String(entry.id),
        created_at: String(entry.created_at),
        body_markdown: String(entry.body_markdown ?? ''),
      },
      subjects,
    )
    return withCors(req, Response.json(reading))
  } catch {
    // Never include model details or entry text in the response or logs.
    return withCors(req, Response.json({ error: 'entry read failed' }, { status: 500 }))
  }
}
