// Image attachment storage via Supabase Storage.
//
// Object key layout: `<owner-uuid>/<sha256-hex>.<ext>`
// Storage bucket: 'attachments' (private, RLS enforced by path prefix).
//
// Stable markdown reference format: `![alt](attachment:<sha256>.<ext>)`
// Never store expiring signed URLs in entry bodies — resolve them at render time.

import type { SupabaseClient } from '@supabase/supabase-js'
import { prepareImageForUpload } from './imageCompress'
import type { AttachmentPhotoMeta } from './attachmentCaption'

const BUCKET = 'attachments'
const SIGNED_URL_TTL_S = 3600 // 1 hour

// Module-level cache: storageKey → { url, expiresAt (ms) }
const urlCache = new Map<string, { url: string; expiresAt: number }>()

export async function computeSha256(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer()
  const hashBuf = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface EnsureResult {
  hash: string
  isNew: boolean
}

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
}

/** Infer a stable file extension from an image upload. */
export function extFromImageFile(file: File): string {
  const name = file.name
  const dot = name.lastIndexOf('.')
  if (dot >= 0) {
    const ext = name.slice(dot + 1).toLowerCase()
    if (/^[a-z0-9]+$/.test(ext)) return ext
  }
  return IMAGE_EXT_BY_MIME[file.type] ?? 'jpg'
}

/** Markdown ref written into entry bodies — resolved to signed URLs at render time. */
export function formatAttachmentMarkdown(hash: string, ext: string, alt = ''): string {
  return `![${alt}](attachment:${hash}.${ext})`
}

/** Temporary ref while an editor upload is in flight — replaced once stored. */
export function formatPendingAttachmentMarkdown(pendingId: string, alt = ''): string {
  return `![${alt}](attachment-pending:${pendingId})`
}

/**
 * Matches `![alt](attachment:<64-char sha256>.<ext>)` in markdown.
 * Groups: [full, alt, hash, ext]
 */
export const ATTACHMENT_REF_RE = /!\[([^\]]*)\]\(attachment:([a-f0-9]{64})\.([a-z0-9]+)\)/g

/** Matches in-flight editor uploads. Groups: [full, alt, pendingId] */
export const PENDING_ATTACHMENT_REF_RE =
  /!\[([^\]]*)\]\(attachment-pending:([a-f0-9-]{36})\)/g

/**
 * Upload an image for the signed-in user. Idempotent by content hash.
 * @throws when Supabase is unavailable or the user is not signed in.
 */
export async function uploadImageAttachment(
  supabase: SupabaseClient,
  file: File,
  meta?: AttachmentPhotoMeta,
): Promise<EnsureResult & { ext: string }> {
  const { data } = await supabase.auth.getUser()
  const ownerId = data.user?.id
  if (!ownerId) throw new Error('Sign in to add photos')
  const prepared = await prepareImageForUpload(file)
  const ext = extFromImageFile(prepared)
  const result = await ensureAttachment(supabase, ownerId, prepared, ext, meta)
  return { ...result, ext }
}

/**
 * Upload a blob and upsert the attachments metadata row.
 * Idempotent: if (owner, hash) already exists the upload is skipped.
 * Returns the SHA-256 hash and whether the file was newly uploaded.
 */
export async function ensureAttachment(
  supabase: SupabaseClient,
  ownerId: string,
  blob: Blob,
  ext: string,
  meta?: AttachmentPhotoMeta,
): Promise<EnsureResult> {
  const hash = await computeSha256(blob)
  const storageKey = `${ownerId}/${hash}.${ext}`

  const { data: existing } = await supabase
    .from('attachments')
    .select('hash')
    .eq('owner', ownerId)
    .eq('hash', hash)
    .maybeSingle()

  if (existing) return { hash, isNew: false }

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey, blob, { contentType: blob.type || `image/${ext}`, upsert: false })

  if (uploadErr && !uploadErr.message.toLowerCase().includes('already exists')) {
    throw new Error(`Storage upload failed: ${uploadErr.message}`)
  }

  const row: Record<string, unknown> = {
    owner: ownerId,
    hash,
    storage_key: storageKey,
    mime: blob.type || null,
    bytes: blob.size,
  }
  if (meta && Object.keys(meta).length > 0) row.metadata = meta

  await supabase.from('attachments').upsert(row, { onConflict: 'owner,hash', ignoreDuplicates: true })

  return { hash, isNew: true }
}

/** Load stored metadata for a photo (capture time, etc.). */
export async function fetchAttachmentMeta(
  supabase: SupabaseClient,
  ownerId: string,
  hash: string,
): Promise<AttachmentPhotoMeta | null> {
  const { data } = await supabase
    .from('attachments')
    .select('metadata')
    .eq('owner', ownerId)
    .eq('hash', hash)
    .maybeSingle()
  if (!data?.metadata || typeof data.metadata !== 'object') return null
  const m = data.metadata as Record<string, unknown>
  const takenAt = typeof m.takenAt === 'string' ? m.takenAt : undefined
  return takenAt ? { takenAt } : null
}

/**
 * Resolve `attachment:<hash>.<ext>` to a signed URL.
 * Results are cached until 60 s before the URL expires.
 */
export async function resolveAttachmentUrl(
  supabase: SupabaseClient,
  ownerId: string,
  hash: string,
  ext: string,
): Promise<string | null> {
  const storageKey = `${ownerId}/${hash}.${ext}`
  const cached = urlCache.get(storageKey)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storageKey, SIGNED_URL_TTL_S)

  if (error || !data) return null

  urlCache.set(storageKey, {
    url: data.signedUrl,
    expiresAt: Date.now() + (SIGNED_URL_TTL_S - 60) * 1000,
  })
  return data.signedUrl
}

/**
 * Download the raw stored bytes for an attachment. Used by the backup export to
 * bundle image binaries into the zip so a restore is self-contained.
 * Returns null if the object is missing or unreadable.
 */
export async function downloadAttachmentBlob(
  supabase: SupabaseClient,
  ownerId: string,
  hash: string,
  ext: string,
): Promise<Blob | null> {
  const storageKey = `${ownerId}/${hash}.${ext}`
  const { data, error } = await supabase.storage.from(BUCKET).download(storageKey)
  if (error || !data) return null
  return data
}

/**
 * Replace all `attachment:<hash>.<ext>` refs in `markdown` with fresh signed URLs.
 * Used by the render layer before passing to marked. Returns the rewritten string.
 */
export async function resolveAttachmentsInMarkdown(
  supabase: SupabaseClient,
  ownerId: string,
  markdown: string,
): Promise<string> {
  const refs = [...markdown.matchAll(ATTACHMENT_REF_RE)]
  if (refs.length === 0) return markdown

  let result = markdown
  for (const [full, alt, hash, ext] of refs) {
    const url = await resolveAttachmentUrl(supabase, ownerId, hash!, ext!)
    if (url) result = result.replace(full!, `![${alt ?? ''}](${url})`)
  }
  return result
}
