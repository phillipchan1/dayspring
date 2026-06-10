// Image import pipeline for Day One and Diarly exports.
//
// Called after the text entries have been upserted. Scans entry bodies for
// image references, reads each file lazily from the archive (a zip stays
// compressed, a folder reads straight off disk), uploads to Supabase Storage
// via ensureAttachment, then rewrites the body reference to the stable
// `attachment:<sha256>.<ext>` form.
//
// Day One:  `![alt](attachment-pending:<UUID>)` → `![alt](attachment:<sha256>.<ext>)`
// Diarly:   `![alt](data/<hash>.<ext>)` → `![alt](attachment:<sha256>.<ext>)`

import type { SupabaseClient } from '@supabase/supabase-js'
import { baseName, findByName, type ArchiveFile, type ImportArchive } from './archive'
import type { ImportedEntry } from './types'
import type { AttachmentPhotoMeta } from '../attachmentCaption'
import { ensureAttachment } from '../attachments'

export interface ImageImportProgress {
  done: number
  total: number
  uploaded: number
  skipped: number
}

export interface ImageImportResult {
  uploaded: number
  skipped: number  // already in storage (dedup)
  failed: number   // upload or read error
  missing: number  // referenced in body but not found in zip
  entries: ImportedEntry[]
}

// ── Day One ──────────────────────────────────────────────────────────────────

// Matches refs written by cleanDayOneText: `![alt](attachment-pending:<UUID>)`
// Day One UUIDs are uppercase hex with hyphens.
const DAY_ONE_PENDING_RE = /!\[([^\]]*)\]\(attachment-pending:([0-9A-Fa-f-]{32,})\)/g

/**
 * Import photos from a Day One JSON export (zip or folder).
 * Entries must already have been text-upserted; this step uploads photos and
 * rewrites `attachment-pending:UUID` refs to `attachment:<sha256>.<ext>`.
 * Images are processed one at a time to keep memory bounded on large exports.
 */
export async function importDayOneImages(
  archive: ImportArchive,
  entries: ImportedEntry[],
  supabase: SupabaseClient,
  ownerId: string,
  onProgress: (p: ImageImportProgress) => void,
): Promise<ImageImportResult> {
  // Index: uppercase UUID → archive file (handles photos/ at any folder depth)
  const photoMap = new Map<string, ArchiveFile>()
  for (const file of archive.files) {
    const segs = file.path.split('/')
    if (!segs.some((s) => s.toLowerCase() === 'photos')) continue
    const filename = baseName(file.path)
    const dot = filename.lastIndexOf('.')
    if (dot === -1) continue
    photoMap.set(filename.slice(0, dot).toUpperCase(), file)
  }

  const total = entries.reduce(
    (n, e) => n + (e.body_markdown.match(DAY_ONE_PENDING_RE)?.length ?? 0),
    0,
  )
  const prog: ImageImportProgress = { done: 0, total, uploaded: 0, skipped: 0 }
  let failed = 0
  let missing = 0
  const updated: ImportedEntry[] = []

  for (const entry of entries) {
    DAY_ONE_PENDING_RE.lastIndex = 0
    if (!DAY_ONE_PENDING_RE.test(entry.body_markdown)) {
      DAY_ONE_PENDING_RE.lastIndex = 0
      updated.push(entry)
      continue
    }
    DAY_ONE_PENDING_RE.lastIndex = 0

    let body = entry.body_markdown
    const refs = [...body.matchAll(DAY_ONE_PENDING_RE)]

    for (const [full, alt, uuid] of refs) {
      const photoFile = photoMap.get(uuid!.toUpperCase())
      if (!photoFile) {
        missing++
        onProgress({ ...prog, done: ++prog.done })
        continue
      }

      const filename = baseName(photoFile.path)
      const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase() || 'jpg'

      try {
        const blob = await photoFile.blob()
        const { hash, isNew } = await ensureAttachment(supabase, ownerId, blob, ext)
        body = body.replace(full!, `![${alt ?? ''}](attachment:${hash}.${ext})`)
        if (isNew) prog.uploaded++
        else prog.skipped++
      } catch {
        body = body.replace(full!, '')
        failed++
      }

      onProgress({ ...prog, done: ++prog.done })
    }

    updated.push({ ...entry, body_markdown: body })
  }

  return { uploaded: prog.uploaded, skipped: prog.skipped, failed, missing, entries: updated }
}

