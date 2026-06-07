import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  PRACTICES,
  PRACTICE_FUNCTIONS,
  type Practice,
  type PracticeFunction,
} from './practicesData'
import './PracticeLibrary.css'

interface Props {
  /** Begin a practice — the caller closes the modal and seeds the editor. */
  onBegin: (practice: Practice) => void
  /** Dismiss without beginning (Escape / scrim) — caller restores the caret. */
  onClose: () => void
}

type Filter = PracticeFunction | 'all'

/**
 * Full-screen Practices Library: browse the forms, pass through an orienting
 * threshold, then begin writing. Nothing is inserted into the entry until the
 * writer presses "Begin writing".
 */
export function PracticeLibrary({ onBegin, onClose }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Practice | null>(null)

  // Escape always closes the whole modal and returns the caret to the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

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

        <div className="practice-library__filters" role="tablist" aria-label="Filter practices">
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

        <div className="practice-library__grid">
          {PRACTICES.map((practice) => (
            <button
              key={practice.name}
              type="button"
              className={`practice-card${
                filter !== 'all' && practice.function !== filter ? ' practice-card--hidden' : ''
              }`}
              data-function={practice.function}
              onClick={() => setSelected(practice)}
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
            <button
              type="button"
              className="practice-threshold__begin"
              onClick={() => onBegin(selected)}
            >
              Begin writing
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
