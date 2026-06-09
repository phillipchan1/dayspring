import { ChangeSet, EditorState, type ChangeSpec, type Extension, type Transaction } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import {
  ATTACHMENT_REF_RE,
  formatAttachmentMarkdown,
  formatPendingAttachmentMarkdown,
  PENDING_ATTACHMENT_REF_RE,
} from '@/lib/attachments'

export interface AttachmentEditTarget {
  hash: string
  ext: string
  alt: string
  from: number
  to: number
}

/** Resolve the attachment ref under `pos`, if any. */
export function findAttachmentAtPos(doc: string, pos: number): AttachmentEditTarget | null {
  ATTACHMENT_REF_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTACHMENT_REF_RE.exec(doc)) !== null) {
    const from = m.index
    const to = from + m[0]!.length
    if (pos >= from && pos < to) {
      return { hash: m[2]!, ext: m[3]!, alt: m[1] ?? '', from, to }
    }
  }
  return null
}

/**
 * Resolve the first attachment ref matching `<hash>.<ext>`. A click-coordinate
 * fallback for when posAtCoords lands outside the ref range (e.g. a photo
 * rendered tight against another block widget).
 */
export function findAttachmentByKey(doc: string, key: string): AttachmentEditTarget | null {
  ATTACHMENT_REF_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTACHMENT_REF_RE.exec(doc)) !== null) {
    if (`${m[2]}.${m[3]}` === key) {
      return { hash: m[2]!, ext: m[3]!, alt: m[1] ?? '', from: m.index, to: m.index + m[0]!.length }
    }
  }
  return null
}

/**
 * Private DataTransfer type set when dragging a photo block inside the editor.
 * Lets the drop handler tell an internal reorder apart from a file-drag-in.
 */
export const ATTACHMENT_DND_MIME = 'application/x-dayspring-attachment'

/**
 * Plan the change to move an existing photo ref (identified by `<hash>.<ext>`)
 * to `toPos`: delete the source range and re-insert the block-isolated markdown
 * at the target. Returns null (no-op) when the ref isn't found or the target
 * lands inside the source range. Both ranges reference the original doc; CM
 * applies them in order, and the insert's surrounding-newline decision is
 * computed from the original text (the deletion is outside `toPos`).
 */
export function planAttachmentMove(
  doc: string,
  key: string,
  toPos: number,
): ChangeSpec[] | null {
  const target = findAttachmentByKey(doc, key)
  if (!target) return null
  const { from, to, hash, ext, alt } = target

  // Swallow the blank-line separator the isolated block leaves behind (trailing
  // first, else leading at EOF) so repeated reorders don't pile up empty lines.
  let delFrom = from
  let delTo = to
  let consumed = 0
  while (delTo < doc.length && doc[delTo] === '\n' && consumed < 2) {
    delTo++
    consumed++
  }
  if (consumed === 0) {
    while (delFrom > 0 && doc[delFrom - 1] === '\n' && consumed < 2) {
      delFrom--
      consumed++
    }
  }

  if (toPos >= delFrom && toPos <= delTo) return null

  const md = formatAttachmentMarkdown(hash, ext, alt)
  const before = doc.slice(0, toPos)
  const after = doc.slice(toPos)
  const insert = wrapBlockAttachmentInsert(toPos, doc.length, before, after, md)

  return [
    { from: delFrom, to: delTo, insert: '' },
    { from: toPos, to: toPos, insert },
  ]
}

/**
 * Move a photo ref to `toPos` in one transaction. `attachmentBlockNormalizeExtension`
 * tidies the surrounding blank lines afterward.
 */
export function moveAttachmentRef(view: EditorView, key: string, toPos: number): void {
  const changes = planAttachmentMove(view.state.doc.toString(), key, toPos)
  if (!changes) return
  view.dispatch({ changes })
  view.focus()
}

export function replaceAttachmentRefInView(
  view: EditorView,
  from: number,
  to: number,
  hash: string,
  ext: string,
  alt: string,
): void {
  view.dispatch({
    changes: { from, to, insert: formatAttachmentMarkdown(hash, ext, alt) },
  })
}

export function removeAttachmentInView(view: EditorView, from: number, to: number): void {
  view.dispatch({ changes: { from, to, insert: '' } })
}

export function replaceWithPendingInView(
  view: EditorView,
  from: number,
  to: number,
  pendingId: string,
  alt: string,
): void {
  view.dispatch({
    changes: { from, to, insert: formatPendingAttachmentMarkdown(pendingId, alt) },
  })
}

const ATTACHMENT_LINE_RE =
  /^\s*!\[[^\]]*\]\((?:attachment:[a-f0-9]{64}\.[a-z0-9]+|attachment-pending:[a-f0-9-]{36})\)\s*$/