// ── Dayspring backup (own export format) ──────────────────────────────────────

// Refs are already in the stable final form: `![alt](attachment:<sha256>.<ext>)`.
const DAYSPRING_IMG_RE =
  /!\[([^\]]*)\]\(attachment:([a-f0-9]{64})\.([a-z0-9]+)(?:\?size=[smf])?\)/g

/**
 * Re-upload photos bundled in a Dayspring backup zip (`attachments/<hash>.<ext>`).
 * Entries must already have been text-upserted. Because refs are content-hashed
 * and we re-upload the exact stored bytes, ensureAttachment reproduces the same
 * hash and the existing refs resolve as-is — so no body rewrite is normally
 * needed. The metadata manifest (`attachments.json`) restores capture times.
 */
export async function importDayspringImages(
  archive: ImportArchive,
  entries: ImportedEntry[],
  supabase: SupabaseClient,
  ownerId: string,
  onProgress: (p: ImageImportProgress) => void,
): Promise<ImageImportResult> {
  // Index bundled binaries by "<hash>.<ext>" (under an `attachments/` folder).
  const fileMap = new Map<string, ArchiveFile>()
  for (const file of archive.files) {
    const segs = file.path.split('/')
    if (!segs.some((s) => s.toLowerCase() === 'attachments')) continue
    const filename = baseName(file.path)
    if (filename) fileMap.set(filename.toLowerCase(), file)
  }

  // Optional metadata manifest: hash → capture time, etc.
  const metaByHash = new Map<string, AttachmentPhotoMeta>()
  const manifestFile = findByName(archive, 'attachments.json')
  if (manifestFile) {
    try {
      const parsed = JSON.parse(await manifestFile.text()) as {
        attachments?: Record<string, { metadata?: AttachmentPhotoMeta }>
      }
      for (const [hash, info] of Object.entries(parsed.attachments ?? {})) {
        if (info?.metadata && typeof info.metadata === 'object') metaByHash.set(hash, info.metadata)
      }
    } catch {
      // Missing/corrupt manifest is non-fatal — binaries still import.
    }
  }

  const total = entries.reduce(
    (n, e) => n + (e.body_markdown.match(DAYSPRING_IMG_RE)?.length ?? 0),
    0,
  )
  const prog: ImageImportProgress = { done: 0, total, uploaded: 0, skipped: 0 }
  let failed = 0
  let missing = 0
  const updated: ImportedEntry[] = []

  for (const entry of entries) {
    DAYSPRING_IMG_RE.lastIndex = 0
    if (!DAYSPRING_IMG_RE.test(entry.body_markdown)) {
      DAYSPRING_IMG_RE.lastIndex = 0
      updated.push(entry)
      continue
    }
    DAYSPRING_IMG_RE.lastIndex = 0

    let body = entry.body_markdown
    const refs = [...body.matchAll(DAYSPRING_IMG_RE)]

    for (const [full, alt, origHash, rawExt] of refs) {
      const ext = rawExt!.toLowerCase()
      const photoFile = fileMap.get(`${origHash}.${ext}`.toLowerCase())

      if (!photoFile) {
        // Binary not bundled (e.g. an older text-only backup). Leave the ref in
        // place — it may still resolve against existing storage on this account.
        missing++
        onProgress({ ...prog, done: ++prog.done })
        continue
      }

      try {
        const blob = await photoFile.blob()
        const { hash, isNew } = await ensureAttachment(supabase, ownerId, blob, ext, metaByHash.get(origHash!))
        // The re-derived hash should equal the original; rewrite only on the rare
        // chance it doesn't, so the ref still points at what we just stored.
        if (hash !== origHash) {
          body = body.replace(full!, `![${alt ?? ''}](attachment:${hash}.${ext})`)
        }
        if (isNew) prog.uploaded++
        else prog.skipped++
      } catch {
        // Keep the ref on transient upload failure — a later re-import can fix it.
        failed++
      }

      onProgress({ ...prog, done: ++prog.done })
    }

    updated.push({ ...entry, body_markdown: body })
  }

  return { uploaded: prog.uploaded, skipped: prog.skipped, failed, missing, entries: updated }
}

