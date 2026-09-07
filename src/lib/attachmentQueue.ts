// Photo uploads that outlive their network.
//
// Adding a photo used to be all-or-nothing: the editor inserted a pending
// placeholder, awaited the upload, and on ANY failure deleted the placeholder
// with a console.warn. Offline — or on a train, or in a lift — the photo the
// user had just added simply vanished from the entry, with no explanation and
// no way to get it back. "Replace photo" was worse still: it removed the
// original ref first, so a failed replace destroyed a photo that was already
// safely in storage.
//
// A failure that looks like the network now parks the bytes in IndexedDB and
// leaves the placeholder in the text. That placeholder already renders as a
// pending photo (PendingAttachmentWidget), so nothing new appears on screen —
// it just stops lying about having lost the image. When the device reconnects
// the upload retries and the ref resolves itself, in whichever entry it ended
// up in, open or not.
//
// Only a file the server will never accept is dropped, and then the caller
// removes the placeholder as before.

import { supabase } from './supabase'
import { uploadImageAttachment, formatAttachmentMarkdown } from './attachments'
import { PENDING_ATTACHMENT_REF_RE } from './attachments'
import type { AttachmentPhotoMeta } from './attachmentCaption'
import * as cache from './db'
import { rewriteEntryBodies } from './repo'
import { classifySyncError, describeSyncError, MAX_SYNC_ATTEMPTS } from './syncError'

export interface UploadedRef {
  hash: string
  ext: string
}

/** Does this entry body hold the placeholder for `pendingId`? Exported for tests. */
export function bodyHasPending(body: string, pendingId: string): boolean {
  PENDING_ATTACHMENT_REF_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PENDING_ATTACHMENT_REF_RE.exec(body)) !== null) {
    if (m[2] === pendingId) return true
  }
  return false
}

/**
 * Swap `attachment-pending:<id>` for the real ref, preserving whatever alt text
 * the placeholder carried (the user may have captioned it while it was queued).
 * Exported for tests — this rewrites entry bodies, so it gets direct coverage.
 */
export function replacePendingRef(body: string, pendingId: string, ref: UploadedRef | null): string {
  PENDING_ATTACHMENT_REF_RE.lastIndex = 0
  return body.replace(PENDING_ATTACHMENT_REF_RE, (full, alt: string, id: string) => {
    if (id !== pendingId) return full
    return ref ? formatAttachmentMarkdown(ref.hash, ref.ext, alt ?? '') : ''
  })
}

/** Park a photo until the network comes back. */
async function queueUpload(
  pendingId: string,
  ownerId: string,
  file: File,
  ext: string,
  alt: string,
  meta?: AttachmentPhotoMeta,
): Promise<void> {
  await cache.pendingUploadPut({
    id: pendingId,
    owner: ownerId,
    blob: file,
    ext,
    alt,
    ...(meta ? { meta: meta as Record<string, unknown> } : {}),
    createdAt: Date.now(),
  })
  // Best-effort: ask the browser not to evict us. These bytes exist nowhere else.
  try {
    void navigator.storage?.persist?.()
  } catch {
    /* unsupported */
  }
}

/**
 * Upload a photo now, or queue it for later.
 *
 * Returns the resolved ref when the upload succeeded, or null when it has been
 * queued — in which case the caller must LEAVE the pending placeholder in the
 * document; it resolves itself once the device reconnects.
 *
 * Throws only when the file will never be accepted, which is the one case where
 * removing the placeholder is honest.
 */
export async function uploadOrQueue(
  pendingId: string,
  ownerId: string,
  file: File,
  ext: string,
  alt: string,
  meta?: AttachmentPhotoMeta,
): Promise<UploadedRef | null> {
  const sb = supabase
  if (!sb) throw new Error('Supabase is not configured')
  try {
    const { hash, ext: uploadedExt } = await uploadImageAttachment(sb, file, meta)
    return { hash, ext: uploadedExt }
  } catch (e) {
    if (classifySyncError(e) === 'permanent') throw e
    await queueUpload(pendingId, ownerId, file, ext, alt, meta)
    return null
  }
}

/**
 * Retry every queued photo. Called after each outbox flush, so it rides the same
 * triggers as everything else: reconnect, refocus, the heartbeat, app launch.
 */
export async function drainPendingUploads(): Promise<void> {
  const sb = supabase
  if (!sb || !navigator.onLine) return

  for (const row of await cache.pendingUploadAll()) {
    if (row.quarantined) continue
    try {
      const file = new File([row.blob], `queued.${row.ext}`, {
        type: row.blob.type || `image/${row.ext}`,
      })
      const { hash, ext } = await uploadImageAttachment(
        sb,
        file,
        row.meta as AttachmentPhotoMeta | undefined,
      )
      await rewriteEntryBodies(
        (entry) => bodyHasPending(entry.body_markdown, row.id),
        (body) => replacePendingRef(body, row.id, { hash, ext }),
      )
      await cache.pendingUploadDelete(row.id)
    } catch (e) {
      const failure = classifySyncError(e)
      if (failure === 'offline') return // still no network; try again next time
      const attempts = (row.attempts ?? 0) + 1
      const giveUp = failure === 'permanent' || attempts >= MAX_SYNC_ATTEMPTS
      await cache.pendingUploadMarkFailure(row.id, {
        quarantine: giveUp,
        error: describeSyncError(e),
      })
      if (giveUp) {
        // Storage will never take it. Clear the placeholder rather than leave a
        // photo that claims to be uploading forever — on this device and on
        // every other one that synced the entry.
        await rewriteEntryBodies(
          (entry) => bodyHasPending(entry.body_markdown, row.id),
          (body) => replacePendingRef(body, row.id, null),
        )
      }
    }
  }
}
