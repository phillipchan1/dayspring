import { apiPost } from './api'
import { encodePcmChunk } from './pcm'

// Live dictation captions: stream the microphone straight to OpenAI's realtime
// transcription session and surface the transcript as the user speaks. This is a
// FEEL layer only — additive on top of the bulletproof MediaRecorder capture. If
// anything here fails (token mint, websocket, an old browser), we tear down
// quietly and the user still gets the authoritative transcript from the recorded
// clip on Done. It must never throw into the recording path.

// Transcription sessions connect with the purpose-built transcription intent; the
// session itself (model, vocab prompt, VAD) is configured server-side and carried
// by the ephemeral secret, so nothing sensitive rides on the client.
const REALTIME_URL = 'wss://api.openai.com/v1/realtime?intent=transcription'

// ScriptProcessor buffer size — 4096 frames (~85ms at 48kHz) balances latency
// against the number of websocket frames we emit.
const BUFFER_SIZE = 4096

export interface LiveCaptions {
  /** Tear down audio capture + socket. Idempotent. */
  close: () => void
}

export interface LiveCaptionsOpts {
  /** The live mic stream (shared with MediaRecorder). */
  stream: MediaStream
  /** The AudioContext already running the loudness meter — reused, not closed. */
  audioContext: AudioContext
  /** Frequent proper nouns to bias transcription, same as the final pass. */
  vocab?: string
  /** Called with the full accumulating transcript whenever it grows. */
  onText: (transcript: string) => void
}

interface TokenResponse {
  value: string
  expiresAt: number
}

/**
 * Begin streaming live captions. Resolves once audio is flowing, or rejects if
 * the session couldn't be established — callers should catch and silently fall
 * back to recorded-clip transcription.
 */
export async function startLiveCaptions(opts: LiveCaptionsOpts): Promise<LiveCaptions> {
  const { stream, audioContext, vocab, onText } = opts

  // 1. Mint the short-lived client secret via our server (keeps the API key off
  //    the client and bakes in the writer's private vocabulary).
  const token = await apiPost<TokenResponse>('/api/realtime-token', vocab ? { vocab } : {})
  if (!token?.value) throw new Error('no realtime token')

  // 2. Open the websocket, authenticating with the ephemeral key via subprotocol
  //    (browsers can't set Authorization headers on a WebSocket).
  const ws = new WebSocket(REALTIME_URL, ['realtime', `openai-insecure-api-key.${token.value}`])

  // Transcript accumulation: each VAD segment streams `delta`s then a `completed`
  // with the authoritative segment text. We keep finished segments + the
  // in-progress one so the caption only ever grows forward.
  const committed: string[] = []
  let pending = ''
  const emit = () => {
    const parts = pending ? [...committed, pending] : committed
    onText(parts.join(' ').trim())
  }

  let source: MediaStreamAudioSourceNode | null = null
  let processor: ScriptProcessorNode | null = null
  let mute: GainNode | null = null
  let closed = false

  const close = () => {
    if (closed) return
    closed = true
    try {
      processor?.disconnect()
      source?.disconnect()
      mute?.disconnect()
    } catch {
      /* nodes already torn down */
    }
    processor = null
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      try {
        ws.close()
      } catch {
        /* already closing */
      }
    }
  }

  ws.addEventListener('message', (ev: MessageEvent) => {
    let msg: { type?: string; delta?: string; transcript?: string }
    try {
      msg = JSON.parse(typeof ev.data === 'string' ? ev.data : '')
    } catch {
      return
    }
    switch (msg.type) {
      case 'conversation.item.input_audio_transcription.delta':
        if (msg.delta) {
          pending += msg.delta
          emit()
        }
        break
      case 'conversation.item.input_audio_transcription.completed':
        // Authoritative text for the segment — prefer it over the accumulated deltas.
        committed.push((msg.transcript ?? pending).trim())
        pending = ''
        emit()
        break
      // Other events (segment, speech_started/stopped, session.*) are ignored:
      // captions are best-effort and the final pass is the source of truth.
    }
  })

  // Start piping mic audio once the socket is live.
  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      try {
        source = audioContext.createMediaStreamSource(stream)
        processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1)
        // A muted gain node lets the processor stay connected to the graph (so
        // onaudioprocess fires) without routing the mic to the speakers.
        mute = audioContext.createGain()
        mute.gain.value = 0
        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          if (closed || ws.readyState !== WebSocket.OPEN) return
          const input = e.inputBuffer.getChannelData(0)
          const audio = encodePcmChunk(input, audioContext.sampleRate)
          ws.send(JSON.stringify({ type: 'input_audio_buffer.append', audio }))
        }
        source.connect(processor)
        processor.connect(mute)
        mute.connect(audioContext.destination)
        resolve()
      } catch (e) {
        reject(e instanceof Error ? e : new Error('audio capture failed'))
      }
    }
    ws.addEventListener('open', onOpen, { once: true })
    ws.addEventListener('error', () => reject(new Error('realtime socket error')), { once: true })
  })

  return { close }
}
