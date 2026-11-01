import { describe, expect, it } from 'vitest'
import { canStandAt } from './useSeatArrival'

describe('canStandAt', () => {
  it('is true once the page is tall enough to scroll that far', () => {
    expect(canStandAt(702, 1618, 714)).toBe(true) // 904 of travel
    expect(canStandAt(904, 1618, 714)).toBe(true) // exactly to the end
  })

  it('is false while the page is still a loader, shorter than where the reader stood', () => {
    expect(canStandAt(702, 974, 714)).toBe(false) // 260 of travel
    expect(canStandAt(905, 1618, 714)).toBe(false)
  })

  it('is always true for the top of the page', () => {
    expect(canStandAt(0, 300, 714)).toBe(true)
  })
})
