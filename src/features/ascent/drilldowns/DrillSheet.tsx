import { useEffect, type ReactNode } from 'react'
import { DRILL_COPY } from '../ascent.config'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * The quiet, dismissible overlay every drill-in shares. A drill-in is always an
 * invitation, never a wall — backdrop tap and Escape both close it, and it never
 * blocks the page beneath. The substrate inside is the season as a path of the
 * user's own moments.
 */
export function DrillSheet({ title, onClose, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="ascent-drill" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="ascent-drill__scrim" aria-label={DRILL_COPY.close} onClick={onClose} />
      <div className="ascent-drill__panel">
        <header className="ascent-drill__head">
          <h2 className="ascent-drill__title">{title}</h2>
          <button type="button" className="ascent-drill__close" onClick={onClose}>
            {DRILL_COPY.close}
          </button>
        </header>
        <div className="ascent-drill__body">{children}</div>
      </div>
    </div>
  )
}
