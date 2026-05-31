import { useEffect, useId, useRef, useState } from 'react'
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

interface Props {
  value: EditorFont
  onChange: (font: EditorFont) => void
}

export function WritingFontPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const active = FONTS.find((f) => f.value === value) ?? FONTS[0]!

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  return (
    <div className="font-picker" ref={rootRef}>
      <button
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

      {open && (
        <ul id={listId} className="font-picker__menu" role="listbox" aria-label="Writing font">
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
        </ul>
      )}
    </div>
  )
}
