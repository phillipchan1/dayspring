import { requireSupabase } from '../supabase'
import type { Entry } from '../types'

const EXPORT_PAGE = 1000

const ENTRY_COLUMNS =
  'id, created_at, updated_at, body_markdown, title, mood, tags, word_count, source, external_id'

/**
 * Fetch all entries and package them into a downloadable zip.
 * `onProgress(fetched, total)` fires after the initial count query and after
 * each page, so callers can drive a progress bar.
 */
export async function exportEntriesToZip(
  onProgress?: (fetched: number, total: number) => void,
): Promise<Blob> {
  const sb = requireSupabase()

  const { count, error: countError } = await sb
    .from('entries')
    .select('id', { count: 'exact', head: true })
  if (countError) throw countError
  const total = count ?? 0
  onProgress?.(0, total)

  const entries: Entry[] = []
  for (let from = 0; ; from += EXPORT_PAGE) {
    const { data, error } = await sb
      .from('entries')
      .select(ENTRY_COLUMNS)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + EXPORT_PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as Entry[]
    entries.push(...rows)
    onProgress?.(entries.length, total)
    if (rows.length < EXPORT_PAGE) break
  }

  const payload = JSON.stringify(
    {
      version: 1,
      exported_at: new Date().toISOString(),
      entry_count: entries.length,
      entries,
    },
    null,
    2,
  )

  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  zip.file('entries.json', payload)
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}
