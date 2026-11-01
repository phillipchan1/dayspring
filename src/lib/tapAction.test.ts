// @vitest-environment jsdom
import { createElement, useState } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TAP_GUARD_MS,
  isOAuthCanceled,
  isPrimaryTapButton,
  isTouchLikePointer,
  useTapAction,
} from './tapAction'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Probe() {
  const [n, setN] = useState(0)
  const tap = useTapAction(() => setN((v) => v + 1))
  return createElement('button', { type: 'button', ...tap }, String(n))
}

function firePointer(
  el: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  pointerType: string,
  button = 0,
  at?: { x: number; y: number },
) {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(ev, { button, pointerType }, at ? { clientX: at.x, clientY: at.y } : {})
  el.dispatchEvent(ev)
}

/** A finger down and up in place. */
function tap(el: Element, pointerType = 'touch', button = 0) {
  firePointer(el, 'pointerdown', pointerType, button, { x: 20, y: 20 })
  firePointer(el, 'pointerup', pointerType, button, { x: 20, y: 20 })
}

describe('isOAuthCanceled', () => {
  it('treats a user-dismissed ASWebAuthenticationSession as a cancel', () => {
    expect(
      isOAuthCanceled(
        new Error(
          'The operation couldn’t be completed. (com.apple.AuthenticationServices.WebAuthenticationSession error 1.)',
        ),
      ),
    ).toBe(true)
    expect(isOAuthCanceled(new Error('The user canceled the operation.'))).toBe(true)
  })

  it('does not swallow a real present failure', () => {
    expect(isOAuthCanceled(new Error('Could not start in-app OAuth session'))).toBe(false)
    expect(isOAuthCanceled(new Error('No authorization code in OAuth callback'))).toBe(false)
  })
})

describe('isPrimaryTapButton / isTouchLikePointer', () => {
  it('accepts WebKit’s touch button = -1 and an empty pointerType', () => {
    expect(isPrimaryTapButton(0)).toBe(true)
    expect(isPrimaryTapButton(-1)).toBe(true)
    expect(isPrimaryTapButton(undefined)).toBe(true)
    expect(isPrimaryTapButton(2)).toBe(false)
    expect(isTouchLikePointer('')).toBe(true)
    expect(isTouchLikePointer('touch')).toBe(true)
    expect(isTouchLikePointer('pen')).toBe(true)
  })

  it('treats a mouse pointer on a touch device as a tap (iPadOS 26)', () => {
    expect(isTouchLikePointer('mouse', { maxTouchPoints: 5 })).toBe(true)
    expect(isTouchLikePointer('mouse', { maxTouchPoints: 1 })).toBe(true)
    expect(isTouchLikePointer('mouse', { coarse: true })).toBe(true)
  })

  it('treats a fine desktop mouse as a mouse', () => {
    expect(isTouchLikePointer('mouse', { maxTouchPoints: 0, coarse: false })).toBe(false)
  })
})

