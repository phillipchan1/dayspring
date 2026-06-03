import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface LinkPopoverTarget {
  /** Selection range the link applies to. */
  from: number
  to: number
  /** Existing URL when editing a link, else ''. */
  url: string
  /** Bounding box of the selection, in viewport coords. */
  rect: DOMRect
}

interface Props {
  target: LinkPopoverTarget
  onSubmit: (url: string) => void
  onRemove: () => void
  onCancel: () => void
}

function clampPosition(rect: DOMRect, bar: DOMRect) {
  const pad = 10
  const gap = 10
  let top = rect.top - bar.height - gap
  if (top < pad) top = rect.bottom + gap
  let left = rect.left + rect.width / 2 - bar.width / 2
  left = Math.max(pad, Math.min(left, window.innerWidth - bar.width - pad))
  top = Math.max(pad, Math.min(top, window.innerHeight - bar.height - pad))
  return { left, top }
}

/** Inline URL entry for ⌘K / the link button — replaces the native prompt(). */
export function LinkPopover({ target, onSubmit, onRemove, onCancel }: Props) {
  const isEdit = target.url.trim() !== ''
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(target.url || 'https://')
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Measure, then place — before paint, so the panel never flashes at 0,0.
  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    setPos(clampPosition(target.rect, el.getBoundingClientRect()))
  }, [target.rect])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.focus()
    // Select the whole URL so typing replaces the placeholder/old value cleanly.
    el.select()
  }, [])

  // Esc cancels; an outside click cancels too (keeps the selection intact).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
      }
    }
    const onPointer = (e: MouseEvent) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    // Defer so the click that opened the popover doesn't immediately close it.
    const t = window.setTimeout(() => document.addEventListener('mousedown', onPointer, true), 0)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      clearTimeout(t)
      document.removeEventListener('mousedown', onPointer, true)
    }
  }, [onCancel])

  function submit() {
    const url = value.trim()
    if (!url || url === 'https://') {
      onCancel()
      return
    }
    onSubmit(url)
  }

  return createPortal(
    <div
      ref={panelRef}
      className="link-popover"
      role="dialog"
      aria-label={isEdit ? 'Edit link' : 'Add link'}
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        visibility: pos ? 'visible' : 'hidden',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="url"
        inputMode="url"
        className="link-popover__input"
        value={value}
        placeholder="https://…"
        aria-label="Link URL"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            submit()
          }
        }}
      />
      {isEdit && (
        <button
          type="button"
          className="link-popover__btn link-popover__btn--remove"
          title="Remove link"
          aria-label="Remove link"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onRemove}
        >
          Remove
        </button>
      )}
      <button
        type="button"
        className="link-popover__btn link-popover__btn--apply"
        onMouseDown={(e) => e.preventDefault()}
        onClick={submit}
      >
        {isEdit ? 'Update' : 'Add'}
      </button>
    </div>,
    document.body,
  )
}
