// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SlashPalette } from './SlashPalette'
import type { SlashState } from './slashDetect'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => true,
  useTouchPrimary: () => true,
}))

const state: SlashState = {
  query: '',
  from: 0,
  to: 0,
  x: 0,
  y: 0,
  yTop: 0,
}

function fireTouch(el: Element, type: 'touchstart' | 'touchend', x: number, y: number) {
  const touch = { identifier: 1, target: el, clientX: x, clientY: y, pageX: x, pageY: y }
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(ev, {
    touches: type === 'touchend' ? [] : [touch],
    changedTouches: [touch],
  })
  el.dispatchEvent(ev)
}

describe('SlashPalette (touch sheet)', () => {
  let root: Root
  let host: HTMLDivElement

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  function mount(onSelect = vi.fn()) {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => {
      root.render(
        createElement(SlashPalette, {
          state,
          onSelect,
          onDismiss: () => {},
          onCancel: () => {},
        }),
      )
    })
    return onSelect
  }

  it('does not choose the row a scroll started on', () => {
    const onSelect = mount()
    const row = document.querySelector('.slash-palette__item')
    expect(row).toBeTruthy()
    act(() => {
      fireTouch(row!, 'touchstart', 40, 200)
      fireTouch(row!, 'touchend', 40, 140)
    })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('still chooses a row on a still tap', () => {
    const onSelect = mount()
    const row = document.querySelector('.slash-palette__item')
    expect(row).toBeTruthy()
    act(() => {
      fireTouch(row!, 'touchstart', 40, 200)
      fireTouch(row!, 'touchend', 42, 204)
    })
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
