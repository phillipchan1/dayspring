import { describe, expect, it } from 'vitest'
import { GHOST_CLICK_MS, isGhostClick } from './ghostClick'

describe('isGhostClick', () => {
  const opened = 1_000_000

  it('treats the iOS 300ms synthesized click as the opening tap', () => {
    expect(isGhostClick(opened, opened + 300)).toBe(true)
    expect(isGhostClick(opened, opened + GHOST_CLICK_MS - 1)).toBe(true)
  })

  it('lets a later tap through', () => {
    expect(isGhostClick(opened, opened + GHOST_CLICK_MS)).toBe(false)
    expect(isGhostClick(opened, opened + 800)).toBe(false)
  })
})
