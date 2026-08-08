import { useEffect, useRef, useState } from 'react'
import type { FacetChip, FacetGrouping } from './facets'

interface Props {
  group: FacetGrouping
  /** Keys currently lit, so the trigger can say how many of its own are on. */
  active: string[]
  onToggle: (key: string) => void
}

/**
 * One group of facets, behind a plain word.
 *
 * "Marked" and "Wrote" rather than eleven chips in a row. The row was a row
 * nobody could scan, and worse, it read as a filter panel — a wall of switches
 * to work through before you get to look at anything. A word you press is a
 * question you might ask out loud.
 *
 * The count on each option matters: choosing a filter should never be a shot in
 * the dark, and "Prayer 214" tells you what you're about to get before you get
 * it.
 */
export function FacetMenu({ group, active, onToggle }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const onCount = group.chips.filter((c) => active.includes(c.key)).length

  // Click-away and Escape. Deliberately not a portal: this sits in the flow
  // above the wall, and a portal would need position maths to stay under its
  // own trigger through a resize.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="pg__facet" ref={wrapRef}>
      <button
        type="button"
        className="pg__facet-b"
        data-on={onCount > 0 ? 'true' : undefined}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        {group.label}
        {onCount > 0 ? <span className="pg__facet-n">{onCount}</span> : null}
        <span className="pg__facet-caret" aria-hidden>
          ⌄
        </span>
      </button>

      {open ? (
        <div className="pg__facet-menu" role="group" aria-label={group.label}>
          {group.chips.map((chip) => (
            <Option
              key={chip.key}
              chip={chip}
              on={active.includes(chip.key)}
              onToggle={() => onToggle(chip.key)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Option({ chip, on, onToggle }: { chip: FacetChip; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="pg__facet-opt"
      data-on={on ? 'true' : undefined}
      aria-pressed={on}
      onClick={onToggle}
    >
      {chip.color ? (
        <span className="pg__facet-swatch" data-color={chip.color} aria-hidden />
      ) : null}
      <span className="pg__facet-label">{chip.label}</span>
      <span className="pg__facet-count">{chip.count}</span>
    </button>
  )
}
