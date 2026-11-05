// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MAC_TRAFFIC_INSET,
  isAppleTouchDevice,
  platformKind,
  setFullscreenInsets,
} from './platform'

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

describe('platformKind', () => {
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

  it('reports web outside Tauri', () => {
    delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
    expect(platformKind()).toBe('web')
  })

  it('reports mac for a Tauri desktop session', () => {
    ;(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {}
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    })
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 0 })
    expect(platformKind()).toBe('mac')
  })

  it('reports ios for a Tauri iPad-in-Macintosh session', () => {
    ;(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {}
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)',
    })
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 })
    expect(platformKind()).toBe('ios')
  })
})

describe('the Mac window config', () => {
  const read = (name: string) =>
    JSON.parse(readFileSync(join(__dirname, '../../src-tauri', name), 'utf8')) as {
      app: { windows: Array<Record<string, unknown>> }
    }

  it('starts the Mac window hidden on the Ink ground, inspector off', () => {
    const [window] = read('tauri.macos.conf.json').app.windows
    expect(window).toMatchObject({ visible: false, backgroundColor: '#14161d', devtools: false })
  })

  it('keeps every other window setting the same as the shared config', () => {
    // tauri.macos.conf.json replaces the windows array wholesale (JSON merge
    // patch), so a setting changed only in tauri.conf.json would silently not
    // reach the Mac.
    const [shared] = read('tauri.conf.json').app.windows
    const [mac] = read('tauri.macos.conf.json').app.windows
    const { visible, backgroundColor, devtools, ...rest } = mac ?? {}
    void visible
    void backgroundColor
    void devtools
    expect(rest).toEqual(shared)
  })

  it('never hides the iOS web view: visible:false stays out of the shared config', () => {
    const [shared] = read('tauri.conf.json').app.windows
    expect(shared?.visible).not.toBe(false)
  })
})

describe('setFullscreenInsets', () => {
  it('drops the traffic-light clearances in full screen and puts them back after', () => {
    const style = document.documentElement.style
    setFullscreenInsets(false)
    expect(style.getPropertyValue('--mac-traffic-main-top')).toBe(MAC_TRAFFIC_INSET.mainTop)
    expect(style.getPropertyValue('--mac-traffic-rail-top')).not.toBe('')
    setFullscreenInsets(true)
    expect(style.getPropertyValue('--mac-traffic-main-top')).toBe('')
    expect(style.getPropertyValue('--mac-traffic-rail-top')).toBe('')
    setFullscreenInsets(false)
    expect(style.getPropertyValue('--mac-traffic-main-top')).toBe(MAC_TRAFFIC_INSET.mainTop)
  })
})
