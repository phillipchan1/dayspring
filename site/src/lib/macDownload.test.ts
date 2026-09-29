import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { posthogCapture } = vi.hoisted(() => ({ posthogCapture: vi.fn() }))

vi.mock('./googleAds', () => ({
  trackGoogleDownloadConversion: () => {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push(['event', 'conversion', {
      send_to: 'AW-18483316711/9XxNCJSG4oodEOePxO1E',
      transport_type: 'beacon',
    }])
  },
}))

vi.mock('./siteAnalytics', () => ({
  trackSite: (event: string) => {
    posthogCapture(event)
  },
}))

type ClickHandler = (event: { preventDefault: () => void }) => void

function makeLink(repo = 'phillipchan1/dayspring-releases') {
  const attributes = new Map<string, string>([
    ['data-dl-macos', ''],
    ['data-repo', repo],
  ])
  const listeners = new Map<string, ClickHandler[]>()
  const fallbackHref =
    'https://github.com/phillipchan1/dayspring-releases/releases/latest/download/Dayspring-aarch64.dmg'

  return {
    href: fallbackHref,
    dataset: {
      get repo() {
        return attributes.get('data-repo')
      },
    } as DOMStringMap,
    hasAttribute(name: string) {
      return attributes.has(name)
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value)
    },
    addEventListener(type: string, handler: ClickHandler) {
      const list = listeners.get(type) ?? []
      list.push(handler)
      listeners.set(type, list)
    },
    click() {
      const event = { preventDefault() {} }
      for (const handler of listeners.get('click') ?? []) handler(event)
    },
    dispatch(type: string) {
      for (const handler of listeners.get(type) ?? []) handler({ preventDefault() {} })
    },
    clickListenerCount() {
      return (listeners.get('click') ?? []).length
    },
  }
}

async function loadWire() {
  const { wireMacDownloads } = await import('./macDownload')
  return wireMacDownloads
}

describe('wireMacDownloads', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
    posthogCapture.mockReset()
  })

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          assets: [
            {
              name: 'Dayspring-aarch64.dmg',
              browser_download_url:
                'https://github.com/phillipchan1/dayspring-releases/releases/download/v1.0.0/Dayspring-aarch64.dmg',
            },
          ],
        }),
      })),
    )
  })

  it('wires 5 links once across 3 calls; one click is one conversion and one PostHog capture', async () => {
    const links = Array.from({ length: 5 }, () => makeLink())
    vi.stubGlobal('document', {
      querySelectorAll: (selector: string) =>
        selector === 'a[data-dl-macos]' ? links : [],
    })
    vi.stubGlobal('window', {
      dataLayer: [] as unknown[],
      location: { href: 'http://localhost/' },
    })

    const wireMacDownloads = await loadWire()
    wireMacDownloads()
    wireMacDownloads()
    wireMacDownloads()

    expect(links.every((link) => link.hasAttribute('data-dl-wired'))).toBe(true)
    expect(links.map((link) => link.clickListenerCount())).toEqual([1, 1, 1, 1, 1])

    links[0].click()

    const conversions = (window.dataLayer ?? []).filter(
      (entry) => Array.isArray(entry) && entry[0] === 'event' && entry[1] === 'conversion',
    )
    expect(conversions).toHaveLength(1)
    expect(posthogCapture).toHaveBeenCalledTimes(1)
    expect(posthogCapture).toHaveBeenCalledWith('download_clicked')
  })

  it('wires a link added later exactly once, and still resolves the GitHub DMG href', async () => {
    const initial = Array.from({ length: 5 }, () => makeLink())
    const late = makeLink()
    let pageLinks = initial
    vi.stubGlobal('document', {
      querySelectorAll: (selector: string) =>
        selector === 'a[data-dl-macos]' ? pageLinks : [],
    })
    vi.stubGlobal('window', {
      dataLayer: [] as unknown[],
      location: { href: 'http://localhost/' },
    })

    const wireMacDownloads = await loadWire()
    wireMacDownloads()
    pageLinks = [...initial, late]
    wireMacDownloads()
    wireMacDownloads()

    expect(late.hasAttribute('data-dl-wired')).toBe(true)
    expect(late.clickListenerCount()).toBe(1)

    late.dispatch('pointerenter')
    await vi.waitFor(() => {
      expect(late.href).toBe(
        'https://github.com/phillipchan1/dayspring-releases/releases/download/v1.0.0/Dayspring-aarch64.dmg',
      )
    })

    late.click()
    const conversions = (window.dataLayer ?? []).filter(
      (entry) => Array.isArray(entry) && entry[0] === 'event' && entry[1] === 'conversion',
    )
    expect(conversions).toHaveLength(1)
    expect(posthogCapture).toHaveBeenCalledTimes(1)
  })
})
