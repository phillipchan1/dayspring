// Image attachment storage via the Worker (R2).
//
// Object key layout: `<owner-uuid>/<sha256-hex>.<ext>`
// Bucket: R2 `ATTACHMENTS` (private, owner prefix).
//
// Stable markdown reference format: `![alt](attachment:<sha256>.<ext>)`
// Never store expiring signed URLs in entry bodies — resolve them at render time.

import { analyzeImage, makeDisplayVariant, prepareImageForUpload } from './imageCompress'
import { attachmentCacheGet, attachmentCachePut } from './db'
import { isTauri } from './platform'
import type { AttachmentPhotoMeta } from './attachmentCaption'
import { apiPost } from './api'
import { remote } from './remote'
import { getSessionState } from './sessionStore'

const SIGNED_URL_TTL_S = 3600 // 1 hour

type SignedTransform = { width: number; quality: number; resize: 'contain' }

// Display transform for the viewport: a ~1400px,
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

/** Rendered display size for an inline photo. 'm' (medium) is the default and
 *  carries no marker; 's' (small) and 'f' (full) are persisted as `?size=`. */
export type ImageSize = 's' | 'm' | 'f'

/** Markdown ref written into entry bodies — resolved to signed URLs at render time. */
export function formatAttachmentMarkdown(
  hash: string,
  ext: string,
  alt = '',
  size: ImageSize = 'm',
): string {
  const sizeParam = size === 'm' ? '' : `?size=${size}`
  return `![${alt}](attachment:${hash}.${ext}${sizeParam})`
}

/** Normalize a captured `?size=` group (or undefined) to an ImageSize. */
export function imageSizeFrom(raw: string | undefined | null): ImageSize {
  return raw === 's' || raw === 'f' ? raw : 'm'
}

/** Temporary ref while an editor upload is in flight — replaced once stored. */
export function formatPendingAttachmentMarkdown(pendingId: string, alt = ''): string {
  return `![${alt}](attachment-pending:${pendingId})`
}

/**
 * Matches `![alt](attachment:<64-char sha256>.<ext>)` in markdown.
 * Groups: [full, alt, hash, ext]
 */
export const ATTACHMENT_REF_RE =
  /!\[([^\]]*)\]\(attachment:([a-f0-9]{64})\.([a-z0-9]+)(?:\?size=([smf]))?\)/g

/** Matches in-flight editor uploads. Groups: [full, alt, pendingId] */
export const PENDING_ATTACHMENT_REF_RE =
  /!\[([^\]]*)\]\(attachment-pending:([a-f0-9-]{36})\)/g

/**
 * Upload an image for the signed-in user. Idempotent by content hash.
 * @throws when the user is not signed in.
 */
export async function attachmentOwnerId(_client?: unknown): Promise<string | null> {
  return getSessionState().session?.user.id ?? null
}

async function workersSign(body: {
  action: 'download' | 'upload'
  storageKey: string
  hash?: string
  mime?: string
  bytes?: number
  transform?: SignedTransform
}): Promise<{ signedUrl: string }> {
  return apiPost('/api/storage/sign', body)
}

export async function uploadImageAttachment(
  _client: unknown,
  file: File,
  meta?: AttachmentPhotoMeta,
  /** The photo is read and resized; what is left is the network. */
  onSending?: () => void,
): Promise<EnsureResult & { ext: string }> {
  // The session already in memory, not a round trip to ask the server who this
  // is: that was one wait per photo before a single byte moved, and storage
  // checks the same token on the upload itself.
  const ownerId = await attachmentOwnerId()
  if (!ownerId) throw new Error('Sign in to add photos')
  const prepared = await prepareImageForUpload(file)
  const ext = extFromImageFile(prepared)
  // Capture dimensions + dominant color so the editor can crop extreme aspect
  // ratios and tint the frame. Merges with the caller's capture-time meta.
  const analysis = await analyzeImage(prepared)
  const fullMeta: AttachmentPhotoMeta = { ...meta, ...analysis }
  onSending?.()
  const result = await ensureAttachment(_client, ownerId, prepared, ext, fullMeta)
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
  _client: unknown,
  ownerId: string,
  blob: Blob,
  ext: string,
  meta?: AttachmentPhotoMeta,
): Promise<EnsureResult> {
  const hash = await computeSha256(blob)
  const storageKey = `${ownerId}/${hash}.${ext}`

  const { signedUrl } = await workersSign({
    action: 'upload',
    storageKey,
    hash,
    mime: blob.type || `image/${ext}`,
    bytes: blob.size,
  })
  const put = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'content-type': blob.type || `image/${ext}` },
    body: blob,
  })
  if (!put.ok) throw new Error(`Storage upload failed: ${put.status}`)
  if (meta && Object.keys(meta).length > 0) {
    await remote()
      .from('attachments')
      .upsert(
        {
          owner: ownerId,
          hash,
          storage_key: storageKey,
          mime: blob.type || null,
          bytes: blob.size,
          metadata: meta,
        },
        { onConflict: 'owner,hash' },
      )
  }
  return { hash, isNew: true }
}

/** Load stored metadata for a photo (capture time, etc.). */
export async function fetchAttachmentMeta(
  _client: unknown,
  ownerId: string,
  hash: string,
): Promise<AttachmentPhotoMeta | null> {
  const { data } = await remote()
    .from('attachments')
    .select('metadata')
    .eq('owner', ownerId)
    .eq('hash', hash)
    .maybeSingle()
  if (!data?.metadata || typeof data.metadata !== 'object') return null
  const m = data.metadata as Record<string, unknown>
  const out: AttachmentPhotoMeta = {}
  if (typeof m.takenAt === 'string') out.takenAt = m.takenAt
  if (typeof m.width === 'number') out.width = m.width
  if (typeof m.height === 'number') out.height = m.height
  if (typeof m.color === 'string') out.color = m.color
  return Object.keys(out).length > 0 ? out : null
}

/**
 * Resolve `attachment:<hash>.<ext>` to a signed URL, optionally a transformed
 * (resized) render. Results are cached until 60 s before the URL expires.
 */
export async function resolveAttachmentUrl(
  _client: unknown,
  ownerId: string,
  hash: string,
  ext: string,
  transform?: SignedTransform,
): Promise<string | null> {
  const storageKey = `${ownerId}/${hash}.${ext}`
  const cacheKey = transform ? `${storageKey}|${transform.width}q${transform.quality}` : storageKey
  const cached = urlCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.url

  const { signedUrl } = await workersSign({
    action: 'download',
    storageKey,
    ...(transform ? { transform } : {}),
  })
  urlCache.set(cacheKey, {
    url: signedUrl,
    expiresAt: Date.now() + (SIGNED_URL_TTL_S - 60) * 1000,
  })
  return signedUrl
}

/**
 * Resolve a photo to a display URL, preferring the local cache:
 *   live object URL → IndexedDB blob → network (signed transform, then cached).
 * Falls back to the raw signed transform URL if the blob fetch fails (offline
 * with a cold cache, or a CORS hiccup) so the photo still shows over the wire.
 * Returns null only when even a signed URL can't be obtained.
 */
export async function resolveAttachmentDisplayUrl(
  _client: unknown,
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

  const signed = await resolveAttachmentUrl(_client, ownerId, hash, ext, DISPLAY_TRANSFORM)
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
  _client: unknown,
  ownerId: string,
  hash: string,
  ext: string,
): Promise<Blob | null> {
  const storageKey = `${ownerId}/${hash}.${ext}`
  const { signedUrl } = await workersSign({ action: 'download', storageKey })
  const res = await fetch(signedUrl)
  if (!res.ok) return null
  return res.blob()
}
