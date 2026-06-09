// Image attachment storage via Supabase Storage.
//
// Object key layout: `<owner-uuid>/<sha256-hex>.<ext>`
// Storage bucket: 'attachments' (private, RLS enforced by path prefix).
//
// Stable markdown reference format: `![alt](attachment:<sha256>.<ext>)`
// Never store expiring signed URLs in entry bodies — resolve them at render time.

import type { SupabaseClient } from '@supabase/supabase-js'
import { makeDisplayVariant, prepareImageForUpload } from './imageCompress'
import { attachmentCacheGet, attachmentCachePut } from './db'
import { isTauri } from './platform'
import type { AttachmentPhotoMeta } from './attachmentCaption'

const BUCKET = 'attachments'
const SIGNED_URL_TTL_S = 3600 // 1 hour

// Display transform requested from Supabase Storage (Pro feature): a ~1400px,
// quality-72 render so we ship a fraction of the stored bytes to the viewport.
const DISPLAY_TRANSFORM = { width: 1400, quality: 72, resize: 'contain' as const }

// Module-level cache: `${storageKey}|${transformSig}` → { url, expiresAt (ms) }
const urlCache = new Map<string, { url: string; expiresAt: number }>()

// Live object URLs for cached blobs, keyed by `<hash>.<ext>`. Reused so we don't
// mint duplicates; they live for the session (revoked implicitly on reload).
const objectUrlCache = new Map<string, string>()

const MB = 1024 * 1024
let persistRequested = false

/** Ask the browser to keep our storage through memory pressure (best-effort). */
function requestPersistentStorage(): void {
  if (persistRequested) return
  persistRequested = true
  try {
    void navigator.storage?.persist?.()
  } catch {
    /* not supported — eviction is lossless anyway */
  }
}

/**
 * Local image-cache budget. Desktop (Tauri) gets a generous cap, mobile a
 * conservative one; both are clamped to ~half the reported quota where the
 * Storage API exposes it. The cache is bounded LRU, so this is a ceiling, not a
 * reservation.
 */
async function displayCacheBudgetBytes(): Promise<number> {
  const cap = isTauri() ? 500 * MB : 150 * MB
  try {
    const quota = (await navigator.storage?.estimate?.())?.quota
    if (quota) return Math.max(50 * MB, Math.min(cap, Math.floor(quota * 0.5)))
  } catch {
    /* estimate unsupported */
  }
  return cap
}

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
  // Seed the local cache with a display variant so the photo we just added is
  // instant on this device (and other devices fill their cache on first view).
  void cacheDisplayVariant(ownerId, result.hash, ext, prepared)
  return { ...result, ext }
}

/** Generate + store a display-sized blob locally. Fire-and-forget; failures are
 *  harmless (the network path rebuilds it on demand). */
async function cacheDisplayVariant(
  ownerId: string,
  hash: string,
  ext: string,
  source: Blob,
): Promise<void> {
  try {
    const variant = await makeDisplayVariant(source)
    if (!variant) return
    requestPersistentStorage()
    await attachmentCachePut(`${hash}.${ext}`, ownerId, variant, await displayCacheBudgetBytes())
  } catch {
    /* cache is best-effort */
  }
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

type SignedTransform = { width: number; quality: number; resize: 'contain' }

/**
 * Resolve `attachment:<hash>.<ext>` to a signed URL, optionally a transformed
 * (resized) render. Results are cached until 60 s before the URL expires.
 */
export async function resolveAttachmentUrl(
  supabase: SupabaseClient,
  ownerId: string,
  hash: string,
  ext: string,
  transform?: SignedTransform,
): Promise<string | null> {
  const storageKey = `${ownerId}/${hash}.${ext}`
  const cacheKey = transform ? `${storageKey}|${transform.width}q${transform.quality}` : storageKey
  const cached = urlCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storageKey, SIGNED_URL_TTL_S, transform ? { transform } : undefined)

  if (error || !data) return null

  urlCache.set(cacheKey, {
    url: data.signedUrl,
    expiresAt: Date.now() + (SIGNED_URL_TTL_S - 60) * 1000,
  })
  return data.signedUrl
}

/**
 * Resolve a photo to a display URL, preferring the local cache:
 *   live object URL → IndexedDB blob → network (signed transform, then cached).
 * Falls back to the raw signed transform URL if the blob fetch fails (offline
 * with a cold cache, or a CORS hiccup) so the photo still shows over the wire.
 * Returns null only when even a signed URL can't be obtained.
 */
export async function resolveAttachmentDisplayUrl(
  supabase: SupabaseClient,
  ownerId: string,
  hash: string,
  ext: string,
): Promise<string | null> {
  const key = `${hash}.${ext}`

  const live = objectUrlCache.get(key)
  if (live) return live

  const cachedBlob = await attachmentCacheGet(key)
  if (cachedBlob) {
    const url = URL.createObjectURL(cachedBlob)
    objectUrlCache.set(key, url)
    return url
  }

  const signed = await resolveAttachmentUrl(supabase, ownerId, hash, ext, DISPLAY_TRANSFORM)
  if (!signed) return null

  try {
    const res = await fetch(signed)
    if (!res.ok) return signed
    const blob = await res.blob()
    requestPersistentStorage()
    await attachmentCachePut(key, ownerId, blob, await displayCacheBudgetBytes())
    const url = URL.createObjectURL(blob)
    objectUrlCache.set(key, url)
    return url
  } catch {
    // Network fetch failed — hand back the signed URL; the <img> can still load
    // it directly (no CORS constraint on image display).
    return signed
  }
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