/** Wrap an attachment markdown line with newlines so it sits on its own block. */
export function wrapBlockAttachmentInsert(
  pos: number,
  docLen: number,
  before: string,
  after: string,
  markdown: string,
): string {
  let prefix = ''
  let suffix = ''

  if (pos > 0) {
    if (before.endsWith('\n\n')) prefix = ''
    else if (before.endsWith('\n')) prefix = '\n'
    else prefix = '\n\n'
  }

  if (pos < docLen) {
    if (after.startsWith('\n\n')) suffix = ''
    else if (after.startsWith('\n')) suffix = '\n'
    else suffix = '\n\n'
  } else {
    suffix = '\n'
  }

  return `${prefix}${markdown}${suffix}`
}

/** Insert a block-level attachment ref at `pos` and return the caret position after. */
export function insertBlockAttachmentAt(
  view: EditorView,
  pos: number,
  hash: string,
  ext: string,
  alt = '',
): number {
  const md = formatAttachmentMarkdown(hash, ext, alt)
  const doc = view.state.doc.toString()
  const clamped = Math.max(0, Math.min(pos, doc.length))
  const before = doc.slice(0, clamped)
  const after = doc.slice(clamped)
  const insert = wrapBlockAttachmentInsert(clamped, doc.length, before, after, md)
  view.dispatch({
    changes: { from: clamped, to: clamped, insert },
    selection: { anchor: clamped + insert.length, head: clamped + insert.length },
  })
  view.focus()
  return clamped + insert.length
}

/**
 * Break attachment refs onto their own lines when they share a line with prose.
 * Returns replacement text, or null when no change is needed.
 */
export function splitInlineAttachments(doc: string): string | null {
  ATTACHMENT_REF_RE.lastIndex = 0
  if (!ATTACHMENT_REF_RE.test(doc)) return null

  const lines = doc.split('\n')
  const out: string[] = []
  let changed = false

  for (const line of lines) {
    ATTACHMENT_REF_RE.lastIndex = 0
    const refs = [...line.matchAll(ATTACHMENT_REF_RE)]
    if (refs.length === 0) {
      out.push(line)
      continue
    }

    let remainder = line
    for (const ref of refs) {
      remainder = remainder.replace(ref[0], '')
    }

    if (remainder.trim() === '') {
      out.push(line)
      continue
    }

    changed = true
    const before = line.slice(0, refs[0]!.index!).trimEnd()
    if (before) out.push(before)

    for (const ref of refs) {
      if (out.length > 0 && out[out.length - 1] !== '') out.push('')
      out.push(ref[0]!)
    }

    const last = refs[refs.length - 1]!
    const after = line.slice(last.index! + last[0].length).trimStart()
    if (after) {
      out.push('')
      out.push(after)
    }
  }

  if (!changed) return null
  return out.join('\n')
}

/** Ensure blank lines surround lines that contain only an attachment ref. */
export function padIsolatedAttachmentLines(doc: string): string | null {
  const lines = doc.split('\n')
  const out: string[] = []
  let changed = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (!ATTACHMENT_LINE_RE.test(line)) {
      out.push(line)
      continue
    }

    const prev = out[out.length - 1]
    const next = lines[i + 1]
    if (prev !== undefined && prev !== '' && out.length > 0) {
      changed = true
      out.push('')
    }
    out.push(line)
    if (next !== undefined && next !== '' && i + 1 < lines.length) {
      changed = true
      out.push('')
    }
  }

  if (!changed) return null
  return out.join('\n')
}

export function normalizeAttachmentBlocks(doc: string): string | null {
  const split = splitInlineAttachments(doc)
  const base = split ?? doc
  const padded = padIsolatedAttachmentLines(base)
  const result = padded ?? split
  return result === doc ? null : result
}

function transactionInsertsAttachment(tr: Transaction): boolean {
  let found = false
  tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
    ATTACHMENT_REF_RE.lastIndex = 0
    if (ATTACHMENT_REF_RE.test(inserted.toString())) found = true
  })
  return found
}

/** Transaction filter — keeps attachment refs block-isolated after paste/import. */
export function attachmentBlockNormalizeExtension(): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged || !transactionInsertsAttachment(tr)) return tr
    const doc = tr.newDoc.toString()
    const normalized = normalizeAttachmentBlocks(doc)
    if (!normalized || normalized === doc) return tr

    // Compose normalization onto tr's changes so we return a single changeset.
    // [tr, { changes }] crashes because CM expects the second spec's positions
    // relative to the original doc, but ours reference tr.newDoc.
    const normCS = ChangeSet.of([{ from: 0, to: doc.length, insert: normalized }], doc.length)
    const baseSel = tr.selection ?? tr.startState.selection.map(tr.changes)
    return {
      changes: tr.changes.compose(normCS),
      selection: baseSel.map(normCS),
      effects: tr.effects,
      scrollIntoView: tr.scrollIntoView,
    }
  })
}

