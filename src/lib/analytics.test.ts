// Tests for the usage-event boundary.
//
// Node environment, no DOM, and deliberately NO NETWORK — the pre-push hook
// runs this, and a test that could reach a vendor would eventually reach one.
// Nothing here imports analytics/posthog.ts: that module pulls in the SDK and
// window, and its only logic worth pinning down (the URL scrubber) lives in
// scrubUrl.ts precisely so it can be tested in isolation.
//
// What these protect is the promise in PRINCIPLES #7. The consent gate and the
// scrubber are the two places where getting it wrong sends somebody's words —
// or their access token — to a third party, silently, with no user-visible
// symptom to catch it later.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  track,
  identify,
  resetIdentity,
  setPersonProperties,
  setAnalyticsTransport,
  usageSharingEnabled,
  type AnalyticsEvent,
  type AnalyticsTransport,
  type Altitude,
  type PropValue,
} from './analytics'
import { settingsStore } from './settings'
import { pathOnly, scrubProperties } from './analytics/scrubUrl'
import { countBucket, yearsBucket, yearsBetween, ageBucket } from './analytics/buckets'
import type { AltitudeKey } from '../features/ascent/ascent.config'
import { PRACTICES } from '../editor/practices/practicesData'

interface Captured {
  event: AnalyticsEvent
  props: Record<string, PropValue> | undefined
}

function recorder() {
  const captured: Captured[] = []
  const identified: { id: string; props?: Record<string, PropValue> }[] = []
  const person: Record<string, PropValue>[] = []
  let resets = 0
  const transport: AnalyticsTransport = {
    capture: (event, props) => void captured.push({ event, props }),
    identify: (id, props) => void identified.push({ id, ...(props ? { props } : {}) }),
    setPerson: (props) => void person.push(props),
    reset: () => void resets++,
  }
  return { transport, captured, identified, person, resets: () => resets }
}

describe('consent gate', () => {
  beforeEach(() => settingsStore.update({ shareUsage: true }))
  afterEach(() => {
    setAnalyticsTransport(null)
    settingsStore.update({ shareUsage: true })
  })

  it('sends events while sharing is on', () => {
    const r = recorder()
    setAnalyticsTransport(r.transport)
    track('onboarding_path_chosen', { path: 'veteran' })
    expect(r.captured).toEqual([
      { event: 'onboarding_path_chosen', props: { path: 'veteran' } },
    ])
  })

  // The one that matters. If this regresses, we are collecting from people who
  // said no — and nothing in the UI would show it.
  it('drops every event while sharing is off', () => {
    const r = recorder()
    setAnalyticsTransport(r.transport)
    settingsStore.update({ shareUsage: false })

    track('onboarding_started')
    track('ask_run', { results: '2-10', ok: true })
    identify('11111111-2222-3333-4444-555555555555')
    setPersonProperties({ onboarding_path: 'fresh' })

    expect(r.captured).toEqual([])
    expect(r.identified).toEqual([])
    expect(r.person).toEqual([])
  })

  // Opting out is the one thing that must still work after opting out.
  it('still resets identity while sharing is off', () => {
    const r = recorder()
    setAnalyticsTransport(r.transport)
    settingsStore.update({ shareUsage: false })
    resetIdentity()
    expect(r.resets()).toBe(1)
  })

  it('reports the live toggle, not a value read at import time', () => {
    expect(usageSharingEnabled()).toBe(true)
    settingsStore.update({ shareUsage: false })
    expect(usageSharingEnabled()).toBe(false)
  })

  it('buffers nothing — events dropped while off are not replayed when on', () => {
    const r = recorder()
    setAnalyticsTransport(r.transport)
    settingsStore.update({ shareUsage: false })
    track('pages_opened')
    settingsStore.update({ shareUsage: true })
    expect(r.captured).toEqual([])
  })
})

describe('failure is never the app’s problem', () => {
  beforeEach(() => settingsStore.update({ shareUsage: true }))
  afterEach(() => setAnalyticsTransport(null))

  it('swallows a throwing transport', () => {
    setAnalyticsTransport({
      capture: () => {
        throw new Error('vendor exploded')
      },
      identify: () => {
        throw new Error('vendor exploded')
      },
      setPerson: () => {
        throw new Error('vendor exploded')
      },
      reset: () => {
        throw new Error('vendor exploded')
      },
    })
    expect(() => track('processing_cta_clicked')).not.toThrow()
    expect(() => identify('abc')).not.toThrow()
    expect(() => setPersonProperties({ a: 1 })).not.toThrow()
    expect(() => resetIdentity()).not.toThrow()
  })

  it('no-ops with no transport installed', () => {
    setAnalyticsTransport(null)
    expect(() => track('onboarding_started')).not.toThrow()
  })
})

