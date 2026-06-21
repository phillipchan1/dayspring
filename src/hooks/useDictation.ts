import { useCallback, useEffect, useRef, useState } from 'react'
import { streamTranscribe } from '@/lib/transcribeClient'
import { startLiveCaptions, type LiveCaptions } from '@/lib/realtimeDictation'
import { dictationCheckpoint, dictationDelete } from '@/lib/db'
import { useSession } from './useSession'

export type DictationStatus = 'idle' | 'recording' | 'transcribing' | 'error'

export interface Dictation {
  status: DictationStatus
  error: string | null
  /** Elapsed recording time in ms (updates a few times a second). */
  elapsedMs: number
  /** The transcript so far, filling in live while status is 'transcribing'. */
  partial: string
  /** Live mic loudness, 0..1. Read in a rAF loop for smooth visuals. */
  levelRef: React.MutableRefObject<number>
  /** True once audio has been captured — the error UI then offers retry/save
   *  instead of forcing a re-record. */
  hasRecording: boolean
  /** Request the mic and begin recording. Pass vocab so live captions (if
   *  available) bias toward the writer's proper nouns from the first word. */
  start: (vocab?: string) => Promise<void>
  /** Stop recording and transcribe (with automatic retries). Resolves the text. */
  finish: (vocab?: string) => Promise<string>
  /** Re-transcribe the already-recorded audio after a failure — never re-records. */
  retry: (vocab?: string) => Promise<string>
  /** Download the recorded clip — the last-resort guarantee against losing words. */
  saveAudio: () => void
  /** Discard the recording and its persisted safety copy. */
  discard: () => void
  /** Stop + discard an in-progress recording. */
  cancel: () => void
  /** Return to idle after an error/success. */
  reset: () => void
}

// How often the growing recording is checkpointed to IndexedDB. MediaRecorder's
// timeslice drives both chunk capture and persistence.
const CHECKPOINT_MS = 15_000

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

/**
 * Voice dictation with a hard guarantee: once spoken, never lost. Audio is
 * checkpointed to IndexedDB as it records (survives a crash/close), transcription
 * retries on transient failures, and on a hard failure the recording is kept so
 * the user can retry, salvage the partial, or download the clip.
 */
