import { useCallback, useEffect, useRef, useState } from 'react'
import { apiPostForm } from '@/lib/api'

export type DictationStatus = 'idle' | 'recording' | 'transcribing' | 'error'

export interface Dictation {
  status: DictationStatus
  error: string | null
  /** Elapsed recording time in ms (updates a few times a second). */
  elapsedMs: number
  /** Live mic loudness, 0..1. Read in a rAF loop for smooth visuals — it does
   *  not trigger React re-renders. */
  levelRef: React.MutableRefObject<number>
  /** Request the mic and begin recording. */
  start: () => Promise<void>
  /** Stop recording, transcribe, and resolve the recognized text. */
  finish: (vocab?: string) => Promise<string>
  /** Stop and discard without transcribing. */
  cancel: () => void
  /** Return to idle after an error/success. */
  reset: () => void
}

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac']
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

/**
 * Voice dictation: capture a short audio clip with MediaRecorder, relay it to
 * `/api/transcribe`, and hand back the recognized text. A Web Audio analyser
 * exposes live loudness (`levelRef`) so the UI can breathe with the speaker.
 */
export function useDictation(): Dictation {
  const [status, setStatus] = useState<DictationStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [elapsedMs, setElapsedMs] = useState(0)

  const levelRef = useRef(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const mimeRef = useRef('')

  const teardown = useCallback(() => {
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
  }, [])

  // Always release the mic if the component unmounts mid-recording.
  useEffect(() => teardown, [teardown])

  const start = useCallback(async () => {
    setError(null)
    setElapsedMs(0)
    chunksRef.current = []
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream

      const mime = pickMimeType()
      mimeRef.current = mime
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start()
      recorderRef.current = recorder

      // Loudness metering for the live waveform.
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
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
        // Ease toward the new level so the visual doesn't jitter.
        levelRef.current = levelRef.current * 0.6 + Math.min(1, rms * 2.2) * 0.4
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)

      startedAtRef.current = performance.now()
      timerRef.current = window.setInterval(() => {
        setElapsedMs(performance.now() - startedAtRef.current)
      }, 200)

      setStatus('recording')
    } catch (e) {
      teardown()
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
  }, [teardown])

  const finish = useCallback(
    async (vocab?: string): Promise<string> => {
      const recorder = recorderRef.current
      if (!recorder) return ''

      const blob = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunksRef.current, { type: mimeRef.current || 'audio/webm' }))
        }
        recorder.stop()
      })
      // Stop the mic + meters but keep state for the transcribing UI.
      teardown()
      setStatus('transcribing')

      try {
        const ext = (mimeRef.current.includes('mp4') || mimeRef.current.includes('aac')) ? 'mp4' : 'webm'
        const form = new FormData()
        form.append('audio', blob, `dictation.${ext}`)
        if (vocab) form.append('vocab', vocab)
        const { text } = await apiPostForm<{ text: string }>('/api/transcribe', form)
        setStatus('idle')
        return text
      } catch (e) {
        setStatus('error')
        setError(e instanceof Error ? e.message : 'Transcription failed')
        throw e
      }
    },
    [teardown],
  )

  const cancel = useCallback(() => {
    try {
      recorderRef.current?.stop()
    } catch {
      /* already stopped */
    }
    teardown()
    setStatus('idle')
    setError(null)
    setElapsedMs(0)
  }, [teardown])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setElapsedMs(0)
  }, [])

  return { status, error, elapsedMs, levelRef, start, finish, cancel, reset }
}
