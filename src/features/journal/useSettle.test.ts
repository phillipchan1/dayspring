// @vitest-environment jsdom
import { createElement, act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { useSettle, WAKE_DISTANCE_PX, type Settle } from './useSettle'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function mount(enabled = true, blockEsc = false) {
  const out: { settle: Settle | null } = { settle: null }
  const Probe = ({ e, b }: { e: boolean; b: boolean }) => {
    out.settle = useSettle(e, b)
    return null
  }
  const host = document.createElement('div')
  const root = createRoot(host)
  const render = (e: boolean, b: boolean) => act(() => root.render(createElement(Probe, { e, b })))
  render(enabled, blockEsc)
  return { out, render, unmount: () => act(() => root.unmount()) }
}

const settled = () => document.documentElement.hasAttribute('data-settled')
// jsdom has no PointerEvent constructor; a MouseEvent of the right type carries clientX/Y.
const move = (x: number, y: number) =>
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }))
const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

afterEach(() => document.documentElement.removeAttribute('data-settled'))

describe('useSettle', () => {
  it('settles on the first write', () => {
    const { out, unmount } = mount()
    out.settle!.onWrite()
    expect(settled()).toBe(true)
    unmount()
  })

  it('stays put while disabled', () => {
    const { out, unmount } = mount(false)
    out.settle!.onWrite()
    expect(settled()).toBe(false)
    unmount()
  })

  it('ignores a nudge and wakes on a deliberate move', () => {
    const { out, unmount } = mount()
    out.settle!.onWrite()
    move(100, 100) // marks where the pointer rests
    move(100 + WAKE_DISTANCE_PX - 4, 100)
    expect(settled()).toBe(true)
    move(100 + WAKE_DISTANCE_PX + 4, 100)
    expect(settled()).toBe(false)
    unmount()
  })

  it('wakes on Esc, unless an overlay owns the keyboard', () => {
    const blocked = mount(true, true)
    blocked.out.settle!.onWrite()
    esc()
    expect(settled()).toBe(true)
    blocked.render(true, false)
    esc()
    expect(settled()).toBe(false)
    blocked.unmount()
  })

  it('keeps the first Esc for itself, so it does not also leave the entry', () => {
    const { out, unmount } = mount()
    let leaves = 0
    const leave = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leaves++
    }
    window.addEventListener('keydown', leave)
    out.settle!.onWrite()
    esc()
    expect(settled()).toBe(false)
    expect(leaves).toBe(0)
    esc()
    expect(leaves).toBe(1)
    window.removeEventListener('keydown', leave)
    unmount()
  })

  it('wakes when it is switched off, and on unmount', () => {
    const { out, render, unmount } = mount()
    out.settle!.onWrite()
    render(false, false)
    expect(settled()).toBe(false)
    render(true, false)
    out.settle!.onWrite()
    unmount()
    expect(settled()).toBe(false)
  })
})
