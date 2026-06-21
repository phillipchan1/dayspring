import { describe, expect, it } from 'vitest'
import { bytesToBase64, downsampleTo24k, encodePcmChunk, floatToPCM16 } from './pcm'

describe('downsampleTo24k', () => {
  it('returns the input unchanged when already at or below 24kHz', () => {
    const input = new Float32Array([0.1, 0.2, 0.3])
    expect(downsampleTo24k(input, 24000)).toBe(input)
    expect(downsampleTo24k(input, 16000)).toBe(input)
  })

  it('halves the sample count from 48kHz, averaging each pair', () => {
    const input = new Float32Array([1, 1, 0, 0])
    const out = downsampleTo24k(input, 48000)
    expect(out.length).toBe(2)
    expect(out[0]).toBeCloseTo(1)
    expect(out[1]).toBeCloseTo(0)
  })
})

describe('floatToPCM16', () => {
  it('maps the full-scale range and clamps overshoot', () => {
    const out = floatToPCM16(new Float32Array([0, 1, -1, 2, -2]))
    expect(out[0]).toBe(0)
    expect(out[1]).toBe(32767) // +1 → max positive
    expect(out[2]).toBe(-32768) // -1 → max negative
    expect(out[3]).toBe(32767) // clamped from +2
    expect(out[4]).toBe(-32768) // clamped from -2
  })
})

describe('bytesToBase64', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 254, 255, 128])
    const b64 = bytesToBase64(bytes)
    const decoded = Uint8Array.from(Buffer.from(b64, 'base64'))
    expect(Array.from(decoded)).toEqual(Array.from(bytes))
  })
})

describe('encodePcmChunk', () => {
  it('produces base64 PCM16 at 24kHz (2 bytes per downsampled sample)', () => {
    // 8 samples @ 48kHz → 4 samples @ 24kHz → 8 bytes → ceil(8/3)*4 = 12 base64 chars.
    const input = new Float32Array([1, 1, -1, -1, 0, 0, 0.5, 0.5])
    const b64 = encodePcmChunk(input, 48000)
    const bytes = Buffer.from(b64, 'base64')
    expect(bytes.length).toBe(8)
    // First downsampled sample is +1 → 0x7fff little-endian → ff 7f.
    expect(bytes[0]).toBe(0xff)
    expect(bytes[1]).toBe(0x7f)
  })
})
