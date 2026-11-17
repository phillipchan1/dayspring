// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { IDLE_AFTER_MS, isPresent, onPresenceResume, setLastInputAtForTest } = await import('./presence')

describe('presence', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true })
    setLastInputAtForTest(Date.now())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is present while visible and used recently, idle after IDLE_AFTER_MS without input', () => {
    expect(isPresent()).toBe(true)
    vi.advanceTimersByTime(IDLE_AFTER_MS - 1)
    expect(isPresent()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(isPresent()).toBe(false)
    window.dispatchEvent(new Event('keydown'))
    expect(isPresent()).toBe(true)
  })

  it('is never present while hidden', () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    expect(isPresent()).toBe(false)
  })

  it('fires resume on the first input after an idle stretch only — not on later input, not on focus', () => {
    const resumed = vi.fn()
    const off = onPresenceResume(resumed)
    window.dispatchEvent(new Event('pointerdown'))
    expect(resumed).not.toHaveBeenCalled() // still present: nothing to catch up on

    vi.advanceTimersByTime(IDLE_AFTER_MS)
    window.dispatchEvent(new Event('focus')) // focus has its own catch-up pull
    expect(resumed).not.toHaveBeenCalled()
    expect(isPresent()).toBe(true)

    vi.advanceTimersByTime(IDLE_AFTER_MS)
    window.dispatchEvent(new Event('pointerdown'))
    window.dispatchEvent(new Event('keydown'))
    expect(resumed).toHaveBeenCalledTimes(1)
    off()
  })
})
