import { useEffect } from 'react'
import { ShortcutsGuide } from './ShortcutsGuide'

interface Props {
  onClose: () => void
}

/** The global “?” cheat-sheet — a light, dismissible overlay over anything. */
export function ShortcutsOverlay({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Capture + stop so this wins over focus-mode's Esc handler underneath.
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="scrim shortcuts-scrim" onClick={onClose}>
      <div
        className="shortcuts-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-overlay__head">
          <h2 className="shortcuts-overlay__title">Keyboard shortcuts</h2>
          <button className="btn btn--ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <ShortcutsGuide />
        <p className="shortcuts-overlay__foot">
          Press <kbd className="kbd">?</kbd> any time to bring this back.
        </p>
      </div>
    </div>
  )
}
