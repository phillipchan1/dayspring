import { useCallback, useEffect, useRef } from 'react'
import { useModalFocus } from '@/hooks/useModalFocus'
import type { PresenceState } from '@/hooks/usePresence'
import { ShortcutsGuide } from './ShortcutsGuide'

interface Props {
  onClose: () => void
  /**
   * From the mount point's usePresence: 'closing' while the dialog fades out,
   * and the node whose exit decides when it is gone.
   */
  presence?: { state: PresenceState; ref: (node: Element | null) => void }
}

/** The global “?” cheat-sheet — a light, dismissible overlay over anything. */
export function ShortcutsOverlay({ onClose, presence }: Props) {
  const closing = presence?.state === 'closing'

  // The app behind is inert while this is up; focus in, and back out the
  // moment it starts to close — not after its fade.
  const layerRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  useModalFocus(layerRef, dialogRef, !closing)
  const presenceRef = presence?.ref
  const setDialog = useCallback(
    (el: HTMLDivElement | null) => {
      dialogRef.current = el
      presenceRef?.(el)
    },
    [presenceRef],
  )

  useEffect(() => {
    // On its way out, an Esc is for whatever is underneath — and `onClose` is
    // a history pop, so answering it twice would go back a frame too far.
    if (closing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Capture + stop so this wins over focus-mode's Esc handler underneath.
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose, closing])

  return (
    <div
      ref={layerRef}
      className="scrim shortcuts-scrim glass-scrim"
      data-state={presence?.state}
      onClick={onClose}
    >
      <div
        ref={setDialog}
        className="shortcuts-overlay glass-surface"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        data-state={presence?.state}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-surface__glow" aria-hidden />
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
