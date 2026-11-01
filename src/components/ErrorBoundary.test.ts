// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const platform = vi.hoisted(() => ({ tauri: false, desktop: false }))
const relaunch = vi.hoisted(() => vi.fn(() => Promise.resolve()))

vi.mock('@/lib/platform', () => ({
  isTauri: () => platform.tauri,
  isDesktopTauri: () => platform.desktop,
}))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch }))
vi.mock('@/lib/crashReport', () => ({ buildCrashPayload: vi.fn(), reportCrash: vi.fn() }))

const { ErrorBoundary } = await import('./ErrorBoundary')

function Boom(): never {
  throw new Error('boom')
}

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  relaunch.mockClear()
})

function crash() {
  // The boundary retries once silently; a component that always throws gets
  // past that to the fallback.
  act(() => {
    root.render(createElement(ErrorBoundary, { variant: 'root', children: createElement(Boom) }))
  })
  return host.querySelector<HTMLButtonElement>('.error-boundary__btn--primary')!
}

describe('ErrorBoundary (root)', () => {
  it('offers a reload on the web', () => {
    platform.tauri = false
    platform.desktop = false
    expect(crash().textContent).toBe('Reload')
  })

  it('restarts Dayspring on the Mac with a real relaunch', async () => {
    platform.tauri = true
    platform.desktop = true
    const button = crash()
    expect(button.textContent).toBe('Restart Dayspring')
    await act(async () => {
      button.click()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(relaunch).toHaveBeenCalledTimes(1)
  })

  it('says Restart Dayspring in the iOS app too', () => {
    platform.tauri = true
    platform.desktop = false
    expect(crash().textContent).toBe('Restart Dayspring')
  })
})
