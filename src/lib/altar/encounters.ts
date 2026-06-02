// Writes for the Altar. ONLY a user action ever creates or edits an encounter —
// naming how God moved is the whole act of "lighting" a prayer. The AI never
// touches this table. "Still carrying" is expressed by the ABSENCE of an
// encounter, so clearing one is simply a delete.

import { requireSupabase } from '../supabase'
import type { Encounter, Movement } from '../types'

async function ownerId(): Promise<string> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')
  return session.user.id
}

export interface NameEncounterFields {
  /** The "He met you" date — defaults to the surfaced evidence date, else now. */
  named_at?: string
  /** The entry that prompted the naming (e.g. the surfaced candidate's entry). */
  source_entry_id?: string | null
  reflection_text?: string | null
}

/**
 * Name (or re-name) how God moved on a thread. Upserts on thread_id — one
 * encounter per thread, editable. Lighting a thread also clears any open AI
 * candidate, since the user has now spoken.
 */
export async function nameEncounter(
  threadId: string,
  movement: Movement,
  fields: NameEncounterFields = {},
): Promise<Encounter> {
  const sb = requireSupabase()
  const owner = await ownerId()
  const { data, error } = await sb
    .from('encounters')
    .upsert(
      {
        owner,
        thread_id: threadId,
        movement,
        named_at: fields.named_at ?? new Date().toISOString(),
        source_entry_id: fields.source_entry_id ?? null,
        reflection_text: fields.reflection_text ?? null,
      },
      { onConflict: 'thread_id' },
    )
    .select()
    .single()
  if (error) throw error
  // The thread has been spoken over — retire its open candidate.
  await sb.from('altar_candidates').delete().eq('thread_id', threadId)
  return data as Encounter
}

/** Edit an existing encounter's movement and/or reflection in place. */
export async function editEncounter(
  threadId: string,
  fields: { movement?: Movement; named_at?: string; reflection_text?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (fields.movement !== undefined) patch.movement = fields.movement
  if (fields.named_at !== undefined) patch.named_at = fields.named_at
  if (fields.reflection_text !== undefined) patch.reflection_text = fields.reflection_text
  if (Object.keys(patch).length === 0) return
  const sb = requireSupabase()
  const { error } = await sb.from('encounters').update(patch).eq('thread_id', threadId)
  if (error) throw error
}

/** Return a thread to "still carrying" — delete its encounter. */
export async function clearEncounter(threadId: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('encounters').delete().eq('thread_id', threadId)
  if (error) throw error
}

/** Decline a surfaced candidate: it never resurfaces for this (thread, entry). */
export async function dismissCandidate(threadId: string, entryId: string): Promise<void> {
  const sb = requireSupabase()
  const owner = await ownerId()
  const { error } = await sb
    .from('altar_candidate_dismissals')
    .upsert({ owner, thread_id: threadId, entry_id: entryId }, { onConflict: 'owner,thread_id,entry_id' })
  if (error) throw error
  await sb.from('altar_candidates').delete().eq('thread_id', threadId)
}
