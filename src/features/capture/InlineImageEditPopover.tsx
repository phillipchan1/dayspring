import { useEffect, useRef, useState } from 'react'
import type { AttachmentEditTarget } from '@/editor/attachmentInsert'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import {
  resolveCachedAttachmentMeta,
  resolveCachedAttachmentPreview,
} from '@/editor/attachmentImageExtension'
import { uploadImageAttachment } from '@/lib/attachments'
import { supabase } from '@/lib/supabase'
import { IMAGE_MAX_BYTES, isImageFile } from '@/editor/attachmentInsert'
import {
  altFromFile,
  formatPhotoMetaLine,
  isMeaningfulCaption,
  takenAtFromFile,
} from '@/lib/attachmentCaption'
import { CommandPopover, CommandPopoverFooter } from './CommandPopover'
import { IMAGE_EDIT_HINT } from './commandHints'
import './Capture.css'

interface Props {
  target: AttachmentEditTarget
  anchor: InlinePanelAnchor
  onSaveCaption: (alt: string) => void
  onReplaceBegin: (pendingId: string, alt: string, from: number, to: number) => void
  onReplaceComplete: (pendingId: string, hash: string, ext: string, alt: string) => void
  onReplaceFailed: (pendingId: string) => void
  onRemove: () => void
  onClose: () => void
}

export function InlineImageEditPopover({
  target,
  anchor,
  onSaveCaption,
  onReplaceBegin,
  onReplaceComplete,
  onReplaceFailed,
  onRemove,
  onClose,
}: Props) {
  const [caption, setCaption] = useState(() =>
    isMeaningfulCaption(target.alt) ? target.alt : '',
  )
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [metaLine, setMetaLine] = useState<string | null>(null)
  const [replacing, setReplacing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const committedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    void resolveCachedAttachmentPreview(target.hash, target.ext).then((url) => {
      if (!cancelled && url) setPreviewUrl(url)
    })
    void resolveCachedAttachmentMeta(target.hash).then((meta) => {
      if (!cancelled) setMetaLine(formatPhotoMetaLine(meta ?? undefined))
    })
    return () => {
      cancelled = true
    }
  }, [target.hash, target.ext])

  function handleSave() {
    if (committedRef.current) return
    committedRef.current = true
    onSaveCaption(caption.trim())
  }

  async function handleReplaceFile(file: File) {
    if (replacing || !isImageFile(file) || file.size > IMAGE_MAX_BYTES || !supabase) return
    const pendingId = crypto.randomUUID()
    const alt = altFromFile(file) || caption.trim()
    const meta = takenAtFromFile(file)
    setReplacing(true)
    onReplaceBegin(pendingId, alt, target.from, target.to)
    onClose()
    try {
      const { hash, ext } = await uploadImageAttachment(
        supabase,
        file,
        meta ? { takenAt: meta } : undefined,
      )
      onReplaceComplete(pendingId, hash, ext, alt)
    } catch {
      onReplaceFailed(pendingId)
    }
  }

  return (
    <CommandPopover
      anchor={anchor}
      onDismiss={onClose}
      ariaLabel="Edit photo"
      variant="image"
      footer={
        <CommandPopoverFooter hint={IMAGE_EDIT_HINT} onRemove={onRemove} />
      }
    >
      <p className="command-popover__label">edit photo</p>
      {previewUrl && (
        <div className="command-popover__image-preview">
          <img src={previewUrl} alt={caption || 'Photo preview'} />
        </div>
      )}
      {metaLine && (
        <p className="command-popover__photo-meta">{metaLine}</p>
      )}
      <label className="command-popover__field-label" htmlFor="image-caption">
        caption
      </label>
      <input
        id="image-caption"
        className="command-popover__caption-input"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleSave()
          }
        }}
        placeholder="What is this a photo of?"
        autoFocus
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="command-popover__file-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleReplaceFile(file)
        }}
      />
      <button
        type="button"
        className="command-popover__menu-link"
        disabled={replacing}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
      >
        Replace photo
      </button>
    </CommandPopover>
  )
}
