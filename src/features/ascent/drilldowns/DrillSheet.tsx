import { useEffect, type ReactNode } from 'react'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useExit, useMergedRef } from '@/hooks/usePresence'
import { useSheetDismiss } from '@/hooks/useSheetDismiss'
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
 *
 * On a phone it is a bottom sheet, the way the ledger's WriteSheet is: it rises
 * from the edge the thumb is already at, carries a grabber, follows a downward
 * drag, and goes back down when let go of. On a wider screen it stays the
 * centred card, which leaves with a short fade. Either way the exit plays
 * before the parent hears (useExit) — the parent closes by popping a history
 * frame, so it can't animate anything itself.
 */
export function DrillSheet({ title, onClose, children }: Props) {
  const isMobile = useIsMobile()
  const exit = useExit(onClose)
  const close = exit.close
  const drag = useSheetDismiss({ onDismiss: close, enabled: isMobile && !exit.closing })
  const panelRef = useMergedRef<HTMLDivElement>(exit.ref, drag.ref)

  useEffect(() => {
    if (exit.closing) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [close, exit.closing])

  return (
    <div
      className="ascent-drill"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-state={exit.state}
      data-sheet={isMobile ? 'true' : undefined}
    >
      <button
        type="button"
        className="ascent-drill__scrim"
        aria-label={DRILL_COPY.close}
        data-state={exit.state}
        onClick={close}
      />
      <div
        ref={panelRef}
        className="ascent-drill__panel"
        data-state={exit.state}
        // The panel is the sheet's scroller on a phone: a downward drag belongs
        // to it only from the top (useSheetDismiss).
        data-sheet-scroll={isMobile ? '' : undefined}
        data-dragging={drag.dragging ? 'true' : undefined}
        {...drag.handlers}
      >
        <header className="ascent-drill__head">
          <h2 className="ascent-drill__title">{title}</h2>
          <button type="button" className="ascent-drill__close" onClick={close}>
            {DRILL_COPY.close}
          </button>
        </header>
        <div className="ascent-drill__body">{children}</div>
      </div>
    </div>
  )
}
