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

import { TAP_GUARD_MS } from '@/lib/tapAction'
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
    vi.restoreAllMocks()
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

  it('does not offer reopen while the in-app sheet is still opening', () => {
    mount()
    act(() => {
      firePointer(buttonNamed(host, 'Continue with Apple'), 'pointerdown', 'touch')
    })
    expect(host.textContent).toContain('Opening Apple')
    expect(host.textContent).not.toContain('Open again')
    expect(host.textContent).not.toContain('Cancel')
  })

  it('offers Open again and Cancel after the browser handoff', async () => {
    signInWithGoogle.mockReset()
    signInWithGoogle.mockResolvedValue('waiting-for-browser')
    mount()
    await act(async () => {
      firePointer(buttonNamed(host, 'Continue with Google'), 'pointerdown', 'touch')
      await Promise.resolve()
    })
    expect(host.textContent).toContain('Continue with Google in your browser.')
    expect(buttonNamed(host, 'Open again').getAttribute('aria-disabled')).not.toBe('true')
    expect(buttonNamed(host, 'Cancel').disabled).toBe(false)
    expect(buttonNamed(host, 'Continue with Apple').getAttribute('aria-disabled')).toBe('true')
  })

  it('cancels the waiting handoff and restores the buttons', async () => {
    signInWithGoogle.mockReset()
    signInWithGoogle.mockResolvedValue('waiting-for-browser')
    mount()
    await act(async () => {
      firePointer(buttonNamed(host, 'Continue with Google'), 'pointerdown', 'touch')
      await Promise.resolve()
    })
    act(() => {
      firePointer(buttonNamed(host, 'Cancel'), 'pointerdown', 'touch')
    })
    expect(buttonNamed(host, 'Continue with Google').getAttribute('aria-disabled')).not.toBe('true')
    expect(buttonNamed(host, 'Continue with Apple').getAttribute('aria-disabled')).not.toBe('true')
    expect(host.textContent).not.toContain('Open again')
    expect(host.textContent).not.toContain('Continue with Google in your browser.')
  })

  it('reopens the provider from the waiting state', async () => {
    signInWithGoogle.mockReset()
    signInWithGoogle.mockResolvedValue('waiting-for-browser')
    mount()
    await act(async () => {
      firePointer(buttonNamed(host, 'Continue with Google'), 'pointerdown', 'touch')
      await Promise.resolve()
    })
    expect(signInWithGoogle).toHaveBeenCalledTimes(1)
    const t0 = performance.now()
    vi.spyOn(performance, 'now').mockReturnValue(t0 + TAP_GUARD_MS + 1)
    await act(async () => {
      firePointer(buttonNamed(host, 'Open again'), 'pointerdown', 'touch')
      await Promise.resolve()
    })
    expect(signInWithGoogle).toHaveBeenCalledTimes(2)
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

  it('exposes a pasteable email field (no autocapitalize, real text input)', () => {
    mount()
    act(() => {
      firePointer(buttonNamed(host, 'Sign in with email'), 'pointerdown', 'touch')
    })
    const email = host.querySelector('input[type="email"]') as HTMLInputElement
    expect(email).toBeTruthy()
    expect(email.autocomplete).toBe('username')
    expect(email.getAttribute('autocapitalize')).toBe('none')
    expect(email.getAttribute('autocorrect')).toBe('off')
    expect(email.getAttribute('spellcheck')).toBe('false')
    expect(email.inputMode).toBe('email')
    expect(email.classList.contains('signin__input')).toBe(true)
  })

  it('reveals and hides the password from the eye control', () => {
    mount()
    act(() => {
      firePointer(buttonNamed(host, 'Sign in with email'), 'pointerdown', 'touch')
    })
    const field = host.querySelector('input[name="password"]') as HTMLInputElement
    expect(field.type).toBe('password')
    const show = host.querySelector('[aria-label="Show password"]') as HTMLButtonElement
    expect(show).toBeTruthy()
    act(() => {
      firePointer(show, 'pointerdown', 'touch')
    })
    expect(field.type).toBe('text')
    const hide = host.querySelector('[aria-label="Hide password"]') as HTMLButtonElement
    expect(hide).toBeTruthy()
    act(() => {
      firePointer(hide, 'pointerdown', 'touch')
    })
    expect(field.type).toBe('password')
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
