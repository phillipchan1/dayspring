import { apiPostFormStream } from './api'

export interface TranscribeResult {
  /** Tidied text (the server's cleanup pass). */
  text: string
  /** Verbatim transcript before cleanup. */
  raw: string
}

export interface StreamTranscribeOpts {
  vocab?: string
  /** Called with the accumulating transcript so the UI can fill in live. */
  onDelta?: (partial: string) => void
  /** Max attempts before giving up on transient (network/5xx) failures. */
  maxAttempts?: number
  /** Base backoff between attempts in ms (multiplied by attempt index). */
  backoffMs?: number
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

function blobExt(mime: string): string {
  return mime.includes('mp4') || mime.includes('aac') ? 'mp4' : 'webm'
}

// apiPostFormStream throws `"<path> → <status> <body>"` on a non-2xx; a 4xx
// (auth, bad request) won't be fixed by retrying, so we surface it immediately.
function isFatal(message: string): boolean {
  return /→ 4\d\d/.test(message)
}

/**
 * Transcribe an audio blob via the streaming endpoint, RETRYING transient
 * failures with backoff — a dropped connection mid-dictation must never be the
 * end of the road. `onDelta` receives the accumulating transcript (reset at the
 * start of each attempt). Resolves with the tidied `text` + verbatim `raw`;
 * throws only after every attempt fails (or on a fatal 4xx).
 */
export async function streamTranscribe(
  blob: Blob,
  opts: StreamTranscribeOpts = {},
): Promise<TranscribeResult> {
  const { vocab, onDelta, maxAttempts = 3, backoffMs = 1500 } = opts
  const ext = blobExt(blob.type)
  let lastErr = 'Transcription failed'

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await sleep(attempt * backoffMs) // backoff grows per attempt

    const form = new FormData()
    form.append('audio', blob, `dictation.${ext}`)
    form.append('stream', 'true')
    if (vocab) form.append('vocab', vocab)

    let acc = ''
    let result: TranscribeResult | null = null
    let streamErr: string | null = null
    try {
      await apiPostFormStream('/api/transcribe', form, {
        onDelta: (d) => {
          acc += d
          onDelta?.(acc)
        },
        onFinal: (data) => {
          result = {
            text: typeof data.text === 'string' ? data.text : acc,
            raw: typeof data.raw === 'string' ? data.raw : acc,
          }
        },
        onError: (msg) => {
          streamErr = msg
        },
      })
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e)
      if (isFatal(lastErr)) throw new Error(lastErr)
      continue // transport/network error — retry
    }

    if (result) return result
    // Stream closed without a `final` event (server failed mid-stream, or the
    // connection dropped after some deltas). Retry.
    lastErr = streamErr ?? 'Transcription was interrupted'
  }

  throw new Error(lastErr)
}
