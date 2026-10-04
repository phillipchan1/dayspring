import { describe, expect, it, vi } from 'vitest'
import {
  createPhotoLookStore,
  LEARN_BUDGET,
  lookFromMetadata,
  PHOTO_LOOKS_KEY,
  type PhotoLookDeps,
  type StoredMeta,
} from './photoLooks'

const A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const C = 'c'.repeat(64)

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  }
}

function deps(rows: StoredMeta[], over: Partial<PhotoLookDeps> = {}): PhotoLookDeps & { read: ReturnType<typeof vi.fn> } {
  const read = vi.fn(async (_owner: string, hashes: string[]) => rows.filter((r) => hashes.includes(r.hash)))
  return {
    owner: async () => 'u1',
    read,
    measure: async () => null,
    write: async () => {},
    online: () => true,
    storage: null,
    ...over,
  } as PhotoLookDeps & { read: ReturnType<typeof vi.fn> }
}

const settle = () => new Promise((r) => setTimeout(r, 0))

describe('lookFromMetadata', () => {
  it('reads a colour and a shape, and trusts nothing else', () => {
    expect(lookFromMetadata({ color: '#aabbcc', width: 400, height: 300 })).toEqual({ color: '#aabbcc', ratio: 4 / 3 })
    expect(lookFromMetadata({ color: 'red', width: 0 })).toEqual({ color: null, ratio: null })
    expect(lookFromMetadata(null)).toEqual({ color: null, ratio: null })
  })
})

describe('photo look store', () => {
  it('reads stored colours in one batch for everything asked in a frame', async () => {
    const d = deps([
      { hash: A, metadata: { color: '#112233' } },
      { hash: B, metadata: { color: '#445566', width: 3, height: 2 } },
    ])
    const s = createPhotoLookStore(d)
    s.want([{ hash: A, ext: 'jpg' }])
    s.want([{ hash: B, ext: 'jpg' }, { hash: A, ext: 'jpg' }])
    await s.idle()
    expect(d.read).toHaveBeenCalledTimes(1)
    expect(s.get(A)?.color).toBe('#112233')
    expect(s.get(B)).toEqual({ color: '#445566', ratio: 1.5 })
  })

  it('never asks twice for a photo it has an answer for', async () => {
    const d = deps([{ hash: A, metadata: { color: '#112233' } }])
    const s = createPhotoLookStore(d)
    s.want([{ hash: A, ext: 'jpg' }])
    await s.idle()
    s.want([{ hash: A, ext: 'jpg' }])
    await s.idle()
    expect(d.read).toHaveBeenCalledTimes(1)
  })

  it('learns a missing colour from the photo and writes it back, keeping what was there', async () => {
    const write = vi.fn(async () => {})
    const d = deps([{ hash: A, metadata: { takenAt: '2019-03-01T10:00:00Z' } }], {
      measure: async () => '#abcdef',
      write,
    })
    const s = createPhotoLookStore(d)
    s.want([{ hash: A, ext: 'jpg' }])
    await s.idle()
    await settle()
    expect(s.get(A)?.color).toBe('#abcdef')
    expect(write).toHaveBeenCalledWith('u1', A, { takenAt: '2019-03-01T10:00:00Z', color: '#abcdef' })
  })

  it('learns no more than its budget in a session', async () => {
    const many = Array.from({ length: LEARN_BUDGET + 10 }, (_, i) => i.toString(16).padStart(64, '0'))
    const measure = vi.fn(async () => '#000000')
    const s = createPhotoLookStore(deps(many.map((hash) => ({ hash, metadata: {} })), { measure }))
    s.want(many.map((hash) => ({ hash, ext: 'jpg' })))
    await s.idle()
    for (let i = 0; i < 40; i++) await settle()
    expect(measure).toHaveBeenCalledTimes(LEARN_BUDGET)
  })

  it('reads nothing offline, and asks again once it can', async () => {
    let online = false
    const d = deps([{ hash: A, metadata: { color: '#112233' } }], { online: () => online })
    const s = createPhotoLookStore(d)
    s.want([{ hash: A, ext: 'jpg' }])
    await s.idle()
    expect(d.read).not.toHaveBeenCalled()
    online = true
    s.want([{ hash: A, ext: 'jpg' }])
    await s.idle()
    expect(s.get(A)?.color).toBe('#112233')
  })

  it('asks for nothing without a signed-in owner', async () => {
    const d = deps([{ hash: A, metadata: { color: '#112233' } }], { owner: async () => null })
    const s = createPhotoLookStore(d)
    s.want([{ hash: A, ext: 'jpg' }])
    await s.idle()
    expect(d.read).not.toHaveBeenCalled()
    expect(s.get(A)).toBeUndefined()
  })

  it("draws from the device's copy, but only its own owner's", async () => {
    const storage = memoryStorage({
      [PHOTO_LOOKS_KEY]: JSON.stringify({ owner: 'someone-else', looks: { [C]: ['#999999', null] } }),
    })
    const mine = createPhotoLookStore(deps([], { storage }))
    mine.want([{ hash: C, ext: 'jpg' }])
    await mine.idle()
    expect(mine.get(C)?.color).toBeNull()

    storage.map.set(PHOTO_LOOKS_KEY, JSON.stringify({ owner: 'u1', looks: { [C]: ['#999999', 1] } }))
    const d = deps([], { storage })
    const again = createPhotoLookStore(d)
    again.want([{ hash: C, ext: 'jpg' }])
    await again.idle()
    expect(again.get(C)).toEqual({ color: '#999999', ratio: 1 })
    expect(d.read).not.toHaveBeenCalled()
  })
})
