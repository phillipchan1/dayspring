import { describe, expect, it } from 'vitest'
import { nextIndex } from './useArrowList'

describe('nextIndex', () => {
  it('moves one row down and up', () => {
    expect(nextIndex(2, 'ArrowDown', 5)).toBe(3)
    expect(nextIndex(2, 'ArrowUp', 5)).toBe(1)
  })

  it('stops at the ends rather than wrapping, as a Mac list does', () => {
    expect(nextIndex(4, 'ArrowDown', 5)).toBe(4)
    expect(nextIndex(0, 'ArrowUp', 5)).toBe(0)
  })

  it('jumps to the ends on Home and End', () => {
    expect(nextIndex(2, 'Home', 5)).toBe(0)
    expect(nextIndex(2, 'End', 5)).toBe(4)
  })

  it('leaves every other key alone — Return belongs to the row, Esc to the surface', () => {
    expect(nextIndex(2, 'Enter', 5)).toBeNull()
    expect(nextIndex(2, 'Escape', 5)).toBeNull()
    expect(nextIndex(2, 'ArrowLeft', 5)).toBeNull()
  })

  it('has nowhere to go in an empty list', () => {
    expect(nextIndex(0, 'ArrowDown', 0)).toBeNull()
  })
})
