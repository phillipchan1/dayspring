// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { claimTransitionName, SPREAD_TRANSITION_NAME, withPageTransition } from './viewTransition'

const doc = document as unknown as { startViewTransition?: unknown }

afterEach(() => {
  delete doc.startViewTransition
  vi.unstubAllGlobals()
})

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (q: string) => ({ matches: reduce && q.includes('reduce'), media: q }) as MediaQueryList,
  )
}

describe('withPageTransition', () => {
  // The navigation is the point; the animation is the garnish. Every fallback
  // path here exists so a missing or unhappy API never means a dead click.
  it('still navigates when the browser has no view transitions', () => {
    stubReducedMotion(false)
    const update = vi.fn()
    withPageTransition(update)
    expect(update).toHaveBeenCalledOnce()
  })

  it('uses the API when it is there', () => {
    stubReducedMotion(false)
    const update = vi.fn()
    doc.startViewTransition = vi.fn((cb: () => void) => {
      cb()
      return {}
    })
    withPageTransition(update)
    expect(doc.startViewTransition).toHaveBeenCalledOnce()
    expect(update).toHaveBeenCalledOnce()
  })

  it('navigates without animating when motion is reduced', () => {
    stubReducedMotion(true)
    const update = vi.fn()
    doc.startViewTransition = vi.fn()
    withPageTransition(update)
    expect(doc.startViewTransition).not.toHaveBeenCalled()
    expect(update).toHaveBeenCalledOnce()
  })

  it('navigates anyway when the API throws', () => {
    stubReducedMotion(false)
    const update = vi.fn()
    doc.startViewTransition = vi.fn(() => {
      throw new Error('a transition is already running')
    })
    withPageTransition(update)
    expect(update).toHaveBeenCalledOnce()
  })
})

describe('claimTransitionName', () => {
  it('stamps the element and hands back the release', () => {
    const el = document.createElement('div')
    const release = claimTransitionName(el)
    expect(el.style.viewTransitionName).toBe(SPREAD_TRANSITION_NAME)
    release()
    expect(el.style.viewTransitionName).toBe('')
  })

  // Windowing can unmount the card under us; a null claim has to be a no-op
  // rather than a crash on the way into the reader.
  it('is a safe no-op when the element has gone', () => {
    expect(() => claimTransitionName(null)()).not.toThrow()
  })
})
