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
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
/** Write, then let the settle land (it measures in the next frame). */
async function write(s: Settle | null) {
  s!.onWrite()
  await frame()
}
// jsdom has no PointerEvent constructor; a MouseEvent of the right type carries
// clientX/Y, and pointerType is pinned on for the touch case.
function pointer(type: string, init: MouseEventInit = {}, pointerType = 'mouse') {
  const e = new MouseEvent(type, { bubbles: true, ...init })
  Object.defineProperty(e, 'pointerType', { value: pointerType })
  return e
}
const move = (x: number, y: number, kind = 'mouse') =>
  window.dispatchEvent(pointer('pointermove', { clientX: x, clientY: y }, kind))
const esc = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

afterEach(() => {
  document.documentElement.removeAttribute('data-settled')
  document.body.innerHTML = ''
})

describe('useSettle', () => {
  it('settles on the first write', async () => {
    const { out, unmount } = mount()
    await write(out.settle)
    expect(settled()).toBe(true)
    unmount()
  })

  it('stays put while disabled', async () => {
    const { out, unmount } = mount(false)
    await write(out.settle)
    expect(settled()).toBe(false)
    unmount()
  })

  it('ignores a nudge and wakes on a deliberate move', async () => {
    const { out, unmount } = mount()
    await write(out.settle)
    move(100, 100) // marks where the pointer rests
    move(100 + WAKE_DISTANCE_PX - 4, 100)
    expect(settled()).toBe(true)
    move(100 + WAKE_DISTANCE_PX + 4, 100)
    expect(settled()).toBe(false)
    unmount()
  })

  it('does not take a finger scrolling the page for a reach', async () => {
    const { out, unmount } = mount()
    await write(out.settle)
    move(100, 100, 'touch')
    move(100, 400, 'touch')
    expect(settled()).toBe(true)
    unmount()
  })

  it('wakes on a tap beside the page, not on a tap in the words', async () => {
    const { out, unmount } = mount()
    const words = document.createElement('div')
    words.className = 'cm-content'
    const margin = document.createElement('div')
    document.body.append(words, margin)
    await write(out.settle)
    words.dispatchEvent(pointer('pointerdown', {}, 'touch'))
    expect(settled()).toBe(true)
    margin.dispatchEvent(pointer('pointerdown', {}, 'touch'))
    expect(settled()).toBe(false)
    unmount()
  })

  it('wakes on Esc, unless an overlay owns the keyboard', async () => {
    const blocked = mount(true, true)
    await write(blocked.out.settle)
    esc()
    expect(settled()).toBe(true)
    blocked.render(true, false)
    esc()
    expect(settled()).toBe(false)
    blocked.unmount()
  })

  it('keeps the first Esc for itself, so it does not also leave the entry', async () => {
    const { out, unmount } = mount()
    let leaves = 0
    const leave = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leaves++
    }
    window.addEventListener('keydown', leave)
    await write(out.settle)
    esc()
    expect(settled()).toBe(false)
    expect(leaves).toBe(0)
    esc()
    expect(leaves).toBe(1)
    window.removeEventListener('keydown', leave)
    unmount()
  })

  it('wakes when the window is resized', async () => {
    const { out, unmount } = mount()
    await write(out.settle)
    window.dispatchEvent(new Event('resize'))
    expect(settled()).toBe(false)
    unmount()
  })

  it('wakes when it is switched off, and on unmount', async () => {
    const { out, render, unmount } = mount()
    await write(out.settle)
    render(false, false)
    expect(settled()).toBe(false)
    render(true, false)
    await write(out.settle)
    unmount()
    expect(settled()).toBe(false)
  })

  it('does not settle if woken before the frame lands', async () => {
    const { out, unmount } = mount()
    out.settle!.onWrite()
    out.settle!.wake()
    await frame()
    expect(settled()).toBe(false)
    unmount()
  })
})
