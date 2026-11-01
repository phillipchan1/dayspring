// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppLockConfig } from '@/lib/appLock'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const verifyLock = vi.hoisted(() => vi.fn<(config: unknown, secret: string) => Promise<boolean>>())
const rememberPinLength = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('@/lib/appLock', async () => {
  const actual = await vi.importActual<typeof import('@/lib/appLock')>('@/lib/appLock')
  return { ...actual, verifyLock }
})
vi.mock('@/lib/appLockStore', () => ({ markResetRequested: vi.fn(), rememberPinLength }))
vi.mock('@/lib/auth', () => ({ signOut: vi.fn() }))
vi.mock('./biometric', () => ({
  checkBiometry: () => Promise.resolve({ available: false, label: null }),
  promptBiometric: () => Promise.resolve(false),
}))

const { LockScreen } = await import('./LockScreen')
const { pinSlots } = await import('./PinField')

const BASE: AppLockConfig = {
  v: 1,
  kind: 'pin',
  salt: 'c2FsdA==',
  iterations: 1_000,
  hash: 'aGFzaA==',
  graceSeconds: 300,
  biometric: false,
  updatedAt: '2026-08-17T00:00:00.000Z',
}

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  // Reduce Motion, so a wrong PIN's dots empty without waiting out the shake.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
  verifyLock.mockReset()
  rememberPinLength.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function mount(config: AppLockConfig, onOpen = vi.fn()) {
  act(() => {
    root.render(createElement(LockScreen, { config, ownerId: 'owner-a', onOpen }))
  })
  return onOpen
}

function type(value: string) {
  const input = host.querySelector('input') as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

const openButton = () =>
  [...host.querySelectorAll('button')].find((b) => b.textContent === 'Open' || b.textContent === 'Opening…')

describe('LockScreen', () => {
  it('draws one gold dot per digit of a PIN it knows the length of', () => {
    mount({ ...BASE, pinLength: 6 })
    expect(host.querySelectorAll('.pin-field__dot')).toHaveLength(6)
    act(() => type('48'))
    expect(host.querySelectorAll('.pin-field__dot[data-filled="true"]')).toHaveLength(2)
  })

  it('opens on the last digit, with no Open button to find', async () => {
    verifyLock.mockResolvedValue(true)
    const onOpen = mount({ ...BASE, pinLength: 4 })
    expect(openButton()).toBeUndefined()
    await act(async () => {
      type('4821')
      await Promise.resolve()
    })
    expect(verifyLock).toHaveBeenCalledWith(expect.anything(), '4821')
    expect(onOpen).toHaveBeenCalledTimes(1)
    // Asked on every open; it only writes for a lock that did not know.
    expect(rememberPinLength).toHaveBeenCalledWith(expect.anything(), 4)
  })

  // Existing locks have no stored length: keep the Open button, never guess.
  it('keeps the Open button for a lock made before the length was stored', async () => {
    verifyLock.mockResolvedValue(true)
    const onOpen = mount(BASE)
    expect(openButton()).toBeTruthy()
    await act(async () => {
      type('4821')
      await Promise.resolve()
    })
    expect(verifyLock).not.toHaveBeenCalled()
    await act(async () => {
      openButton()!.click()
      await Promise.resolve()
    })
    expect(onOpen).toHaveBeenCalledTimes(1)
    // ...and learns it from the PIN that opened it.
    expect(rememberPinLength).toHaveBeenCalledWith(BASE, 4)
  })

  it('says so, and empties for another try, on a wrong PIN', async () => {
    verifyLock.mockResolvedValue(false)
    const onOpen = mount({ ...BASE, pinLength: 4 })
    await act(async () => {
      type('1111')
      await Promise.resolve()
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(onOpen).not.toHaveBeenCalled()
    expect(host.textContent).toContain('That PIN doesn’t match.')
    expect(host.querySelectorAll('.pin-field__dot[data-filled="true"]')).toHaveLength(0)
  })

  it('keeps a passphrase a typed line with an Open button', () => {
    mount({ ...BASE, kind: 'passphrase' })
    expect(host.querySelector('.pin-field__dot')).toBeNull()
    expect(host.querySelector('input.pin-field__text')).toBeTruthy()
    expect(openButton()).toBeTruthy()
  })
})

describe('pinSlots', () => {
  it('draws the known length', () => {
    expect(pinSlots(0, 6)).toBe(6)
  })

  it('starts at four and grows with the digits up to eight when the length is unknown', () => {
    expect(pinSlots(0)).toBe(4)
    expect(pinSlots(5)).toBe(5)
    expect(pinSlots(12)).toBe(8)
  })
})
