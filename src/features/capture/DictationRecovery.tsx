import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { PendingDictationRow } from '@/lib/db'
import { dictationDelete } from '@/lib/db'
import { streamTranscribe } from '@/lib/transcribeClient'
import './VoiceCapture.css'

interface Props {
  row: PendingDictationRow
  /** Insert the recovered transcript into the current entry. */
  onInsert: (text: string) => void
  /** Dismiss (recovered, saved, or discarded). */
  onDismiss: () => void
}

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'moments ago'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/**
 * Offered on reopen when a voice recording was captured but never transcribed
 * (a crash, a closed tab, an unrecovered failure). The audio was persisted to
 * IndexedDB as it recorded, so nothing spoken is lost — recover it into the
 * entry, save the clip, or discard.
 */
export function DictationRecovery({ row, onInsert, onDismiss }: Props) {
  const [phase, setPhase] = useState<'prompt' | 'recovering' | 'error'>('prompt')
  const [partial, setPartial] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function recover() {
    setPhase('recovering')
    setError(null)
    setPartial('')
    try {
      const { text } = await streamTranscribe(row.blob, { onDelta: setPartial })
      await dictationDelete(row.sessionId)
      const clean = text.trim()
      if (clean) onInsert(clean)
      onDismiss()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not transcribe the recording')
      setPhase('error')
    }
  }

  function saveAudio() {
    const url = URL.createObjectURL(row.blob)
    const ext = row.mime.includes('mp4') || row.mime.includes('aac') ? 'm4a' : 'webm'
    const a = document.createElement('a')
    a.href = url
    a.download = `dictation-${row.sessionId.slice(0, 8)}.${ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  async function discard() {
    await dictationDelete(row.sessionId)
    onDismiss()
  }

  function insertPartial() {
    const clean = partial.trim()
    if (clean) onInsert(clean)
    void discard()
  }

  return createPortal(
    <div className="dictation-recovery glass-surface" role="dialog" aria-label="Recover voice recording">
      <div className="glass-surface__glow" aria-hidden />
      <div className="dictation-recovery__body">
        {phase === 'recovering' ? (
          <>
            <p className="dictation-recovery__title">Recovering your recording…</p>
            {partial && <p className="voice-capture__partial">{partial}</p>}
            {partial.trim() && (
              <button type="button" className="btn btn--ghost" onClick={insertPartial}>
                Insert what we have
              </button>
            )}
          </>
        ) : phase === 'error' ? (
          <>
            <p className="dictation-recovery__title">{error}</p>
            <p className="voice-capture__reassure">Your recording is still saved — nothing is lost.</p>
            <div className="voice-capture__error-actions">
              <button type="button" className="btn voice-capture__done" onClick={() => void recover()}>
                Retry
              </button>
              {partial.trim() && (
                <button type="button" className="btn btn--ghost" onClick={insertPartial}>
                  Insert what we have
                </button>
              )}
              <button type="button" className="btn btn--ghost" onClick={saveAudio}>
                Save audio
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => void discard()}>
                Discard
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dictation-recovery__title">Unfinished voice recording</p>
            <p className="dictation-recovery__sub">
              Saved {ago(row.createdAt)} — recover it into this entry?
            </p>
            <div className="voice-capture__error-actions">
              <button type="button" className="btn voice-capture__done" onClick={() => void recover()}>
                Recover
              </button>
              <button type="button" className="btn btn--ghost" onClick={saveAudio}>
                Save audio
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => void discard()}>
                Discard
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
