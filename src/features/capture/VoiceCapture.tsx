import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useKeyboardInset } from '@/hooks/useKeyboard'
import { useDictation } from '@/hooks/useDictation'
import { useSheetDismiss } from '@/hooks/useSheetDismiss'
import './VoiceCapture.css'

interface VoiceCaptureProps {
  /** Insert the transcribed text into the entry at the captured caret. */
  onInsert: (text: string) => void
  /** Close the overlay (cancel or after insert). */
  onClose: () => void
  /** The writer's frequent proper nouns, to bias transcription. */
  vocab?: string
}

const BAR_COUNT = 7

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * Voice dictation surface: a glass sheet (bottom sheet on mobile, centered card
 * on desktop) with a breathing orb of light that responds to the speaker, a live
 * waveform, and a timer. Speak, tap Done, and the words land at the caret.
 */
export function VoiceCapture({ onInsert, onClose, vocab }: VoiceCaptureProps) {
  const dictation = useDictation()
  const { status, error, elapsedMs, partial, partialIsLive, levelRef, hasRecording, start, finish, retry, saveAudio, discard, cancel } =
    dictation
  const isMobile = useIsMobile()
  const keyboardInset = useKeyboardInset()

  const orbRef = useRef<HTMLDivElement>(null)
  const barsRef = useRef<HTMLSpanElement[]>([])
  const partialRef = useRef<HTMLParagraphElement>(null)

  // Keep the newest words in view as the live caption grows — the motion is the
  // whole point of the signal, so it shouldn't scroll off the top and freeze.
  useEffect(() => {
    if (partialRef.current) partialRef.current.scrollTop = partialRef.current.scrollHeight
  }, [partial])

  // Auto-start listening the moment the sheet opens — tap once, you're recording.
  // Pass vocab so live captions bias toward the writer's words from word one.
  useEffect(() => {
    void start(vocab)
    // start is stable (useCallback); run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Esc cancels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        cancel()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [cancel, onClose])

  // Drive the orb + waveform from live loudness without re-rendering React.
  useEffect(() => {
    if (status !== 'recording') return
    let raf = 0
    const loop = () => {
      const lvl = levelRef.current
      orbRef.current?.style.setProperty('--level', lvl.toFixed(3))
      const now = performance.now()
      for (let i = 0; i < barsRef.current.length; i++) {
        const el = barsRef.current[i]
        if (!el) continue
        const phase = Math.sin(now / 180 + i * 0.9) * 0.5 + 0.5
        const h = 0.16 + lvl * (0.55 + 0.45 * phase)
        el.style.transform = `scaleY(${Math.min(1, h).toFixed(3)})`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [status, levelRef])

  async function handleDone() {
    try {
      const text = await finish(vocab)
      const clean = text.trim()
      if (clean) onInsert(clean)
      onClose()
    } catch {
      // error state is shown; the recording is preserved for retry/salvage.
    }
  }

  async function handleRetry() {
    try {
      const text = await retry(vocab)
      const clean = text.trim()
      if (clean) onInsert(clean)
      onClose()
    } catch {
      // still failing — stay in the error state with salvage options.
    }
  }

  function handleInsertPartial() {
    const clean = partial.trim()
    if (clean) onInsert(clean)
    discard()
    onClose()
  }

  function handleCancel() {
    cancel()
    onClose()
  }

  function handleDiscard() {
    discard()
    onClose()
  }

  // The grab pill rendered but did nothing. Same contract as the scrim: pulling
  // the sheet down cancels the take.
  const { handlers: dragHandlers, dragY, dragging } = useSheetDismiss({
    onDismiss: handleCancel,
    enabled: isMobile,
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
      <div className="command-popover__scrim" onClick={handleCancel} aria-hidden />
      <div
        className={`voice-capture glass-surface${isMobile ? ' voice-capture--sheet' : ''}`}
        style={style}
        role="dialog"
        aria-label="Voice dictation"
        onMouseDown={(e) => e.stopPropagation()}
        {...(isMobile ? dragHandlers : {})}
      >
        <div className="glass-surface__glow" aria-hidden />
        {/* Pulling the handle down cancels the take — same as the scrim. */}
        {isMobile && <div className="command-popover__grab" aria-hidden />}

        <div className="voice-capture__body">
          {status === 'error' ? (
            <div className="voice-capture__error">
              <p className="voice-capture__error-msg">{error}</p>
              {hasRecording ? (
                // Transcription failed but the audio is safe — never make the
                // user re-speak. Offer retry, salvage the partial, or save the clip.
                <>
                  {partial && (
                    <p className="voice-capture__partial voice-capture__partial--salvage">{partial}</p>
                  )}
                  <p className="voice-capture__reassure">Your recording is saved — nothing is lost.</p>
                  <div className="voice-capture__error-actions">
                    <button
                      type="button"
                      className="btn voice-capture__done"
                      onClick={() => void handleRetry()}
                    >
                      Retry
                    </button>
                    {partial.trim() && (
                      <button type="button" className="btn btn--ghost" onClick={handleInsertPartial}>
                        Insert what we have
                      </button>
                    )}
                    <button type="button" className="btn btn--ghost" onClick={saveAudio}>
                      Save audio
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={handleDiscard}>
                      Discard
                    </button>
                  </div>
                </>
              ) : (
                // No recording captured (e.g. mic permission denied) — re-record.
                <div className="voice-capture__actions">
                  <button type="button" className="btn btn--ghost" onClick={handleCancel}>
                    Close
                  </button>
                  <button type="button" className="btn" onClick={() => void start()}>
                    Try again
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div
                ref={orbRef}
                className={`voice-orb voice-orb--${status}`}
                style={{ ['--level' as string]: '0' }}
                aria-hidden
              >
                <span className="voice-orb__halo" />
                <span className="voice-orb__core">
                  <MicGlyph />
                </span>
              </div>

              {partial ? (
                // The live caption: blurred while it's the provisional realtime
                // text (motion = "I'm hearing you", without inviting you to judge
                // exact words it'll get slightly wrong). The authoritative pass on
                // Done renders sharp. Hidden from screen readers while blurred —
                // it's a liveness signal, not content to read.
                <p
                  ref={partialRef}
                  className={`voice-capture__partial${
                    partialIsLive ? ' voice-capture__partial--live' : ''
                  }`}
                  aria-hidden={partialIsLive || undefined}
                >
                  {partial}
                </p>
              ) : (
                <div className="voice-capture__wave" aria-hidden>
                  {Array.from({ length: BAR_COUNT }).map((_, i) => (
                    <span
                      key={i}
                      className="voice-capture__bar"
                      ref={(el) => {
                        if (el) barsRef.current[i] = el
                      }}
                    />
                  ))}
                </div>
              )}

              <p className="voice-capture__status">
                {status === 'transcribing' ? 'Finding your words…' : 'Listening'}
                {status === 'recording' && (
                  <span className="voice-capture__timer">{fmt(elapsedMs)}</span>
                )}
              </p>

              <div className="voice-capture__actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleCancel}
                  disabled={status === 'transcribing'}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn voice-capture__done"
                  onClick={handleDone}
                  disabled={status === 'transcribing'}
                >
                  {status === 'transcribing' ? 'Transcribing…' : 'Done'}
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

function MicGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  )
}
