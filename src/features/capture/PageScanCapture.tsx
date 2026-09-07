import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useKeyboardInset } from '@/hooks/useKeyboard'
import { ScanIcon } from '@/editor/spiritualBlockIcons'
import { transcribePages } from '@/lib/transcribeImageClient'
import { useSheetDismiss } from '@/hooks/useSheetDismiss'
import './PageScanCapture.css'

interface PageScanCaptureProps {
  /** Insert the transcribed text into the entry at the captured caret. */
  onInsert: (text: string) => void
  /** Close the overlay (cancel or after insert). */
  onClose: () => void
  /** The writer's frequent proper nouns, to bias transcription. */
  vocab?: string
}

const MAX_PAGES = 8

interface Page {
  file: File
  url: string
}

type Phase = 'collect' | 'working' | 'review' | 'error'

/**
 * Scan a physical journal entry: photograph each page (camera-first on mobile),
 * then a vision model reads the handwriting into a markdown draft you review and
 * insert. We transcribe faithfully and never rewrite — the result is always a
 * draft the writer corrects, with their photos still in hand until they accept.
 */
export function PageScanCapture({ onInsert, onClose, vocab }: PageScanCaptureProps) {
  const isMobile = useIsMobile()
  const keyboardInset = useKeyboardInset()
  const [pages, setPages] = useState<Page[]>([])
  const [phase, setPhase] = useState<Phase>('collect')
  const [draft, setDraft] = useState('')
  const [err, setErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Revoke object URLs on unmount so the previews don't leak. A ref mirror keeps
  // the cleanup current without re-subscribing on every page add.
  const pagesRef = useRef<Page[]>([])
  pagesRef.current = pages
  useEffect(() => {
    return () => {
      for (const p of pagesRef.current) URL.revokeObjectURL(p.url)
    }
  }, [])

  // Esc cancels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return
    const incoming = Array.from(list).filter((f) => f.type.startsWith('image/'))
    setPages((prev) => {
      const room = Math.max(0, MAX_PAGES - prev.length)
      const next = incoming.slice(0, room).map((file) => ({ file, url: URL.createObjectURL(file) }))
      return [...prev, ...next]
    })
  }

  function removePage(idx: number) {
    setPages((prev) => {
      const p = prev[idx]
      if (p) URL.revokeObjectURL(p.url)
      return prev.filter((_, i) => i !== idx)
    })
  }

  async function handleTranscribe() {
    if (pages.length === 0) return
    setPhase('working')
    setErr('')
    try {
      const { text } = await transcribePages(
        pages.map((p) => p.file),
        vocab ? { vocab } : {},
      )
      setDraft(text)
      setPhase('review')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Transcription failed')
      setPhase('error')
    }
  }

  function handleInsert() {
    const clean = draft.trim()
    if (clean) onInsert(clean)
    onClose()
  }

  const working = phase === 'working'

  // The grab pill rendered but did nothing. Not while the model is reading the
  // pages, though — dismissing mid-transcribe would throw the work away.
  const { handlers: dragHandlers, dragY, dragging } = useSheetDismiss({
    onDismiss: onClose,
    enabled: isMobile && !working,
  })

  const style: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: keyboardInset,
        zIndex: 8500,
        ...(dragY ? { transform: `translateY(${dragY}px)` } : {}),
        ...(dragging ? { transition: 'none' } : {}),
      }
    : { position: 'fixed', zIndex: 8500 }

  return createPortal(
    <>
      <div className="command-popover__scrim" onClick={onClose} aria-hidden />
      <div
        className={`page-scan glass-surface${isMobile ? ' page-scan--sheet' : ''}`}
        style={style}
        role="dialog"
        aria-label="Scan handwritten page"
        onMouseDown={(e) => e.stopPropagation()}
        {...(isMobile ? dragHandlers : {})}
      >
        <div className="glass-surface__glow" aria-hidden />
        {isMobile && <div className="command-popover__grab" aria-hidden />}

        <div className="page-scan__body">
          {phase === 'review' ? (
            <>
              <p className="page-scan__status">Your words — read it over and fix anything.</p>
              <textarea
                className="page-scan__draft"
                // Scrolling back through a long transcription must not slide the
                // sheet away (see useSheetDismiss).
                data-sheet-scroll
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={isMobile ? 8 : 12}
                autoFocus
              />
              <div className="page-scan__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setPhase('collect')}>
                  Back
                </button>
                <button type="button" className="btn page-scan__primary" onClick={handleInsert}>
                  Insert into entry
                </button>
              </div>
            </>
          ) : phase === 'error' ? (
            <div className="page-scan__error">
              <p className="page-scan__error-msg">{err}</p>
              <p className="page-scan__reassure">Your photos are still here — nothing is lost.</p>
              <div className="page-scan__actions">
                <button type="button" className="btn btn--ghost" onClick={() => setPhase('collect')}>
                  Back to photos
                </button>
                <button
                  type="button"
                  className="btn page-scan__primary"
                  onClick={() => void handleTranscribe()}
                >
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="page-scan__tray">
                {pages.map((p, i) => (
                  <div key={p.url} className="page-scan__thumb">
                    <img src={p.url} alt={`Page ${i + 1}`} />
                    <span className="page-scan__thumb-num">{i + 1}</span>
                    <button
                      type="button"
                      className="page-scan__thumb-remove"
                      onClick={() => removePage(i)}
                      aria-label={`Remove page ${i + 1}`}
                      disabled={working}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {pages.length < MAX_PAGES && !working && (
                  <button
                    type="button"
                    className="page-scan__add"
                    onClick={() => inputRef.current?.click()}
                  >
                    <ScanIcon />
                    <span>{pages.length === 0 ? 'Add a page' : 'Add page'}</span>
                  </button>
                )}
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = '' // allow re-picking the same file
                }}
              />

              <p className="page-scan__status">
                {working
                  ? 'Reading your handwriting…'
                  : pages.length === 0
                    ? 'Photograph each page of your entry, in order.'
                    : `${pages.length} page${pages.length > 1 ? 's' : ''} — add more or transcribe.`}
              </p>

              <div className="page-scan__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={onClose}
                  disabled={working}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn page-scan__primary"
                  onClick={() => void handleTranscribe()}
                  disabled={pages.length === 0 || working}
                >
                  {working ? 'Transcribing…' : 'Transcribe'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}
