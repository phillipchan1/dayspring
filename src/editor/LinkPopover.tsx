import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clampPosition } from './SelectionFormatBar'

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

/** Inline URL entry for ⌘K / the link button — replaces the native prompt(). */
export function LinkPopover({ target, onSubmit, onRemove, onCancel }: Props) {
  const isEdit = target.url.trim() !== ''
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(target.url || 'https://')
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  // Measure, then place — before paint, so the panel never flashes at 0,0.
  // Clamped to the VISUAL viewport (the format bar's rule), and again whenever
  // it changes: on iOS the keyboard rises after the field takes focus, and a
  // clamp to the window left the field under the keys it was waiting for.
  useLayoutEffect(() => {
    const place = () => {
      const el = panelRef.current
      if (!el) return
      setPos(clampPosition(target.rect, el.getBoundingClientRect()))
    }
    place()
    const vv = window.visualViewport
    vv?.addEventListener('resize', place)
    vv?.addEventListener('scroll', place)
    return () => {
      vv?.removeEventListener('resize', place)
      vv?.removeEventListener('scroll', place)
    }
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
    const onPointer = (e: Event) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return
      onCancel()
    }
    window.addEventListener('keydown', onKey, true)
    // Defer so the click that opened the popover doesn't immediately close it.
    // `pointerdown`, not `mousedown` — see src/editor/pointerInput.ts. A tap
    // that WebKit routes to text selection or a scroll never becomes a mouse
    // press at all, so on the iPad this panel simply would not close when you
    // reached past it into the page. Every press produces a pointer event.
    // Deferred so the press that opened the popover doesn't immediately close it.
    const t = window.setTimeout(() => document.addEventListener('pointerdown', onPointer, true), 0)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      clearTimeout(t)
      document.removeEventListener('pointerdown', onPointer, true)
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
        autoCapitalize="none"
        autoCorrect="off"
        enterKeyHint="done"
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
