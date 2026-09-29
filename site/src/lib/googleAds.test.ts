import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type GtagFn = (...args: unknown[]) => void

function installDom() {
  const dataLayer: unknown[] = []
  const scripts: { src: string; async: boolean }[] = []
  const firstScript = {
    parentNode: {
      insertBefore(node: { src: string; async: boolean }) {
        scripts.push(node)
      },
    },
  }
  const win: { dataLayer: unknown[]; gtag?: GtagFn } = { dataLayer }

  vi.stubGlobal('window', win)
  vi.stubGlobal('document', {
    createElement() {
      return { async: false, src: '' }
    },
    getElementsByTagName() {
      return [firstScript]
    },
  })
  return { win, scripts }
}

async function loadGoogleAds(env: {
  PUBLIC_GOOGLE_TAG_ID?: string
  PUBLIC_GADS_DOWNLOAD_SEND_TO?: string
  PUBLIC_GADS_START_TRIAL_SEND_TO?: string
}) {
  vi.resetModules()
  vi.stubEnv('PUBLIC_GOOGLE_TAG_ID', env.PUBLIC_GOOGLE_TAG_ID ?? '')
  vi.stubEnv('PUBLIC_GADS_DOWNLOAD_SEND_TO', env.PUBLIC_GADS_DOWNLOAD_SEND_TO ?? '')
  vi.stubEnv('PUBLIC_GADS_START_TRIAL_SEND_TO', env.PUBLIC_GADS_START_TRIAL_SEND_TO ?? '')
  return import('./googleAds')
}

function layerArgs(entry: unknown): unknown[] {
  expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]')
  return Array.from(entry as IArguments)
}

function conversionParams(dataLayer: unknown[]): Record<string, unknown> | undefined {
  for (const entry of dataLayer) {
    const args = layerArgs(entry)
    if (args[0] === 'event' && args[1] === 'conversion') {
      return args[2] as Record<string, unknown>
    }
  }
  return undefined
}

