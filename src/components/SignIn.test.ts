// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const signInWithApple = vi.fn()
const signInWithGoogle = vi.fn()
const signInWithEmail = vi.fn()
const signUpWithEmail = vi.fn()

vi.mock('@/lib/auth', () => ({
  signInWithApple: () => signInWithApple(),
  signInWithGoogle: () => signInWithGoogle(),
  signInWithEmail: (email: string, password: string) => signInWithEmail(email, password),
  signUpWithEmail: (email: string, password: string) => signUpWithEmail(email, password),
}))

// vi.hoisted runs before vi.mock's own hoisting, so this object exists before
// anything (including env.ts's eager, module-load-time isTauri() read) can
// observe it — a plain `let` above vi.mock would still be in its temporal
// dead zone at that point. Mutating its fields lets the web-email describe
// block below flip platform detection without a second module graph.
const platformMock = vi.hoisted(() => ({
  isIOSTauri: true,
  isMobileTauri: true,
  isTauri: true,
}))

vi.mock('@/lib/platform', () => ({
  isIOSTauri: () => platformMock.isIOSTauri,
  isMobileTauri: () => platformMock.isMobileTauri,
  isTauri: () => platformMock.isTauri,
  isDesktopTauri: () => platformMock.isTauri && !platformMock.isMobileTauri,
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
    signUpWithEmail.mockReset()
    signInWithApple.mockReturnValue(new Promise(() => {}))
    signInWithGoogle.mockReturnValue(new Promise(() => {}))
    signInWithEmail.mockReturnValue(new Promise(() => {}))
    signUpWithEmail.mockReturnValue(new Promise(() => {}))
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

  it('lets a guest dismiss the overlay and return to the journal', () => {
    const onDismiss = vi.fn()
    act(() => {
      root.render(createElement(SignIn, { onDismiss, reason: 'account' }))
    })
    expect(host.textContent).toMatch(/sync this journal/i)
    buttonNamed(host, 'Back to journal').click()
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('keeps brand copy and both auth stacks in the same card', () => {
    mount()
    const card = host.querySelector('.signin__card')
    expect(card?.querySelector('.signin__title')?.textContent).toBe('Dayspring')
    expect(card?.querySelector('.signin__actions')).toBeTruthy()
    expect(card?.querySelector('.signin__email')).toBeTruthy()
    act(() => {
      firePointer(buttonNamed(host, 'Sign in with email'), 'pointerdown', 'touch')
    })
    expect(card?.querySelector('.signin__form')).toBeTruthy()
    expect(card?.querySelectorAll('.signin__input').length).toBe(2)
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

  it('toggles to account creation and submits signUpWithEmail', async () => {
    signUpWithEmail.mockReset()
    signUpWithEmail.mockResolvedValue({ needsConfirmation: false })
    mount()
    act(() => {
      firePointer(buttonNamed(host, 'Sign in with email'), 'pointerdown', 'touch')
    })
    act(() => {
      buttonNamed(host, 'New here? Create an account').click()
    })
    expect(buttonNamed(host, 'Create account')).toBeTruthy()
    const email = host.querySelector('input[type="email"]') as HTMLInputElement
    const password = host.querySelector('input[name="password"]') as HTMLInputElement
    act(() => {
      nativeInput(email, 'new.visitor@example.com')
      nativeInput(password, 'a-fresh-password')
    })
    await act(async () => {
      host.querySelector('form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
      await Promise.resolve()
    })
    expect(signUpWithEmail).toHaveBeenCalledWith('new.visitor@example.com', 'a-fresh-password')
  })

  it('surfaces the confirmation notice and returns to sign-in when the project requires it', async () => {
    signUpWithEmail.mockReset()
    signUpWithEmail.mockResolvedValue({ needsConfirmation: true })
    mount()
    act(() => {
      firePointer(buttonNamed(host, 'Sign in with email'), 'pointerdown', 'touch')
    })
    act(() => {
      buttonNamed(host, 'New here? Create an account').click()
    })
    const email = host.querySelector('input[type="email"]') as HTMLInputElement
    const password = host.querySelector('input[name="password"]') as HTMLInputElement
    act(() => {
      nativeInput(email, 'new.visitor@example.com')
      nativeInput(password, 'a-fresh-password')
    })
    await act(async () => {
      host.querySelector('form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
      await Promise.resolve()
    })
    expect(host.textContent).toContain('Check your email to confirm your account')
    expect(buttonNamed(host, 'Continue with email')).toBeTruthy()
  })
})

describe('SignIn (web email)', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    platformMock.isIOSTauri = false
    platformMock.isMobileTauri = false
    platformMock.isTauri = false
    signInWithApple.mockReset()
    signInWithGoogle.mockReset()
    signInWithEmail.mockReset()
    signUpWithEmail.mockReset()
    signInWithApple.mockReturnValue(new Promise(() => {}))
    signInWithGoogle.mockReturnValue(new Promise(() => {}))
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    platformMock.isIOSTauri = true
    platformMock.isMobileTauri = true
    platformMock.isTauri = true
    vi.restoreAllMocks()
    act(() => root.unmount())
    host.remove()
  })

  function mount() {
    act(() => {
      root.render(createElement(SignIn))
    })
  }

  it('offers email as the account-creation door when there is no Tauri OAuth shell', () => {
    mount()
    expect(buttonNamed(host, 'Sign in with email')).toBeTruthy()
  })

  it('creates a brand-new account without needing Google or Apple', async () => {
    signUpWithEmail.mockResolvedValue({ needsConfirmation: false })
    mount()
    act(() => {
      buttonNamed(host, 'Sign in with email').click()
    })
    act(() => {
      buttonNamed(host, 'New here? Create an account').click()
    })
    const email = host.querySelector('input[type="email"]') as HTMLInputElement
    const password = host.querySelector('input[name="password"]') as HTMLInputElement
    act(() => {
      nativeInput(email, 'cold.visitor@example.com')
      nativeInput(password, 'a-fresh-password')
    })
    await act(async () => {
      host.querySelector('form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
      await Promise.resolve()
    })
    expect(signUpWithEmail).toHaveBeenCalledWith('cold.visitor@example.com', 'a-fresh-password')
  })
})
