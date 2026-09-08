// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { isAppleTouchDevice } from './platform'

describe('isAppleTouchDevice', () => {
  it('recognizes an iPhone UA without consulting touch points', () => {
    expect(isAppleTouchDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 0)).toBe(
      true,
    )
  })

  it('recognizes an explicit iPad UA', () => {
    expect(isAppleTouchDevice('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 0)).toBe(true)
  })

  it('treats iPadOS desktop UA + any touch points as an iPad', () => {
    const ipadDesktop =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)'
    expect(isAppleTouchDevice(ipadDesktop, 5)).toBe(true)
    // Some WKWebViews have reported 1 rather than 5.
    expect(isAppleTouchDevice(ipadDesktop, 1)).toBe(true)
  })

  it('does not treat a Mac (zero touch points) as an iPad', () => {
    expect(
      isAppleTouchDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
        0,
      ),
    ).toBe(false)
  })
})

describe('isIOSTauri / isMobileTauri (runtime UA)', () => {
  const original = {
    tauri: Object.prototype.hasOwnProperty.call(window, '__TAURI_INTERNALS__'),
    ua: navigator.userAgent,
    touch: navigator.maxTouchPoints,
  }

  afterEach(() => {
    if (original.tauri) {
      ;(window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {}
    } else {
      delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    }
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: original.ua })
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: original.touch,
    })
  })

  it('classifies an iPad-in-Macintosh WKWebView as iOS Tauri', async () => {
    ;(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {}
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    })
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })

    // Re-import is unnecessary — functions read navigator live.
    const { isIOSTauri, isMobileTauri, isDesktopTauri } = await import('./platform')
    expect(isIOSTauri()).toBe(true)
    expect(isMobileTauri()).toBe(true)
    expect(isDesktopTauri()).toBe(false)
  })

  it('does not mark a Mac Tauri session as iOS', async () => {
    ;(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {}
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    })
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 })

    const { isIOSTauri, isMobileTauri, isDesktopTauri } = await import('./platform')
    expect(isIOSTauri()).toBe(false)
    expect(isMobileTauri()).toBe(false)
    expect(isDesktopTauri()).toBe(true)
  })
})
