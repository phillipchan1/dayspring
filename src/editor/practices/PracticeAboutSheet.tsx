import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PRACTICE_FUNCTIONS, type Practice } from './practicesData'
import './PracticeAboutSheet.css'

interface Props {
  practice: Practice
  /** Dismiss (Escape / scrim / close) — caller restores the caret. */
  onClose: () => void
}

/**
 * A calm right-side slide-over describing a practice — why it exists, how it
 * moves, and a few tips — opened from the "about" action in a practice header.
 * It borrows the library/threshold aesthetic (serif, parchment) rather than the
 * editor's one-font surface, so "reading about a practice" feels distinct from
 * writing in one, while the entry stays visible beside it.
 */
export function PracticeAboutSheet({ practice, onClose }: Props) {
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

  const fnLabel =
    PRACTICE_FUNCTIONS.find((f) => f.id === practice.function)?.label ?? practice.function

  return createPortal(
    <div
      className="practice-sheet"
      role="dialog"
      aria-modal="true"
      aria-label={`About ${practice.name}`}
    >
      <button
        type="button"
        className="practice-sheet__scrim"
        aria-label="Close"
        onClick={onClose}
      />
      <aside className="practice-sheet__panel">
        <button
          type="button"
          className="practice-sheet__close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="practice-sheet__eyebrow">{fnLabel}</div>
        <h2 className="practice-sheet__name">{practice.name}</h2>
        <div className="practice-sheet__origin">
          {practice.origin} · {practice.tradition}
        </div>

        <div className="practice-sheet__divider" aria-hidden />
        <p className="practice-sheet__lead">{practice.intention}</p>

        <section className="practice-sheet__section">
          <h3 className="practice-sheet__heading">Why</h3>
          <p className="practice-sheet__body">{practice.why}</p>
        </section>

        <section className="practice-sheet__section">
          <h3 className="practice-sheet__heading">The shape</h3>
          <p className="practice-sheet__body">{practice.shape}</p>
        </section>

        <section className="practice-sheet__section">
          <h3 className="practice-sheet__heading">Tips</h3>
          <ul className="practice-sheet__tips">
            {practice.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>

        <p className="practice-sheet__quote">“{practice.quote}”</p>
      </aside>
    </div>,
    document.body,
  )
}
