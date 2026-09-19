// Drop and paste image uploads in the editor — inserts block-isolated attachment refs.

import type { Extension } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
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

/**
 * The insertion bar shown while a photo or a file is being dragged in.
 *
 * **This is ours, deliberately.** It replaces CodeMirror's `dropCursor()`,
 * which draws on *any* `dragover` and is only ever taken down by a clean
 * `dragend` / `dragleave` / `drop`. Those are exactly the events a webview
 * declines to send for a drag it decided was not really a drag — and what was
 * left behind was a second, frozen, caret-looking bar sitting wherever an
 * accidental gesture began: the "two cursors, neither of them moves" report.
 *
 * Owning it means owning its lifetime, and the lifetime is the point. It is
 * shown only for the two drags this editor actually has (a file coming in, a
 * photo being moved), and it is taken down by whichever of five things happens
 * first — drop, dragend, the last dragleave, the next press, or a watchdog
 * that fires when `dragover` simply stops arriving. No single missing event
 * can strand it, which is the property the old one lacked.
 */
const DROP_IDLE_MS = 1200

class DropIndicator {
  private el: HTMLElement | null = null
  private watchdog = 0

  show(view: EditorView, pos: number): void {
    const coords = view.coordsAtPos(pos)
    if (!coords) return this.hide()

    if (!this.el) {
      this.el = document.createElement('div')
      this.el.className = 'cm-attachmentDropCursor'
      this.el.setAttribute('aria-hidden', 'true')
      view.scrollDOM.appendChild(this.el)
    }
    const host = view.scrollDOM.getBoundingClientRect()
    this.el.style.top = `${coords.top - host.top + view.scrollDOM.scrollTop}px`
    this.el.style.left = `${coords.left - host.left + view.scrollDOM.scrollLeft}px`
    this.el.style.height = `${Math.max(coords.bottom - coords.top, 4)}px`

    // Every frame of a drag refreshes this. If the frames stop without any of
    // the ending events arriving, the bar takes itself down.
    window.clearTimeout(this.watchdog)
    this.watchdog = window.setTimeout(() => this.hide(), DROP_IDLE_MS)
  }

  hide(): void {
    window.clearTimeout(this.watchdog)
    this.watchdog = 0
    this.el?.remove()
    this.el = null
  }
}

const dropCursorTheme = EditorView.theme({
  '.cm-attachmentDropCursor': {
    position: 'absolute',
    width: '2px',
    // Deliberately not the caret's colour. It is not a caret, and the whole
    // bug was that it read as one.
    backgroundColor: 'var(--accent)',
    opacity: '0.55',
    borderRadius: '1px',
    pointerEvents: 'none',
    zIndex: '4',
  },
})

export function attachmentDropExtension(): Extension {
  // Per-view, not per-module. As a module global this counter was shared by
  // every editor on the page (the journal and a ritual composer can both be
  // mounted), so one surface's drag left the other's tinted.
  let dragDepth = 0
  const indicator = new DropIndicator()

  /** The single way a drag ends, whichever event says so. */
  const endDrag = (view: EditorView) => {
    dragDepth = 0
    setDragOver(view, false)
    indicator.hide()
  }

  return [
    dropCursorTheme,
    EditorView.domEventHandlers({
      /*
       * **A photo is the only draggable thing in this editor.**
       *
       * Stated once, for every platform, rather than as an iOS exception: text
       * here is written and selected, not carried around. Browsers otherwise
       * let a press-and-drag on a selection start a native text drag, which is
       * precisely what a deliberate press to place the caret near the end of a
       * line looks like to a touch heuristic — and every one of those false
       * starts used to feed a drop cursor that had no reliable way to stop.
       *
       * Photo drag-to-reorder and file drag-to-insert are untouched:
       * attachmentImageExtension marks the photo block itself draggable, and
       * a file dragged in from outside never fires `dragstart` here at all.
       */
      dragstart(event) {
        const target = event.target as HTMLElement | null
        if (target?.closest('.cm-attachment--interactive')) return false
        event.preventDefault()
        return true
      },

      /*
       * The counter exists because `dragenter`/`dragleave` pair up on every
       * descendant the pointer crosses, not just on the editor itself: moving
       * a photo from one line to the next emits a leave for the line being
       * left. Counting keeps the drag alive across those, and only the leave
       * that returns the depth to zero is the one that left the editor.
       *
       * It must therefore count **both** kinds of drag. Counting only file
       * drags here while `dragleave` decremented for all of them was an
       * asymmetry: dragging a photo between lines drove the depth to zero
       * mid-move, taking the insertion bar down and putting it back up on the
       * next frame.
       */
      dragenter(event, view) {
        const dt = event.dataTransfer
        if (!dt) return false
        if (!isFileDrag(dt) && !isInternalAttachmentDrag(dt)) return false
        dragDepth++
        // Only a file coming from outside tints the surface; a photo being
        // moved is already inside it.
        if (isFileDrag(dt)) setDragOver(view, true)
        return false
      },

      dragover(event, view) {
        const dt = event.dataTransfer
        if (!dt) return false
        const internal = isInternalAttachmentDrag(dt)
        // An internal photo move doesn't tint the whole editor (it is already
        // inside) — only files do. Both get the insertion bar.
        if (!internal && !isFileDrag(dt)) return false

        event.preventDefault()
        dt.dropEffect = internal ? 'move' : 'copy'
        if (!internal) setDragOver(view, true)
        indicator.show(view, dropPos(view, event))
        return !internal
      },

      dragleave(_event, view) {
        dragDepth = Math.max(0, dragDepth - 1)
        if (dragDepth === 0) endDrag(view)
        return false
      },

      // Fires on the source when any drag finishes, cancelled or not — the
      // backstop for a drag that leaves the window and never comes back.
      dragend(_event, view) {
        endDrag(view)
        return false
      },

      // Nothing can be mid-drag while a finger or a mouse is coming down, so
      // a bar still on screen at this moment is by definition a stranded one.
      pointerdown() {
        indicator.hide()
        return false
      },

      drop(event, view) {
        endDrag(view)
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
    }),
    // The view going away is also the end of any drag over it.
    ViewPlugin.define(() => ({ destroy: () => indicator.hide() })),
  ]
}