export function useDictation(): Dictation {
  const { session } = useSession()
  const owner = session?.user?.id ?? null

  const [status, setStatus] = useState<DictationStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [partial, setPartial] = useState('')
  const [hasRecording, setHasRecording] = useState(false)

  const levelRef = useRef(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const createdAtRef = useRef(0)
  const mimeRef = useRef('')
  const sessionIdRef = useRef<string | null>(null)
  const recordedBlobRef = useRef<Blob | null>(null)
  // Live captions (realtime transcription as you speak). Best-effort: the handle
  // is null whenever live captions are unavailable or have been torn down.
  const liveRef = useRef<LiveCaptions | null>(null)
  // The latest live transcript, mirrored in a ref so transcribe() can read it
  // without a stale-closure dependency.
  const liveTextRef = useRef('')
  const ownerRef = useRef<string | null>(owner)
  ownerRef.current = owner

  const stopLive = useCallback(() => {
    try {
      liveRef.current?.close()
    } catch {
      /* already closed */
    }
    liveRef.current = null
  }, [])

  const teardownMedia = useCallback(() => {
    stopLive() // close the realtime socket before the AudioContext it taps
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (timerRef.current != null) clearInterval(timerRef.current)
    timerRef.current = null
    levelRef.current = 0
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close()
    }
    audioCtxRef.current = null
    recorderRef.current = null
  }, [stopLive])

  // Persist the complete accumulated recording so far (valid file across
  // containers; iOS mp4 can't be reassembled from partial chunks). Best-effort.
  const checkpoint = useCallback(async (state: 'recording' | 'recorded') => {
    const sid = sessionIdRef.current
    if (!sid || !ownerRef.current || chunksRef.current.length === 0) return
    const blob = new Blob(chunksRef.current, { type: mimeRef.current || 'audio/webm' })
    recordedBlobRef.current = blob
    try {
      await dictationCheckpoint({
        sessionId: sid,
        owner: ownerRef.current,
        mime: mimeRef.current || 'audio/webm',
        createdAt: createdAtRef.current,
        updatedAt: Date.now(),
        status: state,
        blob,
      })
    } catch {
      /* quota / idb error — the in-memory blob still covers the live session */
    }
  }, [])

  // Release the mic if the component unmounts mid-recording.
  useEffect(() => teardownMedia, [teardownMedia])

  // While recording, flush a chunk to persistence whenever the page is hidden
  // (app switch, screen lock) — iOS suspends pages, so capture before it does.
  useEffect(() => {
    if (status !== 'recording') return
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        try {
          recorderRef.current?.requestData()
        } catch {
          /* not recording */
        }
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [status])

  const start = useCallback(async (vocab?: string) => {
    setError(null)
    setElapsedMs(0)
    setPartial('')
    setHasRecording(false)
    liveTextRef.current = ''
    chunksRef.current = []
    recordedBlobRef.current = null
    sessionIdRef.current = crypto.randomUUID()
    createdAtRef.current = Date.now()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream

      const mime = pickMimeType()
      mimeRef.current = mime
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
          void checkpoint('recording')
        }
      }
      recorder.onerror = () => {
        // Mic interrupted (a call, a hardware hiccup). Salvage what we captured.
        teardownMedia()
        void checkpoint('recorded')
        setHasRecording(chunksRef.current.length > 0)
        setStatus('error')
        setError('Recording was interrupted — your audio is saved')
      }
      // Timeslice drives periodic ondataavailable → persistence checkpoints.
      recorder.start(CHECKPOINT_MS)
      recorderRef.current = recorder

      // Loudness metering for the live waveform.
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      const buf = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) {
          const v = ((buf[i] ?? 128) - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / buf.length)
        levelRef.current = levelRef.current * 0.6 + Math.min(1, rms * 2.2) * 0.4
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)

      startedAtRef.current = performance.now()
      timerRef.current = window.setInterval(() => {
        setElapsedMs(performance.now() - startedAtRef.current)
      }, 200)

      setStatus('recording')

      // Live captions — additive feel on top of the durable recording. Tap the
      // same mic stream + AudioContext to stream the transcript as the user
      // speaks. Fully best-effort: any failure (token, socket, old browser) just
      // means no live text; the recorded clip is still transcribed on Done.
      startLiveCaptions({
        stream,
        audioContext: ctx,
        ...(vocab ? { vocab } : {}),
        onText: (t) => {
          liveTextRef.current = t
          setPartial(t)
        },
      })
        .then((handle) => {
          // Recording may have already stopped while the socket was opening.
          if (streamRef.current === stream) liveRef.current = handle
          else handle.close()
        })
        .catch(() => {
          /* no live captions this session — silent, non-fatal */
        })
    } catch (e) {
      teardownMedia()
      setStatus('error')
      const name = e instanceof DOMException ? e.name : ''
      setError(
        name === 'NotAllowedError'
          ? 'Microphone access denied'
          : name === 'NotFoundError'
            ? 'No microphone found'
            : 'Could not start recording',
      )
    }
  }, [checkpoint, teardownMedia])

  // Shared transcription path: used by finish() and retry(). Streams the partial
  // in, retries transient failures, and only deletes the safety copy on success.
  const transcribe = useCallback(async (vocab?: string): Promise<string> => {
    const blob = recordedBlobRef.current
    if (!blob) return ''
    setStatus('transcribing')
    setError(null)
    // If live captions already filled the sheet, leave that text on screen and
    // let the authoritative pass run silently underneath — swapping in the tidied
    // result only at the end avoids a jarring shrink-then-regrow. Without live
    // captions, stream the final pass in as before so the sheet still fills live.
    const hadLive = liveTextRef.current.trim().length > 0
    if (!hadLive) setPartial('')
    try {
      const { text } = await streamTranscribe(blob, {
        ...(hadLive ? {} : { onDelta: setPartial }),
        ...(vocab ? { vocab } : {}),
      })
      // The words are about to land in the entry — drop the persisted copy.
      const sid = sessionIdRef.current
      if (sid) void dictationDelete(sid)
      setStatus('idle')
      setPartial('')
      setHasRecording(false)
      return text
    } catch (e) {
      // Keep the recording (and its IndexedDB copy) so retry / salvage / save work.
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Transcription failed')
      throw e
    }
  }, [])

  const finish = useCallback(
    async (vocab?: string): Promise<string> => {
      const recorder = recorderRef.current
      if (!recorder) {
        // Already stopped (e.g. via an interruption) — transcribe what we have.
        return recordedBlobRef.current ? transcribe(vocab) : ''
      }
      const blob = await new Promise<Blob>((resolve) => {
        const assemble = () => new Blob(chunksRef.current, { type: mimeRef.current || 'audio/webm' })
        recorder.onstop = () => resolve(assemble())
        try {
          recorder.stop()
        } catch {
          resolve(assemble())
        }
      })
      recordedBlobRef.current = blob
      setHasRecording(true)
      teardownMedia()
      await checkpoint('recorded') // ensure the full clip is on disk before the network
      return transcribe(vocab)
    },
    [checkpoint, teardownMedia, transcribe],
  )

  const retry = useCallback((vocab?: string) => transcribe(vocab), [transcribe])

  const saveAudio = useCallback(() => {
    const blob = recordedBlobRef.current
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const stamp = new Date(createdAtRef.current || Date.now())
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-')
    const ext = mimeRef.current.includes('mp4') || mimeRef.current.includes('aac') ? 'm4a' : 'webm'
    const a = document.createElement('a')
    a.href = url
    a.download = `dictation-${stamp}.${ext}`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }, [])

  const discard = useCallback(() => {
    stopLive()
    const sid = sessionIdRef.current
    if (sid) void dictationDelete(sid)
    recordedBlobRef.current = null
    chunksRef.current = []
    liveTextRef.current = ''
    setStatus('idle')
    setError(null)
    setElapsedMs(0)
    setPartial('')
    setHasRecording(false)
  }, [stopLive])

  const cancel = useCallback(() => {
    try {
      recorderRef.current?.stop()
    } catch {
      /* already stopped */
    }
    teardownMedia()
    discard()
  }, [teardownMedia, discard])

  const reset = useCallback(() => {
    liveTextRef.current = ''
    setStatus('idle')
    setError(null)
    setElapsedMs(0)
    setPartial('')
  }, [])

  return {
    status,
    error,
    elapsedMs,
    partial,
    levelRef,
    hasRecording,
    start,
    finish,
    retry,
    saveAudio,
    discard,
    cancel,
    reset,
  }
}