describe('URL scrubbing', () => {
  // The incident this exists to prevent: Supabase OAuth puts an access token in
  // the hash, and stripAuthUrlNoise() only clears it from a React effect that
  // runs after the SDK is already live.
  it('drops an OAuth access token from the hash', () => {
    const url = 'https://dayspring-eosin.vercel.app/#access_token=eyJhbGciOi&refresh_token=xyz'
    expect(pathOnly(url)).toBe('/')
    expect(String(pathOnly(url))).not.toContain('access_token')
  })

  it('drops the checkout query string', () => {
    expect(pathOnly('https://dayspring-eosin.vercel.app/?checkout=success')).toBe('/')
  })

  it('keeps the path, which is the only part we want', () => {
    expect(pathOnly('https://dayspring-eosin.vercel.app/lamp?x=1#y')).toBe('/lamp')
  })

  it('handles the Tauri *.localhost origin', () => {
    expect(pathOnly('http://tauri.localhost/lamp#access_token=secret')).toBe('/lamp')
  })

  it('scrubs every URL-shaped property posthog-js emits', () => {
    const scrubbed = scrubProperties({
      $current_url: 'https://x.test/lamp?q=secret',
      $initial_current_url: 'https://x.test/#access_token=abc',
      $pathname: '/lamp',
      $referrer: 'https://x.test/?utm=1#tok',
      $referring_domain: 'x.test',
      $host: 'x.test',
      some_url: 'https://x.test/a?b=c',
      surface: 'scripture',
      count: 3,
      first: true,
    })
    expect(scrubbed).toEqual({
      $current_url: '/lamp',
      $initial_current_url: '/',
      $pathname: '/lamp',
      $referrer: '/',
      // Bare hostnames pass through: nothing to leak, and mangling them to
      // '/x.test' would destroy the only acquisition signal we keep.
      $referring_domain: 'x.test',
      $host: 'x.test',
      some_url: '/a',
      surface: 'scripture',
      count: 3,
      first: true,
    })
  })

  it('leaves non-URL properties untouched and survives junk', () => {
    expect(scrubProperties({ path: 'not a url' })).toEqual({ path: 'not a url' })
    expect(pathOnly('')).toBe('')
    expect(pathOnly(42)).toBe(42)
    expect(pathOnly(null)).toBe(null)
  })
})

describe('buckets', () => {
  // Boundaries are asserted explicitly because these labels are permanent
  // analytics keys: re-cutting one silently rewrites history, since old events
  // keep the old label and nothing reconciles them.
  it('cuts counts where it says it does', () => {
    expect(countBucket(0)).toBe('0')
    expect(countBucket(1)).toBe('1')
    expect(countBucket(2)).toBe('2-10')
    expect(countBucket(10)).toBe('2-10')
    expect(countBucket(11)).toBe('11-50')
    expect(countBucket(50)).toBe('11-50')
    expect(countBucket(200)).toBe('51-200')
    expect(countBucket(1000)).toBe('201-1k')
    expect(countBucket(5000)).toBe('1k-5k')
    expect(countBucket(5001)).toBe('5k+')
  })

  it('never returns a raw count for a real archive', () => {
    // Phil's own import: 3,460 entries. The point of bucketing is that this
    // number cannot be read back out.
    expect(countBucket(3460)).toBe('1k-5k')
  })

  it('degrades rather than throwing on nonsense', () => {
    expect(countBucket(Number.NaN)).toBe('0')
    expect(countBucket(-5)).toBe('0')
    expect(yearsBucket(Number.NaN)).toBe('under-1')
    expect(yearsBetween('not-a-date', 'also-not')).toBe(0)
    expect(ageBucket('garbage')).toBe('over-a-year')
  })

  it('cuts year spans where it says it does', () => {
    expect(yearsBucket(0.5)).toBe('under-1')
    expect(yearsBucket(1)).toBe('1-2')
    expect(yearsBucket(3)).toBe('3-5')
    expect(yearsBucket(10)).toBe('6-10')
    expect(yearsBucket(11)).toBe('over-10')
  })

  it('measures a span in years', () => {
    expect(Math.round(yearsBetween('2015-01-01', '2026-01-01'))).toBe(11)
    // Order-independent: a reversed range is a range, not a negative one.
    expect(Math.round(yearsBetween('2026-01-01', '2015-01-01'))).toBe(11)
  })

  it('cuts ages where it says it does', () => {
    const now = Date.parse('2026-08-11T12:00:00Z')
    expect(ageBucket('2026-08-11T06:00:00Z', now)).toBe('today')
    expect(ageBucket('2026-08-08T12:00:00Z', now)).toBe('this-week')
    expect(ageBucket('2026-07-25T12:00:00Z', now)).toBe('this-month')
    expect(ageBucket('2026-01-01T12:00:00Z', now)).toBe('this-year')
    expect(ageBucket('2019-01-01T12:00:00Z', now)).toBe('over-a-year')
  })
})

describe('permanent keys', () => {
  // lib/ must not import from features/, so `Altitude` is declared by hand in
  // analytics.ts. This assertion is what stops the hand-written copy drifting
  // from the real one — it fails to COMPILE if a fifth altitude is added or one
  // is renamed, which is the only moment anyone would think to look here.
  it('keeps Altitude structurally identical to AltitudeKey', () => {
    type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
    const bothWays: Exact<Altitude, AltitudeKey> = true
    expect(bothWays).toBe(true)
  })

  // Internal keys, not display names — GLOSSARY's rule. If these ever read
  // valley/hillside/ridge/summit, every historical row is orphaned.
  it('uses internal altitude keys, never the terrain names', () => {
    const altitudes: Altitude[] = ['week', 'month', 'quarter', 'year']
    for (const a of altitudes) {
      expect(['valley', 'hillside', 'ridge', 'summit']).not.toContain(a)
    }
  })

  it('gives every practice a unique, stable slug', () => {
    const ids = PRACTICES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Slugs must not be derived from display copy — a slug that still matches
    // its lowercased name is one rename away from looking wrong.
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/)
  })
})
