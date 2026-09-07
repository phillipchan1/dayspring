import { describe, expect, it } from 'vitest'
import { SWIPE_MIN_PX, swipeTurn } from './swipeTurn'

describe('swipeTurn', () => {
  it('turns to the older page when the content is dragged left', () => {
    expect(swipeTurn(-120, 0)).toBe('older')
  })

  it('turns to the newer page when the content is dragged right', () => {
    // The wall runs newest-first, left to right — so rightward is backwards
    // toward today, and that has to match the arrows and the edges exactly.
    expect(swipeTurn(120, 0)).toBe('newer')
  })

  it('ignores a drag shorter than the minimum', () => {
    expect(swipeTurn(SWIPE_MIN_PX - 1, 0)).toBeNull()
    expect(swipeTurn(-(SWIPE_MIN_PX - 1), 0)).toBeNull()
  })

  it('takes a drag exactly at the minimum', () => {
    expect(swipeTurn(SWIPE_MIN_PX, 0)).toBe('newer')
  })

  it('loses to a scroll it is not clearly more horizontal than', () => {
    // A long fast read-scroll that wandered sideways. This is the case the
    // module exists for: turning here would lose the reader's place.
    expect(swipeTurn(80, 400)).toBeNull()
    expect(swipeTurn(-80, -400)).toBeNull()
  })

  it('takes a diagonal that is decisively horizontal', () => {
    expect(swipeTurn(-200, 60)).toBe('older')
  })

  it('is null on no movement', () => {
    expect(swipeTurn(0, 0)).toBeNull()
  })
})
