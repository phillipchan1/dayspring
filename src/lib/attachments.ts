// Image attachment storage via Supabase Storage.
//
// Object key layout: `<owner-uuid>/<sha256-hex>.<ext>`
// Storage bucket: 'attachments' (private, RLS enforced by path prefix).
//
// Stable markdown reference format: `![alt](attachment:<sha256>.<ext>)`
// Never store expiring signed URLs in entry bodies — resolve them at render time.

import type { SupabaseClient } from '@supabase/supabase-js'

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

  // "already exists" means a previous run uploaded it before we could insert the row.
  if (uploadErr && !uploadErr.message.toLowerCase().includes('already exists')) {
    throw new Error(`Storage upload failed: ${uploadErr.message}`)
  }

  await supabase.from('attachments').upsert(
    { owner: ownerId, hash, storage_key: storageKey, mime: blob.type || null, bytes: blob.size },
    { onConflict: 'owner,hash', ignoreDuplicates: true },
  )

  return { hash, isNew: true }
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
 * Matches `![alt](attachment:<64-char sha256>.<ext>)` in markdown.
 * Groups: [full, alt, hash, ext]
 */
export const ATTACHMENT_REF_RE = /!\[([^\]]*)\]\(attachment:([a-f0-9]{64})\.([a-z0-9]+)\)/g

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
