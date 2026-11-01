// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { decodeCaptured, pickPhotosNatively, scanPagesNatively, toFiles } from './nativeCapture'

/** Mirror of `encode` in src-tauri/src/ios_capture.rs. */
function encode(items: Array<[string, number[]]>): Uint8Array {
  const parts: number[] = []
  const u32 = (n: number) => parts.push(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff)
  u32(items.length)
  for (const [mime, body] of items) {
    const m = Array.from(new TextEncoder().encode(mime))
    u32(m.length)
    parts.push(...m)
    u32(body.length)
    parts.push(...body)
  }
  return Uint8Array.from(parts)
}

describe('decodeCaptured', () => {
  it('reads the native reply back into items, in order', () => {
    const reply = encode([
      ['image/jpeg', [0xff, 0xd8, 0xff]],
      ['image/png', [0x89, 0x50]],
    ])
    const items = decodeCaptured(reply.buffer as ArrayBuffer)
    expect(items.map((i) => i.mime)).toEqual(['image/jpeg', 'image/png'])
    expect(Array.from(items[0]!.bytes)).toEqual([0xff, 0xd8, 0xff])
    expect(Array.from(items[1]!.bytes)).toEqual([0x89, 0x50])
  })

  it('takes a plain number array too, and an empty (cancelled) reply', () => {
    expect(decodeCaptured(Array.from(encode([['image/gif', [1]]])))).toHaveLength(1)
    expect(decodeCaptured(encode([]))).toEqual([])
    expect(decodeCaptured(new Uint8Array())).toEqual([])
  })

  it('stops at a truncated item instead of reading past the end', () => {
    const whole = encode([
      ['image/jpeg', [1, 2, 3]],
      ['image/jpeg', [4, 5, 6]],
    ])
    expect(decodeCaptured(whole.slice(0, whole.length - 2))).toHaveLength(1)
  })
})

describe('toFiles', () => {
  it('makes files the web paths already accept, named so no alt text is guessed', () => {
    const [file] = toFiles([{ mime: 'image/jpeg', bytes: new Uint8Array([1, 2]) }], 'photo')
    expect(file!.name).toBe('photo_1.jpg')
    expect(file!.type).toBe('image/jpeg')
    expect(file!.size).toBe(2)
  })
})

describe('off the iOS app', () => {
  it('says there is no native path, so the web one runs', async () => {
    await expect(scanPagesNatively()).resolves.toBeNull()
    await expect(pickPhotosNatively()).resolves.toBeNull()
  })
})
