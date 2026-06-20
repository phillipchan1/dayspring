import { describe, it, expect, vi, beforeEach } from 'vitest'

// Shared queue of per-call behaviors for the mocked streaming POST.
const { calls } = vi.hoisted(() => ({
  calls: [] as Array<(h: {
    onDelta?: (d: string) => void
    onFinal?: (data: Record<string, unknown>) => void
    onError?: (m: string) => void
  }) => void | Promise<void>>,
}))

vi.mock('./api', () => ({
  apiPostFormStream: vi.fn(async (_path: string, _form: FormData, handlers) => {
    const behavior = calls.shift()
    if (!behavior) throw new Error('no behavior queued')
    await behavior(handlers)
  }),
}))

import { streamTranscribe } from './transcribeClient'
import { apiPostFormStream } from './api'

const audio = () => new Blob(['x'], { type: 'audio/webm' })
const NO_WAIT = { backoffMs: 0 as const }

beforeEach(() => {
  calls.length = 0
  vi.mocked(apiPostFormStream).mockClear()
})

describe('streamTranscribe robustness', () => {
  it('returns the final text on a clean first attempt', async () => {
    calls.push((h) => {
      h.onDelta?.('Hello')
      h.onFinal?.({ text: 'Hello.', raw: 'Hello' })
    })
    const r = await streamTranscribe(audio(), NO_WAIT)
    expect(r).toEqual({ text: 'Hello.', raw: 'Hello' })
    expect(apiPostFormStream).toHaveBeenCalledTimes(1)
  })

  it('retries a dropped connection and succeeds — never loses the dictation', async () => {
    calls.push(() => {
      throw new Error('/api/transcribe → 503 upstream') // transient network/5xx
    })
    calls.push((h) => h.onFinal?.({ text: 'Recovered.', raw: 'recovered' }))
    const r = await streamTranscribe(audio(), NO_WAIT)
    expect(r.text).toBe('Recovered.')
    expect(apiPostFormStream).toHaveBeenCalledTimes(2)
  })

  it('retries when the stream ends without a final event (mid-stream drop)', async () => {
    calls.push((h) => h.onError?.('stream interrupted')) // deltas but no final
    calls.push((h) => h.onFinal?.({ text: 'Second try.', raw: 'second try' }))
    const r = await streamTranscribe(audio(), NO_WAIT)
    expect(r.text).toBe('Second try.')
    expect(apiPostFormStream).toHaveBeenCalledTimes(2)
  })

  it('does NOT retry a fatal 4xx (auth/bad request)', async () => {
    calls.push(() => {
      throw new Error('/api/transcribe → 401 not authenticated')
    })
    await expect(streamTranscribe(audio(), NO_WAIT)).rejects.toThrow(/401/)
    expect(apiPostFormStream).toHaveBeenCalledTimes(1)
  })

  it('throws after exhausting all attempts (caller then salvages partial/audio)', async () => {
    for (let i = 0; i < 3; i++) {
      calls.push(() => {
        throw new Error('/api/transcribe → 503 still down')
      })
    }
    await expect(streamTranscribe(audio(), { ...NO_WAIT, maxAttempts: 3 })).rejects.toThrow(/503/)
    expect(apiPostFormStream).toHaveBeenCalledTimes(3)
  })

  it('feeds the accumulating transcript to onDelta', async () => {
    const seen: string[] = []
    calls.push((h) => {
      h.onDelta?.('Hey')
      h.onDelta?.(' there')
      h.onFinal?.({ text: 'Hey there.', raw: 'Hey there' })
    })
    await streamTranscribe(audio(), { ...NO_WAIT, onDelta: (p) => seen.push(p) })
    expect(seen).toEqual(['Hey', 'Hey there'])
  })
})
