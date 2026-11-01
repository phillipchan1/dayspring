// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PushStack, type PushDirection } from './PushStack'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root

function motion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
}

beforeEach(() => {
  motion(false)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function show(key: string, direction: PushDirection) {
  act(() => {
    root.render(createElement(PushStack, { screenKey: key, direction }, createElement('p', null, key)))
  })
}

const layers = () =>
  [...host.querySelectorAll<HTMLElement>('.ob-push__layer')].map((el) => ({
    text: el.textContent,
    role: el.dataset.role,
    enter: el.dataset.enter,
    leave: el.dataset.leave,
  }))

describe('PushStack', () => {
  it('arrives on its first screen without a push', () => {
    show('fork', 'forward')
    expect(layers()).toEqual([{ text: 'fork', role: 'current', enter: 'appear', leave: undefined }])
  })

  // The old screen stays up, leaving, so there is never a frame with neither.
  it('pushes forward with the old screen still on its way out', () => {
    show('fork', 'forward')
    show('fresh', 'forward')
    expect(layers()).toEqual(
      expect.arrayContaining([
        { text: 'fresh', role: 'current', enter: 'forward', leave: undefined },
        { text: 'fork', role: 'leaving', enter: undefined, leave: 'forward' },
      ]),
    )
  })

  it('pops back the other way', () => {
    show('fresh', 'forward')
    show('fork', 'back')
    const leaving = layers().find((l) => l.role === 'leaving')
    expect(leaving).toEqual({ text: 'fresh', role: 'leaving', enter: undefined, leave: 'back' })
  })

  it('lets the old screen go once its animation has ended', () => {
    show('fork', 'forward')
    show('fresh', 'forward')
    const leaving = host.querySelector<HTMLElement>('[data-role="leaving"]')!
    act(() => {
      // jsdom has no AnimationEvent, so React listens for the prefixed name.
      leaving.dispatchEvent(new Event('animationend', { bubbles: true }))
      leaving.dispatchEvent(new Event('webkitAnimationEnd', { bubbles: true }))
    })
    expect(layers().map((l) => l.text)).toEqual(['fresh'])
  })

  // Reduce Motion: a crossfade, so a step still reads as a change of place.
  it('crossfades under Reduce Motion', () => {
    motion(true)
    show('fork', 'forward')
    show('fresh', 'forward')
    expect(layers().find((l) => l.role === 'current')?.enter).toBe('fade')
    expect(layers().find((l) => l.role === 'leaving')?.leave).toBe('fade')
  })
})
