// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('@/lib/appLockStore', () => ({ saveAppLock: vi.fn(), clearAppLock: vi.fn() }))

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
})

const { SetPinFlow } = await import('./SetPinFlow')

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('SetPinFlow', () => {
  // It opens over Settings, whose Esc listener is on the window in capture and
  // was added before this dialog mounted. Esc must cancel the dialog only.
  it('cancels on Esc without the Settings underneath hearing it', () => {
    const settingsHeard = vi.fn()
    const onSettingsEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settingsHeard()
    }
    window.addEventListener('keydown', onSettingsEsc, true)
    const onClose = vi.fn()
    act(() => {
      root.render(createElement(SetPinFlow, { mode: 'set', config: null, biometryLabel: null, onClose }))
    })
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(settingsHeard).not.toHaveBeenCalled()
    window.removeEventListener('keydown', onSettingsEsc, true)
  })

  it('leaves Esc alone once it has closed', () => {
    const onClose = vi.fn()
    act(() => {
      root.render(createElement(SetPinFlow, { mode: 'set', config: null, biometryLabel: null, onClose }))
    })
    act(() => root.render(createElement('div')))
    const ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    act(() => {
      window.dispatchEvent(ev)
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(ev.defaultPrevented).toBe(false)
  })

  it('offers Face ID as the Settings switch, not a raw checkbox', () => {
    act(() => {
      root.render(
        createElement(SetPinFlow, { mode: 'set', config: null, biometryLabel: 'Face ID', onClose: vi.fn() }),
      )
    })
    // Choose a PIN, then on to the confirm step, where the opt-in lives.
    const input = host.querySelector('input') as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, '4821')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => {
      ;[...host.querySelectorAll('button')].find((b) => b.textContent === 'Continue')!.click()
    })
    expect(host.querySelector('input[type="checkbox"]')).toBeNull()
    const toggle = host.querySelector<HTMLButtonElement>('button.switch[role="switch"]')!
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    act(() => toggle.click())
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    // Four dots for the four digits just chosen.
    expect(host.querySelectorAll('.pin-field__dot')).toHaveLength(4)
  })
})
