import type { SupabaseClient } from '@supabase/supabase-js'
import type JSZip from 'jszip'
import { requireSupabase } from '../supabase'
import { ATTACHMENT_REF_RE, downloadAttachmentBlob } from '../attachments'
import type { AttachmentPhotoMeta } from '../attachmentCaption'
import type { Entry } from '../types'

const EXPORT_PAGE = 1000

const ENTRY_COLUMNS =
  'id, created_at, updated_at, body_markdown, title, mood, tags, word_count, source, external_id'

/**
 * Fetch all entries and package them into a downloadable zip.
 * `onProgress(fetched, total)` fires after the initial count query and after
 * each page; `onImageProgress(done, total)` fires while image binaries are
 * downloaded and bundled, so callers can drive both progress bars.
 */
export async function exportEntriesToZip(
  onProgress?: (fetched: number, total: number) => void,
  onImageProgress?: (done: number, total: number) => void,
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

  // Bundle every referenced image binary so the backup is self-contained and a
  // restore can re-upload them. Without this, `attachment:<hash>` refs survive
  // the roundtrip as text but resolve to nothing in a fresh store.
  await bundleAttachments(sb, zip, entries, onImageProgress)

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

interface AttachmentManifestEntry {
  ext: string
  metadata?: AttachmentPhotoMeta
}

/**
 * Download each unique `attachment:<sha256>.<ext>` binary referenced by the
 * entries and write it into `attachments/<hash>.<ext>`, plus an
 * `attachments.json` manifest carrying per-photo metadata (capture time, etc.)
 * that isn't recoverable from the bytes alone. Best-effort: a missing or
 * unreadable object is skipped rather than failing the whole export.
 */
async function bundleAttachments(
  sb: SupabaseClient,
  zip: JSZip,
  entries: Entry[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  // Unique hash → ext across all bodies.
  const refs = new Map<string, string>()
  for (const e of entries) {
    for (const m of e.body_markdown.matchAll(ATTACHMENT_REF_RE)) {
      refs.set(m[2]!, m[3]!)
    }
  }
  const total = refs.size
  onProgress?.(0, total)
  if (total === 0) return

  const { data: { user } } = await sb.auth.getUser()
  const ownerId = user?.id
  if (!ownerId) return

  // Pull metadata rows in chunks (best-effort; absence just omits capture time).
  const metaByHash = new Map<string, AttachmentPhotoMeta>()
  const hashes = [...refs.keys()]
  for (let i = 0; i < hashes.length; i += 200) {
    const { data } = await sb
      .from('attachments')
      .select('hash, metadata')
      .eq('owner', ownerId)
      .in('hash', hashes.slice(i, i + 200))
    for (const row of (data ?? []) as { hash: string; metadata: unknown }[]) {
      if (row.metadata && typeof row.metadata === 'object') {
        metaByHash.set(row.hash, row.metadata as AttachmentPhotoMeta)
      }
    }
  }

  const folder = zip.folder('attachments')!
  const manifest: Record<string, AttachmentManifestEntry> = {}
  let done = 0
  for (const [hash, ext] of refs) {
    const blob = await downloadAttachmentBlob(sb, ownerId, hash, ext)
    if (blob) {
      folder.file(`${hash}.${ext}`, blob)
      const meta = metaByHash.get(hash)
      manifest[hash] = meta ? { ext, metadata: meta } : { ext }
    }
    onProgress?.(++done, total)
  }
  zip.file('attachments.json', JSON.stringify({ version: 1, attachments: manifest }, null, 2))
}
