// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const signInWithApple = vi.fn()
const signInWithGoogle = vi.fn()
const signInWithEmail = vi.fn()

vi.mock('@/lib/auth', () => ({
  signInWithApple: () => signInWithApple(),
  signInWithGoogle: () => signInWithGoogle(),
  signInWithEmail: (email: string, password: string) => signInWithEmail(email, password),
}))

vi.mock('@/lib/platform', () => ({
  isIOSTauri: () => true,
  isMobileTauri: () => true,
  isTauri: () => true,
  isDesktopTauri: () => false,
}))

vi.mock('@/lib/openExternal', () => ({
  openExternal: vi.fn(),
}))

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
})

import { SignIn } from './SignIn'

function buttonNamed(host: HTMLElement, name: string): HTMLButtonElement {
  const btn = [...host.querySelectorAll('button')].find((el) =>
    (el.textContent ?? '').includes(name),
  )
  if (!btn) throw new Error(`no button named ${name}`)
  return btn as HTMLButtonElement
}

function firePointer(el: Element, type: 'pointerdown' | 'pointerup', pointerType: string) {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(ev, { button: 0, pointerType })
  el.dispatchEvent(ev)
}

function nativeInput(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('SignIn (iPad tap)', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    signInWithApple.mockReset()
    signInWithGoogle.mockReset()
    signInWithEmail.mockReset()
    signInWithApple.mockReturnValue(new Promise(() => {}))
    signInWithGoogle.mockReturnValue(new Promise(() => {}))
    signInWithEmail.mockReturnValue(new Promise(() => {}))
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  function mount() {
    act(() => {
      root.render(createElement(SignIn))
    })
  }

  it('offers Apple, Google, and email on iOS', () => {
    mount()
    expect(buttonNamed(host, 'Continue with Apple')).toBeTruthy()
    expect(buttonNamed(host, 'Continue with Google')).toBeTruthy()
    expect(buttonNamed(host, 'Sign in with email')).toBeTruthy()
  })

  it('starts Apple on a touch pointerdown (before the synthesized click)', () => {
    mount()
    const apple = buttonNamed(host, 'Continue with Apple')
    act(() => {
      firePointer(apple, 'pointerdown', 'touch')
    })
    expect(signInWithApple).toHaveBeenCalledTimes(1)
    expect(host.textContent).toContain('Opening…')
    expect(host.textContent).toContain('Opening Apple')
  })

  it('still starts Google after the iPad mouseenter/leave dance + click', () => {
    mount()
    const google = buttonNamed(host, 'Continue with Google')
    act(() => {
      google.dispatchEvent(new Event('mouseenter', { bubbles: true }))
      google.dispatchEvent(new Event('mouseleave', { bubbles: true }))
      google.click()
    })
    expect(signInWithGoogle).toHaveBeenCalledTimes(1)
  })

  it('keeps email tappable while OAuth is opening', () => {
    mount()
    act(() => {
      firePointer(buttonNamed(host, 'Continue with Apple'), 'pointerdown', 'touch')
    })
    const email = buttonNamed(host, 'Sign in with email')
    expect(email.disabled).toBe(false)
    act(() => {
      firePointer(email, 'pointerdown', 'touch')
    })
    expect(host.querySelector('input[type="email"]')).toBeTruthy()
    expect(host.querySelector('input[type="password"]')).toBeTruthy()
  })

  it('surfaces a present failure instead of hanging silently', async () => {
    signInWithApple.mockReset()
    signInWithApple.mockRejectedValue(new Error('Could not start in-app OAuth session'))
    mount()
    await act(async () => {
      firePointer(buttonNamed(host, 'Continue with Apple'), 'pointerdown', 'touch')
      await Promise.resolve()
    })
    expect(host.textContent).toContain('Could not start in-app OAuth session')
    expect(buttonNamed(host, 'Continue with Apple').getAttribute('aria-disabled')).not.toBe('true')
  })

  it('starts Google on iPadOS mouse pointerup when click is dropped', () => {
    mount()
    const google = buttonNamed(host, 'Continue with Google')
    act(() => {
      firePointer(google, 'pointerdown', 'mouse')
      google.dispatchEvent(new Event('mouseenter', { bubbles: true }))
      google.dispatchEvent(new Event('mouseleave', { bubbles: true }))
      firePointer(google, 'pointerup', 'mouse')
    })
    expect(signInWithGoogle).toHaveBeenCalledTimes(1)
    expect(host.textContent).toContain('Opening…')
    expect(host.textContent).toContain('Opening Google')
  })

  it('submits the review email path', async () => {
    signInWithEmail.mockReset()
    signInWithEmail.mockResolvedValue(undefined)
    mount()
    act(() => {
      firePointer(buttonNamed(host, 'Sign in with email'), 'pointerdown', 'touch')
    })
    const email = host.querySelector('input[type="email"]') as HTMLInputElement
    const password = host.querySelector('input[type="password"]') as HTMLInputElement
    act(() => {
      nativeInput(email, 'kai.chan.claw@gmail.com')
      nativeInput(password, 'review-password')
    })
    await act(async () => {
      host.querySelector('form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
      await Promise.resolve()
    })
    expect(signInWithEmail).toHaveBeenCalledWith('kai.chan.claw@gmail.com', 'review-password')
  })
})
