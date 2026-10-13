// @vitest-environment jsdom
import { createElement, act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type Settings } from '@/lib/settings'
import { WritingControls } from './WritingControls'
import type { FocusMode } from './useFocusMode'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const noop = () => {}
const focusMode = (active: boolean): FocusMode => ({ active, enter: noop, exit: noop, toggle: noop })

function mount(active = true) {
  const update = vi.fn<(patch: Partial<Settings>) => void>()
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const render = (on: boolean) =>
    act(() =>
      root.render(
        createElement(WritingControls, { settings: DEFAULT_SETTINGS, update, focus: focusMode(on) }),
      ),
    )
  render(active)
  const cluster = () => host.querySelector<HTMLElement>('.focus-controls')!
  return { update, render, cluster, unmount: () => act(() => root.unmount()) }
}

// jsdom has no PointerEvent constructor; a MouseEvent of the right type carries
// the rest, and pointerType is pinned on.
function pointer(target: Element, type: string, pointerType: string) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true })
  Object.defineProperty(e, 'pointerType', { value: pointerType })
  act(() => {
    target.dispatchEvent(e)
  })
}

/** What a finger sends: the whole hover sequence at once, then the click. */
function tap(target: Element) {
  pointer(target, 'pointerover', 'touch')
  pointer(target, 'pointerdown', 'touch')
  pointer(target, 'pointerup', 'touch')
  pointer(target, 'pointerout', 'touch')
  act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

const pill = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll('.toggle-pill')].find((b) => b.textContent?.includes(label))!

afterEach(() => {
  document.body.innerHTML = ''
})

describe('WritingControls in focus mode', () => {
  it('starts folded', () => {
    const { cluster, unmount } = mount()
    expect(cluster().dataset.collapsed).toBe('true')
    unmount()
  })

  it('stays open under a finger while its pills are tapped', () => {
    const { cluster, update, unmount } = mount()
    tap(cluster().querySelector('.focus-controls__handle')!)
    expect(cluster().dataset.collapsed).toBe('false')
    tap(pill(cluster(), 'typewriter'))
    expect(update).toHaveBeenCalledWith({ typewriter: !DEFAULT_SETTINGS.typewriter })
    expect(cluster().dataset.collapsed).toBe('false')
    unmount()
  })

  it('folds when a finger goes back to the page', () => {
    const { cluster, unmount } = mount()
    tap(cluster().querySelector('.focus-controls__handle')!)
    pointer(document.body, 'pointerdown', 'touch')
    expect(cluster().dataset.collapsed).toBe('true')
    unmount()
  })

  it('still opens and folds on hover for a pointer', () => {
    const { cluster, unmount } = mount()
    pointer(cluster(), 'pointerover', 'mouse')
    expect(cluster().dataset.collapsed).toBe('false')
    pointer(cluster(), 'pointerout', 'mouse')
    expect(cluster().dataset.collapsed).toBe('true')
    unmount()
  })

  it('starts the next focus session folded, however the last was left', () => {
    const { cluster, render, unmount } = mount()
    tap(cluster().querySelector('.focus-controls__handle')!)
    render(false)
    render(true)
    expect(cluster().dataset.collapsed).toBe('true')
    unmount()
  })
})
