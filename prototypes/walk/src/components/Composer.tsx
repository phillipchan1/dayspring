import type { ReactNode } from 'react'

/**
 * The composer chrome, drawn from the real one so what is on screen is being
 * judged rather than the furniture around it.
 *
 * Everything here matches `RitualComposer.tsx` and none of it changes in this
 * proposal: the bar (leave / name / about), the spine of pips, the footer with
 * the next movement named. The argument is entirely about the body.
 */
export function Composer({
  movements,
  at,
  onBack,
  footer,
  children,
}: {
  movements: string[]
  /** Index of the movement on screen; `movements.length` is the close. */
  at: number
  onBack?: () => void
  footer: ReactNode
  children: ReactNode
}) {
  return (
    <div className="phone">
      <header className="rc__bar">
        <span className="rc__x">✕</span>
        <span className="rc__name">Lectio Divina</span>
        <span className="rc__tools">about</span>
      </header>

      <div className="rc__spine" aria-hidden>
        {movements.map((label, n) => (
          <span
            key={label}
            className="rc__pip"
            data-on={n === at ? 'true' : undefined}
            data-done={n < at ? 'true' : undefined}
          />
        ))}
      </div>

      {/* Keyed on the movement so the entrance replays on every step. A ritual
          is a sequence in time; arriving somewhere should feel like arriving. */}
      <div className="rc__body" key={at}>
        {children}
      </div>

      <footer className="rc__foot">
        {onBack ? (
          <button type="button" className="rc__back" onClick={onBack}>
            ‹ back
          </button>
        ) : (
          <span />
        )}
        {footer}
      </footer>
    </div>
  )
}
