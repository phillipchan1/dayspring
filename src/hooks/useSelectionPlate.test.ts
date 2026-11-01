// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PillSet } from '@/components/PillSet'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/*
 * jsdom has no layout, so give every option a place: 50px apart, 40px wide.
 */
const geometry = {
  offsetLeft() {
    return Array.prototype.indexOf.call(this.parentElement?.children ?? [], this) * 50
  },
  offsetTop: () => 3,
  offsetWidth: () => 40,
  offsetHeight: () => 26,
} as Record<string, (this: HTMLElement) => number>
const saved: Record<string, PropertyDescriptor | undefined> = {}

let host: HTMLDivElement
let root: Root
let frames: FrameRequestCallback[]

beforeEach(() => {
  for (const [k, get] of Object.entries(geometry)) {
    saved[k] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)
    Object.defineProperty(HTMLElement.prototype, k, { configurable: true, get })
  }
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  for (const [k, d] of Object.entries(saved)) {
    if (d) Object.defineProperty(HTMLElement.prototype, k, d)
  }
  vi.unstubAllGlobals()
})

const OPTIONS = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
] as const

function show(value: 'week' | 'month' | 'year' | null) {
  act(() =>
    root.render(
      createElement(PillSet<'week' | 'month' | 'year'>, {
        options: [...OPTIONS],
        value,
        onChange: () => {},
        label: 'When',
      }),
    ),
  )
}

const group = () => host.querySelector<HTMLElement>('.pill-set')!
const plate = () => ({
  state: group().dataset.plate,
  x: group().style.getPropertyValue('--plate-x'),
  w: group().style.getPropertyValue('--plate-w'),
})
const nextFrame = () =>
  act(() => {
    frames.splice(0).forEach((f) => f(0))
  })

describe('useSelectionPlate (via PillSet)', () => {
  it('places the plate under the choice without sliding it in from the corner', () => {
    show('month')
    expect(plate()).toEqual({ state: 'still', x: '50px', w: '40px' })
    nextFrame()
    expect(plate().state).toBe('on')
  })

  it('slides to a new choice', () => {
    show('month')
    nextFrame()
    show('year')
    expect(plate()).toEqual({ state: 'on', x: '100px', w: '40px' })
  })

  it('fades away when nothing is chosen, and comes back in place', () => {
    show('week')
    nextFrame()
    show(null)
    expect(plate().state).toBe('none')
    show('year')
    expect(plate()).toEqual({ state: 'still', x: '100px', w: '40px' })
  })

  it('leaves the pills marked as before, so the plate is only ever an addition', () => {
    show('month')
    const pressed = [...host.querySelectorAll('.pill')].map((p) => p.getAttribute('aria-pressed'))
    expect(pressed).toEqual(['false', 'true', 'false'])
  })
})
