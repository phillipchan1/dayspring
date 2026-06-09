import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { AttachmentEditTarget } from '@/editor/attachmentInsert'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import {
  resolveCachedAttachmentMeta,
  resolveCachedAttachmentPreview,
} from '@/editor/attachmentImageExtension'
import { formatPhotoMetaLine, isMeaningfulCaption } from '@/lib/attachmentCaption'
import { CommandPopover, CommandPopoverHint } from './CommandPopover'
import { IMAGE_EDIT_HINT } from './commandHints'
import './Capture.css'

interface Props {
  target: AttachmentEditTarget
  anchor: InlinePanelAnchor
  onSaveCaption: (alt: string) => void
  onClose: () => void
}

/**
 * Caption editor for a photo. Replace and Remove live in the photo options menu
 * (ImageContextMenu); this popover is just the caption field + a preview.
 */
export function InlineImageEditPopover({ target, anchor, onSaveCaption, onClose }: Props) {
  const [caption, setCaption] = useState(() =>
    isMeaningfulCaption(target.alt) ? target.alt : '',
  )
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [metaLine, setMetaLine] = useState<string | null>(null)
  const committedRef = useRef(false)

  // Sit just below the photo's bottom edge and track it on scroll — a fixed
  // popover otherwise floats with the viewport and detaches from the image.
  // Clamped to the viewport so a tall photo's off-screen bottom still keeps the
  // editor on screen; closes once the photo has scrolled above the top (or its
  // widget is recycled by CodeMirror on a far scroll).
  const [trackedTop, setTrackedTop] = useState(anchor.top)
  useLayoutEffect(() => {
    const key = `${target.hash}.${target.ext}`
    const find = () =>
      document.querySelector<HTMLElement>(`.cm-attachment[data-attachment-key="${key}"]`)

    let raf = 0
    const reposition = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = find()
        const rect = el?.getBoundingClientRect()
        if (!rect || rect.bottom < 8) {
          onClose()
          return
        }
        const GAP = 6
        const PAD = 12
        const panelH = document.querySelector('.command-popover')?.getBoundingClientRect().height ?? 320
        const maxTop = window.innerHeight - panelH - PAD
        setTrackedTop(Math.max(PAD, Math.min(rect.bottom + GAP, maxTop)))
      })
    }
    reposition()
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
    // target identifies this photo; anchor is the open-time fallback only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.hash, target.ext])

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

  return (
    <CommandPopover
      anchor={{ ...anchor, top: trackedTop }}
      onDismiss={onClose}
      ariaLabel="Edit caption"
      variant="image"
      skipViewportClamp
      footer={<CommandPopoverHint>{IMAGE_EDIT_HINT}</CommandPopoverHint>}
    >
      <p className="command-popover__label">edit caption</p>
      {previewUrl && (
        <div className="command-popover__image-preview">
          <img src={previewUrl} alt={caption || 'Photo preview'} />
        </div>
      )}
      {metaLine && <p className="command-popover__photo-meta">{metaLine}</p>}
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
    </CommandPopover>
  )
}
