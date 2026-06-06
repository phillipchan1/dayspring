import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SlashCommandId, SlashState } from './slashDetect'

const COMMANDS: { id: SlashCommandId; label: string; hint: string }[] = [
  { id: 'scripture', label: '/scripture', hint: 'Find relevant Bible passages' },
  { id: 'pray',      label: '/pray',      hint: 'Log a prayer' },
  { id: 'sense',     label: '/sense',     hint: 'Record a word or impression' },
  { id: 'practice',  label: '/practice',  hint: 'Tried and true forms for the inner life' },
  { id: 'image',     label: '/image',     hint: 'Add a photo to this entry' },
]

interface Props {
  state: SlashState
  onSelect: (cmd: SlashCommandId) => void
  onDismiss: () => void
}

export function SlashPalette({ state, onSelect, onDismiss }: Props) {
  const filtered = COMMANDS.filter((c) => c.id.startsWith(state.query))
  const [activeIdx, setActiveIdx] = useState(0)
  const paletteRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useEffect(() => {
    setActiveIdx(0)
  }, [state.query])

  // Measure the rendered palette, then place it: clamp to the viewport on both
  // axes and flip above the caret when there isn't room below. Runs before paint
  // (useLayoutEffect) so it never flashes at the wrong spot.
  useLayoutEffect(() => {
    const el = paletteRef.current
    if (!el || filtered.length === 0) return
    const r = el.getBoundingClientRect()
    const pad = 8
    const gap = 8
    const left = Math.max(pad, Math.min(state.x, window.innerWidth - r.width - pad))
    let top = state.y + gap
    if (top + r.height > window.innerHeight - pad) {
      const above = state.yTop - r.height - gap
      // Prefer above only when it actually fits better; otherwise pin in view.
      top = above >= pad ? above : Math.max(pad, window.innerHeight - r.height - pad)
    }
    setPos({ left, top })
  }, [state.x, state.y, state.yTop, filtered.length])

  useEffect(() => {
    if (filtered.length === 0) {
      onDismiss()
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onDismiss()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        e.stopPropagation()
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        e.stopPropagation()
        setActiveIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        const cmd = filtered[activeIdx]
        if (cmd) onSelect(cmd.id)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [filtered, activeIdx, onSelect, onDismiss])

  if (filtered.length === 0) return null

  const style: React.CSSProperties = {
    position: 'fixed',
    left: pos?.left ?? state.x,
    top: pos?.top ?? state.y + 8,
    visibility: pos ? 'visible' : 'hidden',
  }

  return createPortal(
    <div
      ref={paletteRef}
      className="slash-palette glass-surface"
      style={style}
      role="listbox"
      aria-label="Commands"
    >
      <div className="glass-surface__glow" aria-hidden />
      {filtered.map((cmd, i) => (
        <button
          key={cmd.id}
          role="option"
          aria-selected={i === activeIdx}
          className="slash-palette__item"
          data-active={i === activeIdx ? 'true' : undefined}
          onMouseDown={(e) => {
            e.preventDefault()
            onSelect(cmd.id)
          }}
          onMouseEnter={() => setActiveIdx(i)}
        >
          <span className="slash-palette__label">{cmd.label}</span>
          <span className="slash-palette__hint">{cmd.hint}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