describe('useTapAction', () => {
  let host: HTMLDivElement

  afterEach(() => {
    vi.restoreAllMocks()
    host?.remove()
  })

  function mount() {
    host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    act(() => {
      root.render(createElement(Probe))
    })
    return { root, btn: host.querySelector('button')! }
  }

  it('waits for the release: touch pointerdown alone commits nothing', () => {
    const { root, btn } = mount()
    act(() => {
      firePointer(btn, 'pointerdown', 'touch', 0, { x: 20, y: 20 })
    })
    expect(btn.textContent).toBe('0')
    act(() => {
      firePointer(btn, 'pointerup', 'touch', 0, { x: 20, y: 20 })
    })
    expect(btn.textContent).toBe('1')
    act(() => root.unmount())
  })

  it('fires once for a touch tap and ignores the follow-up click', () => {
    const { root, btn } = mount()
    act(() => {
      tap(btn)
    })
    expect(btn.textContent).toBe('1')
    act(() => {
      btn.click()
    })
    expect(btn.textContent).toBe('1')
    act(() => root.unmount())
  })

  it('does not discard a first tap during the initial guard window', () => {
    vi.spyOn(performance, 'now').mockReturnValue(10)
    const { root, btn } = mount()
    act(() => {
      tap(btn)
    })
    expect(btn.textContent).toBe('1')
    act(() => root.unmount())
  })

  it('fires on iPadOS mouse pointerup when click never arrives', () => {
    const { root, btn } = mount()
    act(() => {
      firePointer(btn, 'pointerdown', 'mouse')
      btn.dispatchEvent(new Event('mouseenter', { bubbles: true }))
      btn.dispatchEvent(new Event('mouseleave', { bubbles: true }))
      firePointer(btn, 'pointerup', 'mouse')
    })
    expect(btn.textContent).toBe('1')
    act(() => root.unmount())
  })

  it('fires on mouseup when Pointer Events never arrive', () => {
    const { root, btn } = mount()
    act(() => {
      const up = new Event('mouseup', { bubbles: true, cancelable: true })
      Object.assign(up, { button: 0 })
      btn.dispatchEvent(up)
    })
    expect(btn.textContent).toBe('1')
    act(() => root.unmount())
  })

  it('fires on touchend (WKWebView with no Pointer Events)', () => {
    const { root, btn } = mount()
    act(() => {
      btn.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }))
    })
    expect(btn.textContent).toBe('1')
    act(() => root.unmount())
  })

  it('accepts a WebKit touch tap with button -1', () => {
    const { root, btn } = mount()
    act(() => {
      tap(btn, 'touch', -1)
    })
    expect(btn.textContent).toBe('1')
    act(() => root.unmount())
  })

  it('fires on a mouse click', () => {
    const { root, btn } = mount()
    act(() => {
      btn.click()
    })
    expect(btn.textContent).toBe('1')
    act(() => root.unmount())
  })

  it('does not let a lost click swallow the next tap', () => {
    const { root, btn } = mount()
    const t0 = 1_000
    vi.spyOn(performance, 'now').mockReturnValue(t0)
    act(() => {
      tap(btn)
    })
    expect(btn.textContent).toBe('1')
    vi.spyOn(performance, 'now').mockReturnValue(t0 + TAP_GUARD_MS + 1)
    act(() => {
      firePointer(btn, 'pointerup', 'mouse')
    })
    expect(btn.textContent).toBe('2')
    act(() => root.unmount())
  })
  it('lets go of a press that becomes a scroll (pointercancel, then touchend)', () => {
    const { root, btn } = mount()
    act(() => {
      firePointer(btn, 'pointerdown', 'touch', 0, { x: 20, y: 20 })
      firePointer(btn, 'pointercancel', 'touch')
      btn.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }))
    })
    expect(btn.textContent).toBe('0')
    act(() => root.unmount())
  })

  it('lets go of a finger that travels before it lifts', () => {
    const { root, btn } = mount()
    act(() => {
      firePointer(btn, 'pointerdown', 'touch', 0, { x: 20, y: 20 })
      firePointer(btn, 'pointermove', 'touch', 0, { x: 20, y: 60 })
      firePointer(btn, 'pointerup', 'touch', 0, { x: 20, y: 60 })
    })
    expect(btn.textContent).toBe('0')
    act(() => root.unmount())
  })

  it('still acts on a finger that wobbles a few px', () => {
    const { root, btn } = mount()
    act(() => {
      firePointer(btn, 'pointerdown', 'touch', 0, { x: 20, y: 20 })
      firePointer(btn, 'pointerup', 'touch', 0, { x: 24, y: 26 })
    })
    expect(btn.textContent).toBe('1')
    act(() => root.unmount())
  })

  it('never cancels a desktop mouse by travel — release over the button acts', () => {
    const { root, btn } = mount()
    act(() => {
      firePointer(btn, 'pointerdown', 'mouse', 0, { x: 0, y: 0 })
      firePointer(btn, 'pointermove', 'mouse', 0, { x: 0, y: 40 })
      firePointer(btn, 'pointerup', 'mouse', 0, { x: 0, y: 40 })
    })
    expect(btn.textContent).toBe('1')
    act(() => root.unmount())
  })

  it('keyboard activation acts even right after a cancelled scroll', () => {
    const { root, btn } = mount()
    act(() => {
      firePointer(btn, 'pointerdown', 'touch', 0, { x: 20, y: 20 })
      firePointer(btn, 'pointercancel', 'touch')
      btn.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }))
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    })
    expect(btn.textContent).toBe('1')
    act(() => root.unmount())
  })

  it('a cancelled scroll does not swallow a later press whose down was lost', () => {
    const { root, btn } = mount()
    const t0 = 1_000
    vi.spyOn(performance, 'now').mockReturnValue(t0)
    act(() => {
      firePointer(btn, 'pointerdown', 'touch', 0, { x: 20, y: 20 })
      firePointer(btn, 'pointercancel', 'touch')
      btn.dispatchEvent(new Event('touchend', { bubbles: true, cancelable: true }))
    })
    expect(btn.textContent).toBe('0')
    vi.spyOn(performance, 'now').mockReturnValue(t0 + TAP_GUARD_MS + 1)
    act(() => {
      firePointer(btn, 'pointerup', 'mouse')
    })
    expect(btn.textContent).toBe('1')
    act(() => root.unmount())
  })
})
