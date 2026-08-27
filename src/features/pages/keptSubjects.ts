// Kept subjects — the things the writer said they carry.
//
// The Concordance OFFERS: it records every name someone writes, and offering is
// pure arithmetic, so the app is never claiming a name matters — only that it
// was written on eleven separate days. Keeping is the writer answering, and it
// is the only kind of significance this product renders at all (D-016).
//
// One gesture, no decision attached. There is no rename here, no colour, no
// merge, no nesting, no archive — and dropping is safe, which is the thing that
// makes keeping cheap enough to do at all. See the migration for why each of
// those is absent rather than merely unbuilt.

import { requireSupabase } from '@/lib/supabase'
import type { Subject } from './subjects'

/** A row as stored. `kept_at` is the only order this list is ever shown in. */
interface KeptRow {
  subject_key: string
  label: string
  terms: string[] | null
  kept_at: string
}

export interface KeptSubject extends Subject {
  keptAt: string
}

/**
 * What the writer keeps, in the order they kept it.
 *
 * Oldest first. Not by count, and not newest-first either: this is the order
 * she built the list in, and it is the one arrangement of the people in someone's
 * life that says nothing about them.
 */
export async function listKeptSubjects(): Promise<KeptSubject[]> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('kept_subjects')
    .select('subject_key, label, terms, kept_at')
    .order('kept_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(fromRow)
}

const fromRow = (r: KeptRow): KeptSubject => ({
  key: r.subject_key,
  label: r.label,
  terms: r.terms && r.terms.length > 0 ? r.terms : [r.label],
  kind: r.subject_key.startsWith('word:') ? 'word' : 'term',
  keptAt: r.kept_at,
})

/**
 * Keep a subject. Keeping one twice is a no-op, not a second row.
 *
 * The terms are snapshotted so the subject still matches if the Concordance
 * later drops the row it came from — see `withVocabulary` for the other half,
 * which is how a spelling learned LATER still lights.
 */
export async function keepSubject(subject: Subject): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('kept_subjects').upsert(
    {
      subject_key: subject.key,
      label: subject.label,
      terms: subject.terms,
    },
    { onConflict: 'owner,subject_key' },
  )
  if (error) throw error
}

/**
 * Drop a subject.
 *
 * Nothing else changes: the journal still notices the name, every page still
 * says what it said, and keeping it again is one click. A drop that felt
 * consequential would make keeping a decision, and keeping is not a decision.
 */
export async function dropSubject(key: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('kept_subjects').delete().eq('subject_key', key)
  if (error) throw error
}

/**
 * Refresh kept subjects against what the Concordance knows today.
 *
 * The stored terms are a snapshot from the moment of keeping, and a snapshot
 * goes stale in one direction only: a nickname the writer starts using next
 * year would never light. So the live vocabulary's spellings for the same name
 * are unioned in on read — the snapshot is the floor, never the ceiling.
 *
 * The label stays as kept. If the Concordance re-spells a name, the writer's
 * list should not silently rewrite itself underneath them.
 */
export function withVocabulary(kept: KeptSubject[], vocabulary: Subject[]): KeptSubject[] {
  const byKey = new Map(vocabulary.map((s) => [s.key, s]))
  return kept.map((k) => {
    const live = byKey.get(k.key)
    if (!live) return k
    const terms = [...new Set([...k.terms, ...live.terms])]
    return { ...k, terms, kind: live.kind }
  })
}

/**
 * Split a vocabulary into what is kept and what is merely offered.
 *
 * Two lists, one shape: the surface draws them with a hairline against a dashed
 * line rather than in two different places, so keeping something moves it
 * without teaching the reader a new control.
 */
export function partitionKept(
  vocabulary: Subject[],
  kept: KeptSubject[],
): { kept: KeptSubject[]; offered: Subject[] } {
  const keptKeys = new Set(kept.map((k) => k.key))
  return {
    kept,
    offered: vocabulary.filter((s) => !keptKeys.has(s.key)),
  }
}