// ── Diarly ───────────────────────────────────────────────────────────────────

// Matches Diarly inline image refs: `![alt](data/<hex-hash>.<ext>)`
const DIARLY_IMG_RE = /!\[([^\]]*)\]\(data\/([a-f0-9]+)\.([a-zA-Z0-9]+)\)/g

/**
 * Import photos from a Diarly Markdown export (zip or folder).
 * Entries must already have been text-upserted. Rewrites `data/<hash>.<ext>`
 * refs to `attachment:<sha256>.<ext>`.
 */
export async function importDiarlyImages(
  archive: ImportArchive,
  entries: ImportedEntry[],
  supabase: SupabaseClient,
  ownerId: string,
  onProgress: (p: ImageImportProgress) => void,
): Promise<ImageImportResult> {
  // Index files by lowercased basename ("<hash>.<ext>"); a ref then picks the
  // candidate whose path ends with its "<journal>/<year>/data/" suffix. Matching
  // on the suffix (not a fixed "Export/" prefix) means a dropped folder — whose
  // top-level name is whatever the user named it — resolves the same as a zip.
  const byBase = new Map<string, ArchiveFile[]>()
  for (const file of archive.files) {
    const key = baseName(file.path).toLowerCase()
    const list = byBase.get(key)
    if (list) list.push(file)
    else byBase.set(key, [file])
  }

  const total = entries.reduce(
    (n, e) => n + (e.body_markdown.match(DIARLY_IMG_RE)?.length ?? 0),
    0,
  )
  const prog: ImageImportProgress = { done: 0, total, uploaded: 0, skipped: 0 }
  let failed = 0
  let missing = 0
  const updated: ImportedEntry[] = []

  for (const entry of entries) {
    DIARLY_IMG_RE.lastIndex = 0
    if (!DIARLY_IMG_RE.test(entry.body_markdown)) {
      DIARLY_IMG_RE.lastIndex = 0
      updated.push(entry)
      continue
    }
    DIARLY_IMG_RE.lastIndex = 0

    let body = entry.body_markdown
    const refs = [...body.matchAll(DIARLY_IMG_RE)]

    // Reconstruct the Data/ folder suffix from external_id "<Journal>/<Year>/<base>":
    //   "<journal>/<year>/data/"  (anything may precede it — "Export/", a folder name, …)
    const idParts = entry.external_id.split('/')
    const dataSuffix = idParts.length >= 3
      ? `${idParts.slice(0, idParts.length - 1).join('/')}/data/`.toLowerCase()
      : 'data/'

    for (const [full, alt, hash, rawExt] of refs) {
      const ext = rawExt!.toLowerCase()
      const wantSuffix = `${dataSuffix}${hash!}.${ext}`.toLowerCase()
      const candidates = byBase.get(`${hash!}.${ext}`.toLowerCase()) ?? []
      const photoFile = candidates.find((f) => {
        const p = f.path.toLowerCase()
        return p === wantSuffix || p.endsWith(`/${wantSuffix}`)
      })

      if (!photoFile) {
        missing++
        onProgress({ ...prog, done: ++prog.done })
        continue
      }

      try {
        const blob = await photoFile.blob()
        const { hash: sha, isNew } = await ensureAttachment(supabase, ownerId, blob, ext)
        body = body.replace(full!, `![${alt ?? ''}](attachment:${sha}.${ext})`)
        if (isNew) prog.uploaded++
        else prog.skipped++
      } catch {
        body = body.replace(full!, '')
        failed++
      }

      onProgress({ ...prog, done: ++prog.done })
    }

    updated.push({ ...entry, body_markdown: body })
  }

  return { uploaded: prog.uploaded, skipped: prog.skipped, failed, missing, entries: updated }
}
