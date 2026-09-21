import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useSheetDismiss } from '@/hooks/useSheetDismiss'
import { LEDGER_COPY } from './copy'
import { fmtDay } from './Passage'
import { QUESTIONS, startReflection, type QuestionKey, type Seed } from './write'

/**
 * Before the page is made: the lines that will sit on it, and the one question
 * under them — the writer's choice. Nothing is created until they start.
 */
export function WriteSheet({
  seed,
  onClose,
  onOpenEntry,
}: {
  seed: Seed
  onClose: () => void
  onOpenEntry?: ((entryId: string) => void) | undefined
}) {
  const [question, setQuestion] = useState<QuestionKey>('now')
  const [busy, setBusy] = useState(false)
  // On a phone this rises from the bottom edge, so it goes back down the same
  // way. Esc is the desktop half of the same thing; a phone has no Esc.
  const isMobile = useIsMobile()
  const { handlers: dragHandlers, dragY, dragging } = useSheetDismiss({ onDismiss: onClose, enabled: isMobile })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function start() {
    if (busy) return
    setBusy(true)
    try {
      const id = await startReflection(seed, question)
      onOpenEntry?.(id)
    } finally {
      setBusy(false)
    }
  }

  const q = QUESTIONS.find((x) => x.key === question)!
  // Portaled: the Ascent's rise-in animation transforms its ancestors, and a
  // transformed ancestor traps position:fixed — the sheet would sit in the page.
  return createPortal(
    <div className="write-sheet" role="dialog" aria-modal="true" aria-label={seed.title}>
      <button type="button" className="write-sheet__scrim" aria-label={LEDGER_COPY.close} onClick={onClose} />
      <div
        className="write-sheet__page"
        data-sheet-scroll
        data-dragging={dragging ? 'true' : undefined}
        {...dragHandlers}
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
      >
        <div className="write-sheet__meta">
          <span>{LEDGER_COPY.newPage}</span>
          <button type="button" onClick={onClose}>
            {LEDGER_COPY.close}
          </button>
        </div>
        <h2 className="write-sheet__title">{seed.title}</h2>
        <div className="write-sheet__quotes">
          {seed.groups.map((g) => (
            <blockquote key={g.label}>
              {seed.groups.length > 1 ? <div className="write-sheet__of">{g.label}</div> : null}
              {g.lines.map((l, i) => (
                <p key={`${l.date}${i}`}>
                  {l.text}
                  <span>{fmtDay(l.date)}</span>
                </p>
              ))}
            </blockquote>
          ))}
        </div>
        <div className="write-sheet__asks">
          {QUESTIONS.map((x) => (
            <button key={x.key} type="button" aria-pressed={x.key === question} onClick={() => setQuestion(x.key)}>
              {x.chip}
            </button>
          ))}
        </div>
        <p className="write-sheet__q">{q.text}</p>
        <div className="write-sheet__foot">
          <span>{LEDGER_COPY.ordinaryEntry}</span>
          <button type="button" className="story__write is-solid" onClick={start} disabled={busy}>
            {LEDGER_COPY.startWriting}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
