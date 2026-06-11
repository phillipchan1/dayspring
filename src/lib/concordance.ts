// Client reads/corrections for the Concordance drawer — the fidelity record's
// ONE user-facing surface. Boringly honest: spellings and names, never a psych
// profile. No counts-as-score, no completeness meter.
//
// Like scripture_refs, the client writes only its own rows under RLS
// (auth.uid() = owner). Every correction ALSO appends a concordance_events row
// — the append-only log rebuildConcordance() replays — so the live table stays
// derived, not authoritative. Extraction/merging is server-side only.

import { requireSupabase } from './supabase'

// Mirrored from api/_lib/concordance.ts (the api/ and src/ trees don't share
// modules — same convention as entryLabels.ts). Copy & thresholds live here.
export const CONCORDANCE = {
  KINDS: ['person', 'place', 'org', 'project', 'term'] as const,
  SURFACE_MIN_DISTINCT_ENTRIES: 2, // appears in >= N distinct entries to be shown in the drawer
  EXPLICIT_CONFIDENCE: 1.0,
  CORRECTION_CONFIDENCE: 1.0,
  DRAWER_TITLE: 'Concordance',
  DRAWER_SUBTITLE: "Names and words I've learned to spell the way you do.",
  DRAWER_EMPTY: "Nothing yet. As you write, I'll quietly learn how you spell your world.",
  // NEVER add a completeness meter or "we know N things about you" string here.
} as const

export type ConcordanceKind = (typeof CONCORDANCE.KINDS)[number]
export type ConcordanceStatus = 'suggested' | 'confirmed' | 'dormant' | 'superseded'

export interface ConcordanceItem {
  id: string
  kind: ConcordanceKind
  canonical: string
  surface_forms: string[]
  descriptor: string | null
  status: ConcordanceStatus
  source: 'import' | 'repetition' | 'correction' | 'explicit'
  occurrence_count: number
  first_seen: string | null
  last_seen: string | null
}

const today = () => new Date().toISOString().slice(0, 10)

/**
 * The drawer's list: active items that have either recurred across enough
 * distinct entries or been vouched for by the user. One-off mentions stay
 * hidden until they repeat — the drawer never shows noise.
 */
export async function listConcordance(): Promise<ConcordanceItem[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('concordance')
    .select(
      'id, kind, canonical, surface_forms, descriptor, status, source, occurrence_count, first_seen, last_seen',
    )
    .in('status', ['suggested', 'confirmed'])
    .or(
      `occurrence_count.gte.${CONCORDANCE.SURFACE_MIN_DISTINCT_ENTRIES},status.eq.confirmed,source.eq.explicit`,
    )
    .order('canonical', { ascending: true })
  if (error) throw error
  return (data ?? []) as ConcordanceItem[]
}

/** Append a correction to the event log (the rebuild's replay source). */
async function logEvent(
  action: 'confirm' | 'edit' | 'forget',
  item: { kind: ConcordanceKind; canonical: string },
  payload: Record<string, unknown> = {},
): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('concordance_events').insert({
    action,
    kind: item.kind,
    canonical: item.canonical,
    payload,
  })
  if (error) throw error
}

/** "Yes, that's right" — promote a suggested item to confirmed, confidence 1.0. */
export async function confirmConcordanceItem(item: ConcordanceItem): Promise<void> {
  await logEvent('confirm', item)
  const sb = requireSupabase()
  const { error } = await sb
    .from('concordance')
    .update({ status: 'confirmed', confidence: CONCORDANCE.EXPLICIT_CONFIDENCE, source: 'explicit' })
    .eq('id', item.id)
    .neq('status', 'superseded')
  if (error) throw error
}

export interface ConcordanceEdit {
  canonical?: string
  surface_forms?: string[]
  descriptor?: string | null
}

/**
 * Correct an item's spelling/aliases/descriptor. A canonical RESPELLING creates
 * a new confirmed row and retires the old via superseded_by + effective_end —
 * supersede, never overwrite — with the old spelling kept as an alias (it's
 * still how the writer once wrote it). In-place edits cover everything else.
 */
export async function editConcordanceItem(
  item: ConcordanceItem,
  edit: ConcordanceEdit,
): Promise<void> {
  const sb = requireSupabase()
  const newCanonical = edit.canonical?.trim()
  const renamed =
    newCanonical !== undefined && newCanonical.toLowerCase() !== item.canonical.toLowerCase()

  await logEvent('edit', item, {
    ...(newCanonical !== undefined ? { new_canonical: newCanonical } : {}),
    ...(edit.surface_forms !== undefined ? { surface_forms: edit.surface_forms } : {}),
    ...(edit.descriptor !== undefined ? { descriptor: edit.descriptor ?? '' } : {}),
  })

  if (renamed && newCanonical) {
    const forms = dedupForms(newCanonical, [
      ...(edit.surface_forms ?? item.surface_forms),
      item.canonical, // the old spelling survives as an alias
    ])
    const { data: successor, error: insErr } = await sb
      .from('concordance')
      .insert({
        kind: item.kind,
        canonical: newCanonical,
        surface_forms: forms,
        descriptor: edit.descriptor !== undefined ? edit.descriptor : item.descriptor,
        confidence: CONCORDANCE.CORRECTION_CONFIDENCE,
        status: 'confirmed',
        source: 'correction',
        occurrence_count: item.occurrence_count,
        first_seen: item.first_seen, // original entry dates carry over — never row time
        last_seen: item.last_seen,
      })
      .select('id')
      .single()
    if (insErr) throw insErr

    // Carry the evidence: repoint distinct-entry occurrences to the successor.
    const { error: occErr } = await sb
      .from('concordance_occurrences')
      .update({ concordance_id: successor.id as string })
      .eq('concordance_id', item.id)
    if (occErr) throw occErr

    const { error: retireErr } = await sb
      .from('concordance')
      .update({ status: 'superseded', superseded_by: successor.id as string, effective_end: today() })
      .eq('id', item.id)
    if (retireErr) throw retireErr
    return
  }

  const patch: Record<string, unknown> = {
    status: 'confirmed',
    confidence: CONCORDANCE.CORRECTION_CONFIDENCE,
    source: 'correction',
  }
  if (newCanonical !== undefined) patch.canonical = newCanonical // case-only respelling
  if (edit.surface_forms !== undefined) {
    patch.surface_forms = dedupForms(newCanonical ?? item.canonical, edit.surface_forms)
  }
  if (edit.descriptor !== undefined) patch.descriptor = edit.descriptor || null
  const { error } = await sb.from('concordance').update(patch).eq('id', item.id)
  if (error) throw error
}

/** "Forget this" — retire the row (supersede with no successor), never hard-delete. */
export async function forgetConcordanceItem(item: ConcordanceItem): Promise<void> {
  await logEvent('forget', item)
  const sb = requireSupabase()
  const { error } = await sb
    .from('concordance')
    .update({ status: 'superseded', effective_end: today() })
    .eq('id', item.id)
  if (error) throw error
}

function dedupForms(canonical: string, forms: string[]): string[] {
  const seen = new Set<string>([canonical.toLowerCase()])
  const out: string[] = []
  for (const raw of forms) {
    const t = raw.replace(/\s+/g, ' ').trim()
    if (!t) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}
