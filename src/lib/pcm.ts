// Audio plumbing for live dictation captions. OpenAI's realtime transcription
// session accepts only 24kHz mono PCM16, but the browser's mic/AudioContext runs
// at its own rate (usually 44.1 or 48kHz) and hands us Float32 samples. These
// pure helpers bridge that gap: downsample → PCM16 → base64, ready to ship over
// the websocket. Kept separate (and pure) so the conversion is unit-testable
// without a live audio graph.

const TARGET_RATE = 24000

/**
 * Downsample mono Float32 audio to 24kHz by averaging the source samples that
 * fall into each output sample's window. Averaging (rather than dropping
 * samples) is a cheap low-pass that avoids the harsh aliasing of naive
 * decimation — good enough for speech. Returns the input unchanged when it's
 * already at (or below) 24kHz.
 */
export function downsampleTo24k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate <= TARGET_RATE) return input
  const ratio = inputRate / TARGET_RATE
  const outLength = Math.floor(input.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    let count = 0
    for (let j = start; j < end; j++) {
      sum += input[j] ?? 0
      count++
    }
    out[i] = count > 0 ? sum / count : 0
  }
  return out
}

/**
 * Convert Float32 samples in [-1, 1] to little-endian signed 16-bit PCM,
 * clamping out-of-range values so a loud peak can't wrap around to silence.
 */
export function floatToPCM16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0))
    // Asymmetric scaling: negative range is one step larger than positive.
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

/** Base64-encode raw bytes — works in the browser (btoa) and Node (Buffer). */
export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = ''
    // Chunk to stay clear of String.fromCharCode arg limits on long buffers.
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    return btoa(binary)
  }
  // Node fallback (tests).
  return Buffer.from(bytes).toString('base64')
}

/**
 * Full mic-chunk → wire payload: downsample to 24kHz, pack as PCM16, base64.
 * The string is ready to drop into a realtime `input_audio_buffer.append` event.
 */
export function encodePcmChunk(input: Float32Array, inputRate: number): string {
  const down = downsampleTo24k(input, inputRate)
  const pcm = floatToPCM16(down)
  return bytesToBase64(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength))
}
