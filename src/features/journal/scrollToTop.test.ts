import { describe, expect, it } from 'vitest'
import { scrollToTop } from './scrollToTop'

function node(scrollTop: number) {
  const calls: ScrollToOptions[] = []
  return {
    scrollTop,
    calls,
    scrollTo(options: ScrollToOptions) {
      calls.push(options)
      this.scrollTop = options.top ?? this.scrollTop
    },
  }
}

describe('scrollToTop', () => {
  it('sends every scrolled region home and leaves the rest alone', () => {
    const wall = node(840)
    const card = node(0)
    const moved = scrollToTop({ querySelectorAll: () => [card, wall] })
    expect(moved).toBe(true)
    expect(wall.calls).toEqual([{ top: 0, behavior: 'smooth' }])
    expect(card.calls).toEqual([])
  })

  it('reports nothing moved when already at the top', () => {
    const wall = node(0)
    expect(scrollToTop({ querySelectorAll: () => [wall] })).toBe(false)
    expect(wall.calls).toEqual([])
  })

  it('jumps instead of gliding when motion is reduced', () => {
    const wall = node(200)
    scrollToTop({ querySelectorAll: () => [wall] }, false)
    expect(wall.calls).toEqual([{ top: 0, behavior: 'auto' }])
  })

  it('tolerates no root', () => {
    expect(scrollToTop(null)).toBe(false)
  })
})