beforeEach(() => {
  installDom()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('gtag dataLayer shim', () => {
  it('pushes an Arguments object, not a rest-args Array', async () => {
    const { win, scripts } = installDom()
    const { initGoogleTag } = await loadGoogleAds({
      PUBLIC_GOOGLE_TAG_ID: 'AW-18483316711',
    })
    initGoogleTag()

    expect(scripts[0]?.src).toContain('googletagmanager.com/gtag/js?id=AW-18483316711')
    expect(win.dataLayer.length).toBeGreaterThan(0)
    for (const entry of win.dataLayer) {
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]')
      expect(Array.isArray(entry)).toBe(false)
    }
    const kinds = win.dataLayer.map((entry) => layerArgs(entry)[0])
    expect(kinds).toContain('js')
    expect(kinds).toContain('config')
  })

  it('does not load a script when PUBLIC_GOOGLE_TAG_ID is unset', async () => {
    const { win, scripts } = installDom()
    const { initGoogleTag } = await loadGoogleAds({})
    initGoogleTag()
    expect(scripts).toEqual([])
    expect(win.gtag).toBeUndefined()
  })
})

describe('conversions', () => {
  const env = {
    PUBLIC_GOOGLE_TAG_ID: 'AW-18483316711',
    PUBLIC_GADS_DOWNLOAD_SEND_TO: 'AW-18483316711/9XxNCJSG4oodEOePxO1E',
    PUBLIC_GADS_START_TRIAL_SEND_TO: 'AW-18483316711/j0NLCJGG4oodEOePxO1E',
  }

  it('sends the download conversion as a non-blocking beacon (no event_callback)', async () => {
    const { win } = installDom()
    const { initGoogleTag, trackGoogleDownloadConversion } = await loadGoogleAds(env)
    initGoogleTag()
    trackGoogleDownloadConversion()

    const params = conversionParams(win.dataLayer)
    expect(params).toMatchObject({
      send_to: env.PUBLIC_GADS_DOWNLOAD_SEND_TO,
      transport_type: 'beacon',
    })
    expect(params?.event_callback).toBeUndefined()
  })

  it('queues the start-trial conversion with event_callback and transport_type beacon', async () => {
    const { win } = installDom()
    const { trackGoogleStartTrialConversion } = await loadGoogleAds(env)
    const onReady = vi.fn()
    trackGoogleStartTrialConversion(onReady)

    const params = conversionParams(win.dataLayer)
    expect(params).toMatchObject({
      send_to: env.PUBLIC_GADS_START_TRIAL_SEND_TO,
      transport_type: 'beacon',
    })
    expect(typeof params?.event_callback).toBe('function')
    expect(onReady).not.toHaveBeenCalled()
    ;(params?.event_callback as () => void)()
    expect(onReady).toHaveBeenCalledOnce()
  })
})

describe('handoffAfterStartTrialConversion', () => {
  const env = {
    PUBLIC_GOOGLE_TAG_ID: 'AW-18483316711',
    PUBLIC_GADS_START_TRIAL_SEND_TO: 'AW-18483316711/j0NLCJGG4oodEOePxO1E',
  }

  it('when send_to is unset, redirects at the 400ms floor, not immediately', async () => {
    const { handoffAfterStartTrialConversion, START_TRIAL_HANDOFF_MIN_MS } =
      await loadGoogleAds({
        PUBLIC_GOOGLE_TAG_ID: 'AW-18483316711',
      })
    vi.useFakeTimers()
    const handoff = vi.fn()
    handoffAfterStartTrialConversion(handoff)

    expect(handoff).not.toHaveBeenCalled()
    vi.advanceTimersByTime(START_TRIAL_HANDOFF_MIN_MS - 1)
    expect(handoff).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(handoff).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(5000)
    expect(handoff).toHaveBeenCalledOnce()
  })

  it('a fast event_callback still waits for the 400ms floor, then hands off once', async () => {
    const { win } = installDom()
    const {
      handoffAfterStartTrialConversion,
      START_TRIAL_HANDOFF_MIN_MS,
      START_TRIAL_HANDOFF_FALLBACK_MS,
    } = await loadGoogleAds(env)
    vi.useFakeTimers()
    const handoff = vi.fn()
    handoffAfterStartTrialConversion(handoff)

    const params = conversionParams(win.dataLayer)
    expect(typeof params?.event_callback).toBe('function')
    ;(params?.event_callback as () => void)()
    expect(handoff).not.toHaveBeenCalled()

    vi.advanceTimersByTime(START_TRIAL_HANDOFF_MIN_MS - 1)
    expect(handoff).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(handoff).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(START_TRIAL_HANDOFF_FALLBACK_MS)
    expect(handoff).toHaveBeenCalledOnce()
  })

  it('a late event_callback after the floor redirects then, not at 400ms', async () => {
    const { win } = installDom()
    const { handoffAfterStartTrialConversion, START_TRIAL_HANDOFF_MIN_MS } =
      await loadGoogleAds(env)
    vi.useFakeTimers()
    const handoff = vi.fn()
    handoffAfterStartTrialConversion(handoff)

    vi.advanceTimersByTime(START_TRIAL_HANDOFF_MIN_MS)
    expect(handoff).not.toHaveBeenCalled()

    const params = conversionParams(win.dataLayer)
    ;(params?.event_callback as () => void)()
    expect(handoff).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(5000)
    expect(handoff).toHaveBeenCalledOnce()
  })

  it('when event_callback never runs, redirects at the 1200ms fallback, once', async () => {
    const { handoffAfterStartTrialConversion, START_TRIAL_HANDOFF_FALLBACK_MS } =
      await loadGoogleAds(env)
    vi.useFakeTimers()
    const handoff = vi.fn()
    handoffAfterStartTrialConversion(handoff)

    expect(handoff).not.toHaveBeenCalled()
    vi.advanceTimersByTime(START_TRIAL_HANDOFF_FALLBACK_MS - 1)
    expect(handoff).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(handoff).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(5000)
    expect(handoff).toHaveBeenCalledOnce()
  })
})
