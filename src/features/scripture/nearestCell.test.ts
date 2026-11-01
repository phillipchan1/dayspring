import { describe, expect, it } from 'vitest'
import { nearestLit, type CellBox } from './nearestCell'

/** A row of 26px cells with 4px gaps, like the strip on a phone. */
function row(lit: number[], count = 8): CellBox[] {
  return Array.from({ length: count }, (_, i) => ({
    chapter: i + 1,
    left: i * 30,
    top: 0,
    width: 26,
    height: 26,
    lit: lit.includes(i + 1),
  }))
}

describe('nearestLit', () => {
  it('a tap inside a lit cell is that cell', () => {
    expect(nearestLit(5, 5, row([1, 2]))).toBe(1)
  })

  it('a tap on an unlit cell beside a lit one finds the lit one', () => {
    // Chapter 3 is lit (left 60); the tap is on chapter 2's square.
    expect(nearestLit(42, 13, row([3]))).toBe(3)
  })

  it('a tap in the gap goes to the nearer lit neighbour', () => {
    expect(nearestLit(27, 13, row([1, 2]))).toBe(1)
    expect(nearestLit(29.5, 13, row([1, 2]))).toBe(2)
  })

  it('a tap just above or below the strip still reaches (44pt reach, 26px glyph)', () => {
    expect(nearestLit(13, -8, row([1]))).toBe(1)
    expect(nearestLit(13, 34, row([1]))).toBe(1)
  })

  it('a tap beyond 44pt of any lit cell is nothing — no filter by accident', () => {
    expect(nearestLit(13 + 45, 13, row([1]))).toBeNull()
    expect(nearestLit(200, 13, row([1]))).toBeNull()
  })

  it('unlit cells are never a target', () => {
    expect(nearestLit(5, 5, row([]))).toBeNull()
  })
})
