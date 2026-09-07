// Drop and paste image uploads in the editor — inserts block-isolated attachment refs.

import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { altFromFile, takenAtFromFile } from '@/lib/attachmentCaption'
import { extFromImageFile } from '@/lib/attachments'
import { uploadOrQueue } from '@/lib/attachmentQueue'
import { supabase } from '@/lib/supabase'
import {
  ATTACHMENT_DND_MIME,
  IMAGE_MAX_BYTES,
  imageFilesFromClipboard,
  imageFilesFromDataTransfer,
  insertBlockPendingAttachmentsAt,
  isImageFile,
  moveAttachmentRef,
  removePendingAttachmentInView,
  replacePendingAttachmentInView,
} from './attachmentInsert'

const DRAG_CLASS = 'editor-host--drag-over'
let dragDepth = 0

// `dt.types` is a DOMStringList on older Safari/iOS (no .includes()), so coerce it.
function dtTypes(dt: DataTransfer): string[] {
  return Array.from(dt.types)
}

function isImageMimeOrUti(type: string): boolean {
  const t = type.toLowerCase()
  if (t.startsWith('image/')) return true
  // iOS drag from Photos uses UTI strings like 'public.jpeg'
  return /^public\.(heic|heif|jpe?g|png|gif|tiff?|webp)$/.test(t)
}

function isFileDrag(dt: DataTransfer): boolean {
  const types = dtTypes(dt)
  // Desktop: standard 'Files' entry is always present for file drags
  if (types.includes('Files')) return true
  // iOS/iPadOS: Photos sends UTI/MIME types instead of 'Files'
  return types.some(isImageMimeOrUti)
}

// A photo block being dragged within the editor (set on dragstart).
function isInternalAttachmentDrag(dt: DataTransfer): boolean {
  return dtTypes(dt).includes(ATTACHMENT_DND_MIME)
}

function dragHost(view: EditorView): HTMLElement | null {
  return view.dom.closest('.editor-host')
}

function setDragOver(view: EditorView, active: boolean): void {
  dragHost(view)?.classList.toggle(DRAG_CLASS, active)
}

function photoMetaFromFile(file: File) {
  const takenAt = takenAtFromFile(file)
  return takenAt ? { takenAt } : undefined
}

function viewAlive(view: EditorView): boolean {
  return !(view as unknown as { isDestroyed?: boolean }).isDestroyed
}

async function uploadFiles(
  view: EditorView,
  pos: number,
  files: File[],
): Promise<void> {
  if (files.length === 0) return
  if (!supabase) {
    console.warn('[images] drop ignored — supabase not configured')
    return
  }

  const valid = files.filter((f) => isImageFile(f) && f.size <= IMAGE_MAX_BYTES)
  if (valid.length === 0) return

  const pending = valid.map((file) => ({
    id: crypto.randomUUID(),
    alt: altFromFile(file),
    file,
  }))

  insertBlockPendingAttachmentsAt(
    view,
    pos,
    pending.map((p) => ({ id: p.id, alt: p.alt })),
  )

  const ownerId = (await supabase.auth.getUser()).data.user?.id
  if (!ownerId) return

  for (const item of pending) {
    try {
      const ref = await uploadOrQueue(
        item.id,
        ownerId,
        item.file,
        extFromImageFile(item.file),
        item.alt,
        photoMetaFromFile(item.file),
      )
      if (!viewAlive(view)) return
      // null → queued offline. LEAVE the placeholder: it already renders as a
      // pending photo and resolves itself on reconnect. Deleting it here is what
      // used to make photos vanish on a bad connection.
      if (ref) replacePendingAttachmentInView(view, item.id, ref.hash, ref.ext, item.alt)
    } catch (e) {
      // Only reached when the file will never be accepted, so the placeholder is
      // a promise we can't keep.
      console.warn('[images] drop upload rejected', e)
      if (viewAlive(view)) removePendingAttachmentInView(view, item.id)
    }
  }
}

function dropPos(view: EditorView, event: DragEvent): number {
  const coords = view.posAtCoords({ x: event.clientX, y: event.clientY })
  return coords ?? view.state.selection.main.head
}

export function attachmentDropExtension(): Extension {
  return EditorView.domEventHandlers({
    dragenter(event, view) {
      const dt = event.dataTransfer
      if (!dt || !isFileDrag(dt)) return false
      dragDepth++
      setDragOver(view, true)
      return false
    },
    dragover(event, view) {
      const dt = event.dataTransfer
      if (!dt) return false
      // Allow the drop and let dropCursor track the line. An internal photo move
      // doesn't tint the whole editor (it's already inside) — only files do.
      if (isInternalAttachmentDrag(dt)) {
        event.preventDefault()
        dt.dropEffect = 'move'
        return false
      }
      if (!isFileDrag(dt)) return false
      event.preventDefault()
      dt.dropEffect = 'copy'
      setDragOver(view, true)
      return true
    },
    dragleave(_event, view) {
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) setDragOver(view, false)
      return false
    },
    drop(event, view) {
      dragDepth = 0
      setDragOver(view, false)
      const dt = event.dataTransfer
      if (!dt) return false

      // Internal photo reorder: move the ref to the dropped line instead of
      // uploading anything.
      const movedKey = dt.getData(ATTACHMENT_DND_MIME)
      if (movedKey) {
        event.preventDefault()
        moveAttachmentRef(view, movedKey, dropPos(view, event))
        return true
      }

      const files = imageFilesFromDataTransfer(dt)
      if (!files.length) {
        console.warn('[images] drop fired but no image files found in transfer; types:', dtTypes(dt))
        return false
      }
      event.preventDefault()
      const pos = dropPos(view, event)
      void uploadFiles(view, pos, files)
      return true
    },
    paste(event, view) {
      const dt = event.clipboardData
      if (!dt) return false
      const files = imageFilesFromClipboard(dt)
      if (!files.length) return false
      event.preventDefault()
      const pos = view.state.selection.main.head
      void uploadFiles(view, pos, files)
      return true
    },
  })
}
