import { useEffect, useRef, useState } from 'react'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import { hasNativeCapture, pickPhotosNatively } from '@/lib/nativeCapture'
import { attachmentOwnerId, extFromImageFile } from '@/lib/attachments'
import { uploadOrQueue } from '@/lib/attachmentQueue'
import { beginArrivals } from '@/lib/photoArrival'
import { altFromFile, takenAtFromFile } from '@/lib/attachmentCaption'
import { isWorkersBackend } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { CommandPopover, CommandPopoverHint } from './CommandPopover'
import { IMAGE_DROP_HINT } from './commandHints'
import { IMAGE_MAX_BYTES, imageFilesFromDataTransfer, isImageFile } from '@/editor/attachmentInsert'
import './Capture.css'

interface Props {
  anchor: InlinePanelAnchor
  /** Called once with every photo chosen, in order — several land as one set. */
  onBeginUpload: (items: Array<{ pendingId: string; alt: string }>) => void
  onUploadComplete: (pendingId: string, hash: string, ext: string, alt: string) => void
  onUploadFailed: (pendingId: string) => void
  onClose: () => void
}

type Phase = 'idle' | 'uploading' | 'error'

export function InlineImagePopover({
  anchor,
  onBeginUpload,
  onUploadComplete,
  onUploadFailed,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)
  // iOS app: straight to the system photo picker, without the popover's
  // dropzone and WebKit's "Photo Library / Take Photo / Choose File" sheet in
  // between. The popover only appears if the picker can't open (then it is
  // the fallback) or if the chosen photos can't go in (then it says why).
  const [picking, setPicking] = useState(hasNativeCapture)

  async function handleFiles(chosen: File[]) {
    if (busyRef.current || chosen.length === 0) return
    // Anything that cannot be a photo is left out; the rest still go in. Only
    // when nothing is left is there something to say.
    const files = chosen.filter((file) => isImageFile(file) && file.size <= IMAGE_MAX_BYTES)
    if (files.length === 0) {
      setPhase('error')
      setError(
        chosen.some((file) => !isImageFile(file))
          ? 'Choose a photo (JPEG, PNG, GIF, or WebP)'
          : 'Photo must be under 20 MB',
      )
      return
    }
    if (!supabase && !isWorkersBackend) {
      setPhase('error')
      setError('Photos require a connected account')
      return
    }

    const pending = files.map((file) => ({
      pendingId: crypto.randomUUID(),
      alt: altFromFile(file),
      file,
    }))

    busyRef.current = true
    setPhase('uploading')
    setError(null)
    beginArrivals(pending.map(({ pendingId, file }) => ({ id: pendingId, file })))
    onBeginUpload(pending.map(({ pendingId, alt }) => ({ pendingId, alt })))
    onClose()

    try {
      const ownerId = await attachmentOwnerId(supabase)
      // One at a time, in the order chosen: each tile fills in as its own upload
      // lands, and one that fails takes only itself out of the set.
      for (const { pendingId, alt, file } of pending) {
        try {
          if (!ownerId) throw new Error('Sign in to add photos')
          const takenAt = takenAtFromFile(file)
          const ref = await uploadOrQueue(
            pendingId,
            ownerId,
            file,
            extFromImageFile(file),
            alt,
            takenAt ? { takenAt } : undefined,
          )
          // null → no network; the photo is parked in IndexedDB and the pending
          // block stays put until it uploads. Removing it here is what used to
          // make a photo added on a bad connection silently disappear.
          if (ref) onUploadComplete(pendingId, ref.hash, ref.ext, alt)
        } catch (e) {
          // Only for a file storage will never accept.
          onUploadFailed(pendingId)
          console.warn('[image upload] rejected', e)
        }
      }
    } finally {
      busyRef.current = false
    }
  }

  useEffect(() => {
    if (!hasNativeCapture()) return
    let live = true
    void pickPhotosNatively().then((files) => {
      if (!live) return
      if (files === null) {
        setPicking(false) // no native picker here: the popover is the way in
        return
      }
      if (files.length === 0) {
        onClose() // cancelled in the picker
        return
      }
      // handleFiles closes the popover once the uploads are under way; if the
      // photos can't go in, the popover appears with the reason.
      setPicking(false)
      void handleFiles(files)
    })
    return () => {
      live = false
    }
    // Once, on open: on iOS the picker is the popover.
  }, [])

  if (picking) return null

  return (
    <CommandPopover
      anchor={anchor}
      onDismiss={onClose}
      ariaLabel="Add a photo"
      variant="image"
      footer={<CommandPopoverHint>{IMAGE_DROP_HINT}</CommandPopoverHint>}
    >
      <p className="command-popover__label">a photo</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="command-popover__file-input"
        onChange={(e) => {
          void handleFiles([...(e.target.files ?? [])])
        }}
      />
      <button
        type="button"
        className={`command-popover__dropzone${dragging ? ' command-popover__dropzone--active' : ''}${phase === 'uploading' ? ' command-popover__dropzone--busy' : ''}`}
        disabled={phase === 'uploading'}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (phase !== 'uploading') setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (phase === 'uploading') return
          // Use shared helper — handles dt.items (iOS) and dt.files (desktop)
          void handleFiles(imageFilesFromDataTransfer(e.dataTransfer))
        }}
      >
        <span className="command-popover__dropzone-icon" aria-hidden="true">
          {phase === 'uploading' ? '…' : '↓'}
        </span>
        <span className="command-popover__dropzone-text">
          {phase === 'uploading' ? 'Uploading…' : 'Drop photos here, or tap to choose'}
        </span>
      </button>
      {error && <p className="command-popover__error">{error}</p>}
    </CommandPopover>
  )
}
