// Image import pipeline for Day One and Diarly exports.
//
// Called after the text entries have been upserted. Scans entry bodies for
// image references, reads each file lazily from the zip (never inflating the
// whole archive), uploads to Supabase Storage via ensureAttachment, then
// rewrites the body reference to the stable `attachment:<sha256>.<ext>` form.
//
// Day One:  `![alt](attachment-pending:<UUID>)` → `![alt](attachment:<sha256>.<ext>)`
// Diarly:   `![alt](data/<hash>.<ext>)` → `![alt](attachment:<sha256>.<ext>)`

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImportedEntry } from './types'
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
 * Import photos from a Day One JSON export buffer.
 * Entries must already have been text-upserted; this step uploads photos and
 * rewrites `attachment-pending:UUID` refs to `attachment:<sha256>.<ext>`.
 * Images are processed one at a time to keep memory bounded on large exports.
 */
export async function importDayOneImages(
  buffer: ArrayBuffer,
  entries: ImportedEntry[],
  supabase: SupabaseClient,
  ownerId: string,
  onProgress: (p: ImageImportProgress) => void,
): Promise<ImageImportResult> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(buffer)

  // Index: uppercase UUID → zip entry (handles photos/ at any folder depth)
  const photoMap = new Map<string, import('jszip').JSZipObject>()
  for (const [name, file] of Object.entries(zip.files)) {
    if (file.dir) continue
    const segs = name.split('/')
    const photosIdx = segs.findIndex((s) => s.toLowerCase() === 'photos')
    if (photosIdx === -1) continue
    const filename = segs[segs.length - 1] ?? ''
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

      const filename = photoFile.name.split('/').pop() ?? ''
      const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase() || 'jpg'

      try {
        const blob = await photoFile.async('blob')
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

// ── Diarly ───────────────────────────────────────────────────────────────────

// Matches Diarly inline image refs: `![alt](data/<hex-hash>.<ext>)`
const DIARLY_IMG_RE = /!\[([^\]]*)\]\(data\/([a-f0-9]+)\.([a-zA-Z0-9]+)\)/g

/**
 * Import photos from a Diarly Markdown export buffer.
 * Entries must already have been text-upserted. Rewrites `data/<hash>.<ext>`
 * refs to `attachment:<sha256>.<ext>`.
 */
export async function importDiarlyImages(
  buffer: ArrayBuffer,
  entries: ImportedEntry[],
  supabase: SupabaseClient,
  ownerId: string,
  onProgress: (p: ImageImportProgress) => void,
): Promise<ImageImportResult> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(buffer)

  // Lowercase path index for case-insensitive matching.
  const fileMap = new Map<string, import('jszip').JSZipObject>()
  for (const [name, file] of Object.entries(zip.files)) {
    if (!file.dir) fileMap.set(name.toLowerCase(), file)
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

    // Reconstruct the Data/ folder from external_id: "<Journal>/<Year>/<base>"
    // Zip path: "Export/<Journal>/<Year>/Data/<hash>.<ext>"
    const idParts = entry.external_id.split('/')
    const dataFolder = idParts.length >= 3
      ? `export/${idParts.slice(0, idParts.length - 1).join('/')}/data/`
      : 'data/'

    for (const [full, alt, hash, rawExt] of refs) {
      const ext = rawExt!.toLowerCase()
      const imgKey = `${dataFolder}${hash!}.${ext}`.toLowerCase()
      const photoFile = fileMap.get(imgKey)

      if (!photoFile) {
        missing++
        onProgress({ ...prog, done: ++prog.done })
        continue
      }

      try {
        const blob = await photoFile.async('blob')
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
