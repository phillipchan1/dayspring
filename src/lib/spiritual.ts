import { apiUrl } from './api'
import { parseSpiritualBlocks } from './spiritualBlocks'
import { requireSupabase } from './supabase'
import type { NewSpiritualItem, SpiritualItem, SpiritualItemType } from './types'

export async function createSpiritualItem(item: NewSpiritualItem): Promise<SpiritualItem> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const { data, error } = await sb
    .from('spiritual_items')
    .insert({
      ...(item.id ? { id: item.id } : {}),
      owner: session.user.id,
      entry_id: item.entry_id ?? null,
      type: item.type,
      content: item.content,
      metadata: item.metadata ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data as SpiritualItem
}

export async function listSpiritualItems(type?: SpiritualItemType): Promise<SpiritualItem[]> {
  const sb = requireSupabase()
  let q = sb
    .from('spiritual_items')
    .select('*')
    .order('created_at', { ascending: false })

  if (type) q = q.eq('type', type)

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as SpiritualItem[]
}

export async function getSpiritualItem(id: string): Promise<SpiritualItem | null> {
  const sb = requireSupabase()
  const { data, error } = await sb.from('spiritual_items').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as SpiritualItem | null) ?? null
}

export async function markPrayerAnswered(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('spiritual_items')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function updateSpiritualItemContent(id: string, content: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('spiritual_items').update({ content }).eq('id', id)
  if (error) throw error
}

/** Update content and/or metadata when a block is edited in place. */
export async function updateSpiritualItem(
  id: string,
  fields: { content?: string; metadata?: Record<string, unknown> | null },
): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (fields.content !== undefined) patch.content = fields.content
  if (fields.metadata !== undefined) patch.metadata = fields.metadata
  if (Object.keys(patch).length === 0) return
  const sb = requireSupabase()
  const { error } = await sb.from('spiritual_items').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteSpiritualItem(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.from('spiritual_items').delete().eq('id', id)
  if (error) throw error
}

/**
 * Reconcile spiritual_items with the fenced blocks in an entry after save:
 * update content for blocks still present, and delete rows for blocks the user
 * removed from the text so the Altar never shows orphaned prayers/senses.
 */
export async function syncSpiritualBlocksFromMarkdown(
  entryId: string | null,
  markdown: string,
): Promise<void> {
  if (!entryId) return
  const blocks = parseSpiritualBlocks(markdown)
  const ids = blocks.map((b) => b.id)
  const sb = requireSupabase()

  await Promise.all(blocks.map((b) => updateSpiritualItemContent(b.id, b.content)))

  let del = sb.from('spiritual_items').delete().eq('entry_id', entryId)
  if (ids.length > 0) del = del.not('id', 'in', `(${ids.join(',')})`)
  const { error } = await del
  if (error) throw error
}

export async function unmarkPrayerAnswered(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('spiritual_items')
    .update({ resolved_at: null })
    .eq('id', id)
  if (error) throw error
}

// Scripture is ESV-only and resolves in two progressive phases so references
// render the instant the model returns, with verbatim ESV text filling in behind
// them. The text is authoritative — never model-generated.

/** A reference + reason the model picked, before its verse text is resolved. */
export interface CandidateRef {
  reference: string
  reason: string
}

/** A resolved passage: the ESV's canonical reference + verbatim text. */
export interface ResolvedRef {
  reference: string
  text: string
}

async function authHeader(): Promise<string> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')
  return `Bearer ${session.access_token}`
}

/** Phase 1 — the model picks candidate references (no verse text yet). Fast. */
export async function fetchScriptureRefs(content: string): Promise<CandidateRef[]> {
  const res = await fetch(apiUrl('/api/spiritual/scripture'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'failed' }))) as { error?: string }
    throw new Error(err.error ?? 'Scripture search failed')
  }
  const result = (await res.json()) as { passages: CandidateRef[] }
  return result.passages
}

/**
 * Phase 2 — resolve verbatim ESV text for the picked references (cache-first on
 * the server). Returns one slot per input reference, in order: a resolved
 * passage, or null when the reference didn't resolve to real ESV text.
 */
export async function resolveScripturePassages(references: string[]): Promise<(ResolvedRef | null)[]> {
  const res = await fetch(apiUrl('/api/spiritual/scripture-resolve'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: await authHeader() },
    body: JSON.stringify({ references }),
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'failed' }))) as { error?: string }
    throw new Error(err.error ?? 'Could not load verse text')
  }
  const result = (await res.json()) as { resolved: (ResolvedRef | null)[] }
  return result.resolved
}
