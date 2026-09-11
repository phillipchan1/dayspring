// @vitest-environment jsdom
import { createElement, useState } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  TAP_GUARD_MS,
  isOAuthCanceled,
  isPrimaryTapButton,
  shouldCommitOnPointerDown,
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
  type: 'pointerdown' | 'pointerup',
  pointerType: string,
  button = 0,
) {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(ev, { button, pointerType })
  el.dispatchEvent(ev)
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

describe('isPrimaryTapButton / shouldCommitOnPointerDown', () => {
  it('accepts WebKit’s touch button = -1 and an empty pointerType', () => {
    expect(isPrimaryTapButton(0)).toBe(true)
    expect(isPrimaryTapButton(-1)).toBe(true)
    expect(isPrimaryTapButton(undefined)).toBe(true)
    expect(isPrimaryTapButton(2)).toBe(false)
    expect(shouldCommitOnPointerDown('')).toBe(true)
    expect(shouldCommitOnPointerDown('touch')).toBe(true)
    expect(shouldCommitOnPointerDown('pen')).toBe(true)
  })

  it('treats a mouse pointer on a touch device as a tap (iPadOS 26)', () => {
    expect(shouldCommitOnPointerDown('mouse', { maxTouchPoints: 5 })).toBe(true)
    expect(shouldCommitOnPointerDown('mouse', { maxTouchPoints: 1 })).toBe(true)
    expect(shouldCommitOnPointerDown('mouse', { coarse: true })).toBe(true)
  })

  it('does not commit pointerdown for a fine desktop mouse', () => {
    expect(shouldCommitOnPointerDown('mouse', { maxTouchPoints: 0, coarse: false })).toBe(false)
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

  it('fires once for touch pointerdown and ignores the follow-up click', () => {
    const { root, btn } = mount()
    act(() => {
      firePointer(btn, 'pointerdown', 'touch')
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
      firePointer(btn, 'pointerdown', 'touch')
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

  it('accepts WebKit touch pointerdown with button -1', () => {
    const { root, btn } = mount()
    act(() => {
      firePointer(btn, 'pointerdown', 'touch', -1)
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
      firePointer(btn, 'pointerdown', 'touch')
    })
    expect(btn.textContent).toBe('1')
    vi.spyOn(performance, 'now').mockReturnValue(t0 + TAP_GUARD_MS + 1)
    act(() => {
      firePointer(btn, 'pointerup', 'mouse')
    })
    expect(btn.textContent).toBe('2')
    act(() => root.unmount())
  })
})
