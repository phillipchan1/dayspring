// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SlashPalette } from './SlashPalette'
import { itemAt, slashColumns } from './slashCommands'
import type { SlashState } from './slashDetect'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const media = vi.hoisted(() => ({ touch: true }))
vi.mock('@/hooks/useMediaQuery', () => ({
  useIsMobile: () => media.touch,
  useTouchPrimary: () => media.touch,
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

function firePointer(el: Element, type: 'mouseover' | 'mousemove', movement = 0) {
  const ev = new MouseEvent(type, { bubbles: true, cancelable: true })
  // jsdom doesn't take movementX/Y through MouseEventInit.
  Object.defineProperty(ev, 'movementX', { value: movement })
  Object.defineProperty(ev, 'movementY', { value: 0 })
  el.dispatchEvent(ev)
}

describe('SlashPalette (desktop pointer)', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    media.touch = false
  })

  afterEach(() => {
    media.touch = true
    act(() => root.unmount())
    host.remove()
  })

  function mount(onSelect = vi.fn(), onDismiss: () => void = () => {}) {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => {
      root.render(
        createElement(SlashPalette, {
          state,
          onSelect,
          onDismiss,
          onCancel: () => {},
        }),
      )
    })
    return onSelect
  }

  const rows = () => Array.from(document.querySelectorAll('.slash-palette__item'))
  const activeIndex = () => rows().findIndex((r) => r.getAttribute('data-active') === 'true')
  const pressEnter = () =>
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })

  it('opens with the first row as the Enter target', () => {
    mount()
    expect(activeIndex()).toBe(0)
  })

  it('ignores a pointer that was resting over a row when the palette opened', () => {
    const onSelect = mount()
    // What the browser reports when a row appears under a pointer nobody moved.
    act(() => {
      firePointer(rows()[3]!, 'mouseover')
      firePointer(rows()[3]!, 'mousemove', 0)
    })
    expect(activeIndex()).toBe(0)
    pressEnter()
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect.mock.calls[0]![0]).toEqual(itemAt(slashColumns(''), { col: 0, row: 0 })!.selection)
  })

  it('follows the pointer once it really moves', () => {
    mount()
    act(() => firePointer(rows()[3]!, 'mousemove', 4))
    expect(activeIndex()).toBe(3)
  })
})

describe('SlashPalette (desktop, native popover grammar)', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    media.touch = false
  })

  afterEach(() => {
    media.touch = true
    act(() => root.unmount())
    host.remove()
  })

  function mount(onSelect = vi.fn(), onDismiss = vi.fn()) {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => {
      root.render(createElement(SlashPalette, { state, onSelect, onDismiss, onCancel: () => {} }))
    })
    return { onSelect, onDismiss }
  }

  const rows = () => Array.from(document.querySelectorAll('.slash-palette__item'))
  const mouse = (el: EventTarget, type: string) =>
    act(() => {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }))
    })

  it('chooses on release, not on press', () => {
    const { onSelect } = mount()
    mouse(rows()[1]!, 'mousedown')
    expect(onSelect).not.toHaveBeenCalled()
    mouse(rows()[1]!, 'mouseup')
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('press, slide to another row, release: that row', () => {
    const { onSelect } = mount()
    mouse(rows()[0]!, 'mousedown')
    mouse(rows()[2]!, 'mouseup')
    expect(onSelect.mock.calls[0]![0]).toEqual(itemAt(slashColumns(''), { col: 0, row: 2 })!.selection)
  })

  it('a release that began outside the palette chooses nothing', () => {
    const { onSelect } = mount()
    mouse(rows()[1]!, 'mouseup')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('closes when the window loses focus', () => {
    const { onDismiss } = mount()
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(onDismiss).toHaveBeenCalled()
  })

  it('closes when the writer scrolls the page, not when the palette scrolls', () => {
    const { onDismiss } = mount()
    const palette = document.querySelector('.slash-palette')!
    act(() => {
      palette.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    })
    expect(onDismiss).not.toHaveBeenCalled()
    act(() => {
      document.body.dispatchEvent(new WheelEvent('wheel', { bubbles: true }))
    })
    expect(onDismiss).toHaveBeenCalled()
  })

  it('stays open while typing scrolls the caret into view', () => {
    const { onDismiss } = mount()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true }))
      document.dispatchEvent(new Event('scroll'))
    })
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