export const IMAGE_MAX_BYTES = 20 * 1024 * 1024

function isImageMime(type: string): boolean {
  const t = type.toLowerCase()
  if (!t) return false
  if (t.startsWith('image/')) return true
  return /^public\.(heic|heif|jpeg|jpg|png|gif|tif|tiff|webp)/.test(t)
}

export function isImageFile(file: File): boolean {
  if (isImageMime(file.type)) return true
  return /\.(jpe?g|png|gif|webp|heic|heif|tif|tiff)$/i.test(file.name)
}

function isImageTransfer(itemType: string, file: File): boolean {
  return isImageMime(itemType) || isImageMime(file.type) || isImageFile(file)
}

export function imageFilesFromDataTransfer(dt: DataTransfer): File[] {
  const files: File[] = []
  const seen = new Set<File>()

  if (dt.items?.length) {
    for (const item of dt.items) {
      if (item.kind !== 'file') continue
      const f = item.getAsFile()
      if (f && isImageTransfer(item.type, f) && !seen.has(f)) {
        seen.add(f)
        files.push(f)
      }
    }
  }

  if (dt.files?.length) {
    for (const f of dt.files) {
      if (isImageFile(f) && !seen.has(f)) {
        seen.add(f)
        files.push(f)
      }
    }
  }

  return files
}

export function imageFilesFromClipboard(dt: DataTransfer): File[] {
  const files: File[] = []
  const seen = new Set<File>()
  for (const item of dt.items) {
    if (item.kind !== 'file') continue
    const f = item.getAsFile()
    if (f && isImageTransfer(item.type, f) && !seen.has(f)) {
      seen.add(f)
      files.push(f)
    }
  }
  return files
}

/** Insert multiple uploaded images at one position (single atomic change). */
export function insertBlockAttachmentsAt(
  view: EditorView,
  pos: number,
  items: Array<{ hash: string; ext: string; alt: string }>,
): number {
  if (items.length === 0) return pos

  const clamped = Math.max(0, Math.min(pos, view.state.doc.length))
  const doc = view.state.doc.toString()
  const before = doc.slice(0, clamped)
  const after = doc.slice(clamped)
  const combinedMd = items
    .map(({ hash, ext, alt }) => formatAttachmentMarkdown(hash, ext, alt))
    .join('\n\n')
  const insert = wrapBlockAttachmentInsert(clamped, doc.length, before, after, combinedMd)

  view.dispatch({
    changes: { from: clamped, to: clamped, insert },
    selection: { anchor: clamped + insert.length, head: clamped + insert.length },
  })
  view.focus()
  return clamped + insert.length
}

/** Insert pending placeholders immediately — shows uploading state in the editor. */
export function insertBlockPendingAttachmentsAt(
  view: EditorView,
  pos: number,
  items: Array<{ id: string; alt: string }>,
): number {
  if (items.length === 0) return pos

  const clamped = Math.max(0, Math.min(pos, view.state.doc.length))
  const doc = view.state.doc.toString()
  const before = doc.slice(0, clamped)
  const after = doc.slice(clamped)
  const combinedMd = items
    .map(({ id, alt }) => formatPendingAttachmentMarkdown(id, alt))
    .join('\n\n')
  const insert = wrapBlockAttachmentInsert(clamped, doc.length, before, after, combinedMd)

  view.dispatch({
    changes: { from: clamped, to: clamped, insert },
    selection: { anchor: clamped + insert.length, head: clamped + insert.length },
  })
  view.focus()
  return clamped + insert.length
}

export function findPendingAttachmentRange(
  doc: string,
  pendingId: string,
): { from: number; to: number; alt: string } | null {
  PENDING_ATTACHMENT_REF_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PENDING_ATTACHMENT_REF_RE.exec(doc)) !== null) {
    if (m[2] === pendingId) {
      return { from: m.index, to: m.index + m[0]!.length, alt: m[1] ?? '' }
    }
  }
  return null
}

export function replacePendingAttachmentInView(
  view: EditorView,
  pendingId: string,
  hash: string,
  ext: string,
  alt: string,
): void {
  const doc = view.state.doc.toString()
  const range = findPendingAttachmentRange(doc, pendingId)
  if (!range) return
  const finalMd = formatAttachmentMarkdown(hash, ext, alt || range.alt)
  view.dispatch({ changes: { from: range.from, to: range.to, insert: finalMd } })
}

export function removePendingAttachmentInView(view: EditorView, pendingId: string): void {
  const doc = view.state.doc.toString()
  const range = findPendingAttachmentRange(doc, pendingId)
  if (!range) return
  view.dispatch({ changes: { from: range.from, to: range.to, insert: '' } })
}
