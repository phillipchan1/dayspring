import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  PRACTICES,
  PRACTICE_FUNCTIONS,
  type Practice,
  type PracticeFunction,
} from './practicesData'
import './PracticeLibrary.css'

interface Props {
  /** Begin a ritual — the caller closes the modal and seeds the editor. */
  onBegin: (practice: Practice) => void
  /** Dismiss without beginning (Escape / scrim) — caller restores the caret. */
  onClose: () => void
  /** When true, selecting a ritual begins immediately (no preview/threshold). */
  skipPreview: boolean
  /** Persist the "skip the preview" preference. */
  onToggleSkipPreview: (value: boolean) => void
}

type Filter = PracticeFunction | 'all'

/**
 * Full-screen Rituals Library: browse the forms, pass through an orienting
 * preview (its questions), then begin writing. Fully keyboard-navigable — arrow
 * through the cards, Enter to choose, Enter again to begin. Power users can skip
 * the preview entirely (restored from Settings). Nothing is inserted into the
 * entry until "Begin writing".
 */
export function PracticeLibrary({ onBegin, onClose, skipPreview, onToggleSkipPreview }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Practice | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const gridRef = useRef<HTMLDivElement>(null)

  const visible = useMemo(
    () => PRACTICES.filter((p) => filter === 'all' || p.function === filter),
    [filter],
  )

  // Reset the keyboard cursor when the filtered set changes.
  useEffect(() => setActiveIdx(0), [filter])

  // Selecting a ritual either previews it (threshold) or begins straight away.
  const choose = (practice: Practice) => {
    if (skipPreview) onBegin(practice)
    else setSelected(practice)
  }

  // Keep the keyboard-active card in view.
  useEffect(() => {
    if (selected) return
    const el = gridRef.current?.querySelector<HTMLElement>('[data-active="true"]')
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, selected, visible.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (selected) setSelected(null)
        else onClose()
        return
      }
      if (selected) {
        if (e.key === 'Enter') {
          e.preventDefault()
          onBegin(selected)
        } else if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
          e.preventDefault()
          setSelected(null)
        }
        return
      }
      if (visible.length === 0) return
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => (i + 1) % visible.length)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => (i - 1 + visible.length) % visible.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const practice = visible[activeIdx]
        if (practice) choose(practice)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const functionLabel = (fn: PracticeFunction) =>
    PRACTICE_FUNCTIONS.find((f) => f.id === fn)?.label ?? fn

  return createPortal(
    <div className="practice-modal" role="dialog" aria-modal="true" aria-label="Rituals">
      <div className="practice-library">
        <header className="practice-library__header">
          <div className="practice-library__eyebrow">The Rituals</div>
          <h1 className="practice-library__title">
            How will you <em>draw near</em> today?
          </h1>
          <p className="practice-library__subline">
            Tried and true rituals for the inner life — gathered from two thousand
            years of faithful writing.
          </p>
        </header>

        <div className="practice-library__filters" role="tablist" aria-label="Filter rituals">
          {PRACTICE_FUNCTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              className="practice-filter"
              data-active={filter === f.id ? 'true' : undefined}
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="practice-library__grid" ref={gridRef}>
          {visible.map((practice, i) => (
            <button
              key={practice.name}
              type="button"
              className="practice-card"
              data-function={practice.function}
              data-active={i === activeIdx ? 'true' : undefined}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => choose(practice)}
            >
              <span className="practice-card__function">
                {functionLabel(practice.function)}
              </span>
              <span className="practice-card__name">{practice.name}</span>
              <span className="practice-card__origin">{practice.origin}</span>
              <span className="practice-card__quote">{practice.quote}</span>
              <span className="practice-card__footer">
                <span className="practice-card__tag">{practice.tradition}</span>
                <span className="practice-card__arrow" aria-hidden>
                  →
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="practice-threshold" data-visible={selected ? 'true' : undefined}>
        <button
          type="button"
          className="practice-threshold__back"
          onClick={() => setSelected(null)}
        >
          ← Rituals
        </button>
        {selected && (
          <div className="practice-threshold__inner">
            <div className="practice-threshold__function">
              {functionLabel(selected.function)}
            </div>
            <div className="practice-threshold__name">{selected.name}</div>
            <div className="practice-threshold__origin">{selected.origin}</div>
            <div className="practice-threshold__divider" aria-hidden />
            <p className="practice-threshold__intention">{selected.intention}</p>

            <div className="practice-threshold__movements-label">
              {selected.prompts.length} movements
            </div>
            <ol className="practice-threshold__movements">
              {selected.prompts.map((prompt) => (
                <li key={prompt.label} className="practice-threshold__movement">
                  <span className="practice-threshold__movement-name">{prompt.label}</span>
                  <span className="practice-threshold__movement-q">{prompt.question}</span>
                </li>
              ))}
            </ol>

            <button
              type="button"
              className="practice-threshold__begin"
              onClick={() => onBegin(selected)}
            >
              Begin writing
            </button>
            <label className="practice-threshold__skip">
              <input
                type="checkbox"
                checked={skipPreview}
                onChange={(e) => onToggleSkipPreview(e.target.checked)}
              />
              Skip this preview next time
            </label>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
