import { useRef, useState } from 'react'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import { uploadImageAttachment } from '@/lib/attachments'
import { altFromFile, takenAtFromFile } from '@/lib/attachmentCaption'
import { supabase } from '@/lib/supabase'
import { CommandPopover, CommandPopoverHint } from './CommandPopover'
import { IMAGE_DROP_HINT } from './commandHints'
import { IMAGE_MAX_BYTES, imageFilesFromDataTransfer, isImageFile } from '@/editor/attachmentInsert'
import './Capture.css'

interface Props {
  anchor: InlinePanelAnchor
  onBeginUpload: (pendingId: string, alt: string) => void
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

  async function handleFile(file: File) {
    if (busyRef.current) return
    if (!isImageFile(file)) {
      setPhase('error')
      setError('Choose a photo (JPEG, PNG, GIF, or WebP)')
      return
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setPhase('error')
      setError('Photo must be under 20 MB')
      return
    }
    if (!supabase) {
      setPhase('error')
      setError('Photos require a connected account')
      return
    }

    const pendingId = crypto.randomUUID()
    const alt = altFromFile(file)
    const takenAt = takenAtFromFile(file)

    busyRef.current = true
    setPhase('uploading')
    setError(null)
    onBeginUpload(pendingId, alt)
    onClose()

    try {
      const { hash, ext } = await uploadImageAttachment(
        supabase,
        file,
        takenAt ? { takenAt } : undefined,
      )
      onUploadComplete(pendingId, hash, ext, alt)
    } catch (e) {
      onUploadFailed(pendingId)
      // Popover may already be closed — error surfaces on next open only if we
      // kept it open; for now the pending block is simply removed.
      console.warn('[image upload]', e)
    } finally {
      busyRef.current = false
    }
  }

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
        className="command-popover__file-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleFile(file)
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
          const file = imageFilesFromDataTransfer(e.dataTransfer)[0]
          if (file) void handleFile(file)
        }}
      >
        <span className="command-popover__dropzone-icon" aria-hidden="true">
          {phase === 'uploading' ? '…' : '↓'}
        </span>
        <span className="command-popover__dropzone-text">
          {phase === 'uploading' ? 'Uploading…' : 'Drop a photo here, or tap to choose'}
        </span>
      </button>
      {error && <p className="command-popover__error">{error}</p>}
    </CommandPopover>
  )
}
