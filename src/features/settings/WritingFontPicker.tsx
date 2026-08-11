import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { EditorFont } from '@/lib/settings'
import { EDITOR_FONT_VARS } from '@/lib/settings'

const FONTS: { value: EditorFont; label: string; sample: string }[] = [
  { value: 'serif', label: 'Serif', sample: 'A quiet morning entry' },
  { value: 'literary', label: 'Literary', sample: 'A quiet morning entry' },
  { value: 'typewriter', label: 'Typewriter', sample: 'A quiet morning entry' },
  { value: 'mono', label: 'Mono', sample: 'A quiet morning entry' },
  { value: 'sans', label: 'Sans', sample: 'A quiet morning entry' },
  { value: 'readable', label: 'Readable', sample: 'A quiet morning entry' },
]

// Matches the menu's old `max-height: min(18rem, 50vh)` — its natural size
// when there's room to show it in full.
const MENU_PREFERRED_HEIGHT = 288

interface Props {
  value: EditorFont
  onChange: (font: EditorFont) => void
}

export function WritingFontPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const active = FONTS.find((f) => f.value === value) ?? FONTS[0]!
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  // The menu is portaled to <body> and positioned in viewport coordinates, so
  // it has to close rather than go stale whenever the settings panel (or the
  // page) scrolls or resizes underneath it.
  useEffect(() => {
    if (!open) return
    const onScroll = () => setOpen(false)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  // Position from the trigger's own rect, flipping above it when there isn't
  // enough room below — e.g. when the field sits near the bottom of the
  // settings panel. Fixed positioning + a body portal keeps the menu from
  // being clipped by the panel's own overflow:auto scroll container.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const pad = 8
    const gap = 4
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - pad
    const spaceAbove = rect.top - pad
    const openUp = spaceBelow < MENU_PREFERRED_HEIGHT && spaceAbove > spaceBelow
    const maxHeight = Math.min(MENU_PREFERRED_HEIGHT, Math.max(120, openUp ? spaceAbove : spaceBelow))
    setMenuStyle({
      position: 'fixed',
      left: rect.left,
      width: rect.width,
      maxHeight,
      ...(openUp ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }),
    })
  }, [open])

  return (
    <div className="font-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        id="writing-font"
        className="font-picker__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-picker__trigger-inner">
          <span className="font-picker__label" style={{ fontFamily: EDITOR_FONT_VARS[value] }}>
            {active.label}
          </span>
          <span className="font-picker__sample" style={{ fontFamily: EDITOR_FONT_VARS[value] }}>
            {active.sample}
          </span>
        </span>
        <span className="font-picker__chevron" aria-hidden />
      </button>

      {open && createPortal(
        <ul
          ref={menuRef}
          id={listId}
          className="font-picker__menu"
          role="listbox"
          aria-label="Writing font"
          style={menuStyle}
        >
          {FONTS.map((f) => {
            const selected = f.value === value
            return (
              <li key={f.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="font-picker__option"
                  onClick={() => {
                    onChange(f.value)
                    setOpen(false)
                  }}
                >
                  <span className="font-picker__option-head">
                    <span
                      className="font-picker__label"
                      style={{ fontFamily: EDITOR_FONT_VARS[f.value] }}
                    >
                      {f.label}
                    </span>
                    {selected && <span className="font-picker__check" aria-hidden>✓</span>}
                  </span>
                  <span
                    className="font-picker__sample"
                    style={{ fontFamily: EDITOR_FONT_VARS[f.value] }}
                  >
                    {f.sample}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>,
        document.body,
      )}
    </div>
  )
}
