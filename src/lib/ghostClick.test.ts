// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GHOST_CLICK_MS, isGhostClick, swallowClickThrough } from './ghostClick'

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

describe('swallowClickThrough', () => {
  let target: HTMLButtonElement
  let clicks: number

  beforeEach(() => {
    vi.useFakeTimers()
    clicks = 0
    target = document.createElement('button')
    target.addEventListener('click', () => clicks++)
    document.body.append(target)
  })

  afterEach(() => {
    target.remove()
    vi.useRealTimers()
  })

  const press = () => target.dispatchEvent(new Event('pointerdown', { bubbles: true }))
  const lift = () => target.dispatchEvent(new Event('pointerup', { bubbles: true }))
  const click = () => target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

  /** The menu's own dismiss: a capture listener on document, as the menus register it. */
  function dismissOn(pointerdown: () => void) {
    const onDown = () => {
      document.removeEventListener('pointerdown', onDown, true)
      swallowClickThrough()
    }
    document.addEventListener('pointerdown', onDown, true)
    pointerdown()
  }

  it('eats the click the dismissing tap leaves behind', () => {
    dismissOn(press)
    lift()
    click()
    expect(clicks).toBe(0)
  })

  it('eats only that one click', () => {
    dismissOn(press)
    lift()
    click()
    press()
    lift()
    click()
    expect(clicks).toBe(1)
  })

  it('lets the next tap through when the dismissing one never clicked (a drag)', () => {
    dismissOn(press)
    lift()
    vi.advanceTimersByTime(GHOST_CLICK_MS)
    click()
    expect(clicks).toBe(1)
  })

  it('lets go on a new press before any click', () => {
    dismissOn(press)
    press()
    click()
    expect(clicks).toBe(1)
  })

  it('lets a keyboard click through', () => {
    dismissOn(press)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    click()
    expect(clicks).toBe(1)
  })
})
