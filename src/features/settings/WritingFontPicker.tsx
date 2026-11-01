import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { WritingFace } from '@/lib/settings'
import { WRITING_FACE_VARS } from '@/lib/settings'

/** Sample rendering only. 'auto' shows the face the live theme is already using. */
const FONT_VARS: Record<FontChoice, string> = {
  ...WRITING_FACE_VARS,
  auto: 'var(--font-editor)',
}

/**
 * The picker's own option type. `'auto'` is NOT an EditorFont member — that
 * union is written into `settings.editorFont` and read by a client on the other
 * release channel, where `EDITOR_FONT_VARS['auto']` would be undefined and
 * `--font-editor` would resolve to nothing. The choice is carried by the
 * separate `editorFontAuto` flag instead; this type exists only for the menu.
 * The same goes for the faces added since (`ExtraEditorFont`), via
 * `writingFacePatch`.
 */
export type FontChoice = WritingFace | 'auto'

const SAMPLE = 'A quiet morning entry'

// The first six are described by what they are; the rest are named for the
// typeface, because someone who wants Lato wants to find the word "Lato".
// Grouped by kind: serifs, then the typewriter and mono, then the sans faces.
const FONTS: { value: FontChoice; label: string; sample: string }[] = [
  { value: 'auto', label: 'Follow the theme', sample: SAMPLE },
  { value: 'serif', label: 'Serif', sample: SAMPLE },
  { value: 'literary', label: 'Literary', sample: SAMPLE },
  { value: 'lora', label: 'Lora', sample: SAMPLE },
  { value: 'merriweather', label: 'Merriweather', sample: SAMPLE },
  { value: 'literata', label: 'Literata', sample: SAMPLE },
  { value: 'typewriter', label: 'Typewriter', sample: SAMPLE },
  { value: 'mono', label: 'Mono', sample: SAMPLE },
  { value: 'sans', label: 'Sans', sample: SAMPLE },
  { value: 'lato', label: 'Lato', sample: SAMPLE },
  { value: 'readable', label: 'Readable', sample: SAMPLE },
]

// Matches the menu's old `max-height: min(18rem, 50vh)` — its natural size
// when there's room to show it in full.
const MENU_PREFERRED_HEIGHT = 288

interface Props {
  value: FontChoice
  onChange: (font: FontChoice) => void
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
    const onPointer = (e: Event) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    // `pointerdown`, not `mousedown` — see src/editor/pointerInput.ts. A tap
    // that WebKit routes to text selection or a scroll never becomes a mouse
    // press at all, so on the iPad this panel simply would not close when you
    // reached past it into the page. Every press produces a pointer event.
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  // The menu is portaled to <body> and positioned in viewport coordinates, so
  // it has to close rather than go stale whenever the settings panel (or the
  // page) scrolls or resizes underneath it.
  useEffect(() => {
    if (!open) return
    const onScroll = (e: Event) => {
      // Scroll events don't bubble, but capture listeners on window still see
      // scrolls on descendants — including this menu's overflow-y:auto list.
      // Closing on those made the list feel stuck, especially on touch where
      // every drag is a scroll gesture.
      const target = e.target
      if (target instanceof Node && menuRef.current?.contains(target)) return
      setOpen(false)
    }
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
          <span className="font-picker__label" style={{ fontFamily: FONT_VARS[value] }}>
            {active.label}
          </span>
          <span className="font-picker__sample" style={{ fontFamily: FONT_VARS[value] }}>
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
                      style={{ fontFamily: FONT_VARS[f.value] }}
                    >
                      {f.label}
                    </span>
                    {selected && <span className="font-picker__check" aria-hidden>✓</span>}
                  </span>
                  <span
                    className="font-picker__sample"
                    style={{ fontFamily: FONT_VARS[f.value] }}
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
