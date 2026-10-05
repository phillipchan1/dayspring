import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  arrivalLine,
  arrivalOf,
  beginArrivals,
  dropArrival,
  resetArrivalsForTest,
  setArrivalStage,
  settleArrival,
  settledPhoto,
  subscribeArrivals,
} from './photoArrival'

const blob = () => new Blob(['x'], { type: 'image/jpeg' })
const batch = (...ids: string[]) => beginArrivals(ids.map((id) => ({ id, file: blob() })))

beforeEach(() => {
  resetArrivalsForTest()
  let n = 0
  vi.stubGlobal('URL', { createObjectURL: () => `blob:local-${++n}`, revokeObjectURL: vi.fn() })
})

describe('arrivalLine', () => {
  it('counts through the batch the photos came in with', () => {
    batch('a', 'b', 'c')
    expect(arrivalLine(['a', 'b', 'c'])).toBe('Saving 1 of 3')
    setArrivalStage('a', 'sending')
    expect(arrivalLine(['a', 'b', 'c'])).toBe('Saving 1 of 3')
    settleArrival('a', 'hash-a.jpg')
    expect(arrivalLine(['b', 'c'])).toBe('Saving 2 of 3')
    setArrivalStage('b', 'preparing')
    expect(arrivalLine(['b', 'c'])).toBe('Saving 2 of 3')
  })

  it('does not count a photo on its own', () => {
    batch('a')
    expect(arrivalLine(['a'])).toBe('Saving…')
  })

  it('says so when every photo left is held for a connection', () => {
    batch('a', 'b')
    setArrivalStage('a', 'held')
    expect(arrivalLine(['a', 'b'])).toBe('Saving 2 of 2')
    setArrivalStage('b', 'held')
    expect(arrivalLine(['a', 'b'])).toBe('2 photos waiting for a connection')
    expect(arrivalLine(['a'])).toBe('1 photo waiting for a connection')
  })

  it('claims nothing about a placeholder it has never seen', () => {
    expect(arrivalLine(['from-another-session'])).toBe('1 photo still to save')
    expect(arrivalLine([])).toBeNull()
  })
})

describe('settling', () => {
  it('keeps the local picture under the saved photo’s key', () => {
    batch('a')
    const url = arrivalOf('a')!.url
    settleArrival('a', 'hash-a.jpg')
    expect(arrivalOf('a')).toBeUndefined()
    expect(settledPhoto('hash-a.jpg')?.url).toBe(url)
  })

  it('releases the picture of a photo that was never saved', () => {
    batch('a')
    const url = arrivalOf('a')!.url
    dropArrival('a')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
    expect(arrivalOf('a')).toBeUndefined()
  })

  it('tells the page only when a stage really changes', () => {
    batch('a')
    const heard = vi.fn()
    const stop = subscribeArrivals(heard)
    setArrivalStage('a', 'preparing')
    setArrivalStage('a', 'preparing')
    expect(heard).toHaveBeenCalledTimes(1)
    stop()
    setArrivalStage('a', 'sending')
    expect(heard).toHaveBeenCalledTimes(1)
  })
})
