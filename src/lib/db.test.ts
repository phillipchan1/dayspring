import { describe, expect, it } from 'vitest'
import { selectEvictions } from './db'

const MB = 1024 * 1024

describe('selectEvictions', () => {
  it('evicts nothing when the incoming blob fits under budget', () => {
    const metas = [
      { key: 'a', bytes: 10 * MB, lastAccessedAt: 1 },
      { key: 'b', bytes: 10 * MB, lastAccessedAt: 2 },
    ]
    expect(selectEvictions(metas, 100 * MB, 5 * MB)).toEqual([])
  })

  it('evicts least-recently-used first until the incoming blob fits', () => {
    const metas = [
      { key: 'newest', bytes: 40 * MB, lastAccessedAt: 300 },
      { key: 'oldest', bytes: 40 * MB, lastAccessedAt: 100 },
      { key: 'middle', bytes: 40 * MB, lastAccessedAt: 200 },
    ]
    // total 120MB, budget 100MB, incoming 30MB → must free ≥50MB → drop two oldest.
    expect(selectEvictions(metas, 100 * MB, 30 * MB)).toEqual(['oldest', 'middle'])
  })

  it('stops as soon as enough room is freed', () => {
    const metas = [
      { key: 'oldest', bytes: 60 * MB, lastAccessedAt: 100 },
      { key: 'newer', bytes: 10 * MB, lastAccessedAt: 200 },
    ]
    // total 70MB, budget 100MB, incoming 50MB → over by 20MB → dropping oldest (60MB) suffices.
    expect(selectEvictions(metas, 100 * MB, 50 * MB)).toEqual(['oldest'])
  })

  it('handles an empty cache', () => {
    expect(selectEvictions([], 100 * MB, 10 * MB)).toEqual([])
  })
})
