import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SlashCommandId, SlashState } from './slashDetect'

const COMMANDS: { id: SlashCommandId; label: string; hint: string }[] = [
  { id: 'scripture', label: '/scripture', hint: 'Find relevant Bible passages' },
  { id: 'pray', label: '/pray', hint: 'Log a prayer' },
  { id: 'sense', label: '/sense', hint: 'Record a word or impression' },
]

interface Props {
  state: SlashState
  onSelect: (cmd: SlashCommandId) => void
  onDismiss: () => void
}

export function SlashPalette({ state, onSelect, onDismiss }: Props) {
  const filtered = COMMANDS.filter((c) => c.id.startsWith(state.query))
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    setActiveIdx(0)
  }, [state.query])

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

  const OFFSET = 8
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(state.x, window.innerWidth - 280),
    top: state.y + OFFSET,
  }

  return createPortal(
    <div className="slash-palette glass-surface" style={style} role="listbox" aria-label="Commands">
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
