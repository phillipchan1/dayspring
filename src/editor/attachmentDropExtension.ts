// Drop and paste image uploads in the editor — inserts block-isolated attachment refs.

import type { Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { altFromFile, takenAtFromFile } from '@/lib/attachmentCaption'
import { uploadImageAttachment } from '@/lib/attachments'
import { supabase } from '@/lib/supabase'
import {
  IMAGE_MAX_BYTES,
  imageFilesFromClipboard,
  imageFilesFromDataTransfer,
  insertBlockPendingAttachmentsAt,
  isImageFile,
  removePendingAttachmentInView,
  replacePendingAttachmentInView,
} from './attachmentInsert'

const DRAG_CLASS = 'editor-host--drag-over'
let dragDepth = 0

function isFileDrag(dt: DataTransfer): boolean {
  return dt.types.includes('Files') || imageFilesFromDataTransfer(dt).length > 0
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
  if (files.length === 0 || !supabase) return

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

  for (const item of pending) {
    try {
      const { hash, ext } = await uploadImageAttachment(supabase, item.file, photoMetaFromFile(item.file))
      if (!viewAlive(view)) return
      replacePendingAttachmentInView(view, item.id, hash, ext, item.alt)
    } catch {
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
      if (!dt || !isFileDrag(dt)) return false
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
      const files = imageFilesFromDataTransfer(dt)
      if (!files.length) return false
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
