import { apiUrl } from './api'
import { parseSpiritualBlocks } from './spiritualBlocks'
import { requireSupabase } from './supabase'
import type { NewSpiritualItem, ScripturePassage, SpiritualItem, SpiritualItemType } from './types'

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

/** Sync spiritual_items.content from fenced blocks in body_markdown after save. */
export async function syncSpiritualBlocksFromMarkdown(markdown: string): Promise<void> {
  const blocks = parseSpiritualBlocks(markdown)
  if (blocks.length === 0) return
  await Promise.all(
    blocks.map((b) => updateSpiritualItemContent(b.id, b.content)),
  )
}

export async function unmarkPrayerAnswered(id: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('spiritual_items')
    .update({ resolved_at: null })
    .eq('id', id)
  if (error) throw error
}

export async function fetchScripturePassages(content: string, translation = 'ESV'): Promise<ScripturePassage[]> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const res = await fetch(apiUrl('/api/spiritual/scripture'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ content, translation }),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'failed' }))) as { error?: string }
    throw new Error(err.error ?? 'Scripture search failed')
  }

  const result = (await res.json()) as { passages: ScripturePassage[] }
  return result.passages.map((p) => ({ ...p, translation }))
}
