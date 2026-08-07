import { describe, it, expect } from 'vitest'
import { demographicsStamp, readBody } from './demographics'

const NOW = new Date('2026-08-07T12:00:00.000Z')

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://dayspring-eosin.vercel.app/api/profile/ensure', {
    method: 'POST',
    headers,
  })
}

const GOOD = {
  platform: 'ios',
  form_factor: 'phone',
  timezone: 'America/Los_Angeles',
  locale: 'en-US',
}

describe('demographicsStamp — the happy path', () => {
  it('takes the client fields and the edge geo together', () => {
    const stamp = demographicsStamp(
      req({ 'x-vercel-ip-country': 'US', 'x-vercel-ip-country-region': 'CA' }),
      GOOD,
      null,
      'google',
      NOW,
    )
    expect(stamp).toEqual({
      platform: 'ios',
      platforms: ['ios'],
      form_factor: 'phone',
      timezone: 'America/Los_Angeles',
      locale: 'en-US',
      country: 'US',
      region: 'CA',
      signup_provider: 'google',
      last_seen_at: NOW.toISOString(),
    })
  })

  it('always stamps last_seen_at, even with nothing else to record', () => {
    const stamp = demographicsStamp(req(), {}, null, undefined, NOW)
    expect(stamp).toEqual({ last_seen_at: NOW.toISOString() })
  })
})

describe('demographicsStamp — untrusted input', () => {
  it('drops values outside the allowlist rather than writing them', () => {
    const stamp = demographicsStamp(
      req(),
      { platform: 'nintendo-switch', form_factor: 'watch' },
      null,
      undefined,
      NOW,
    )
    expect(stamp.platform).toBeUndefined()
    expect(stamp.form_factor).toBeUndefined()
    expect(stamp.platforms).toBeUndefined()
  })

  it('rejects a timezone or locale that is really a payload', () => {
    const stamp = demographicsStamp(
      req(),
      {
        timezone: "America/Los_Angeles'; drop table profiles;--",
        locale: 'Dear diary, today I prayed about my marriage',
      },
      null,
      undefined,
      NOW,
    )
    expect(stamp.timezone).toBeUndefined()
    expect(stamp.locale).toBeUndefined()
  })

  it('caps absurd lengths so a long string cannot ride in on a valid shape', () => {
    const stamp = demographicsStamp(
      req(),
      { timezone: `America/${'a'.repeat(200)}` },
      null,
      undefined,
      NOW,
    )
    expect(stamp.timezone).toBeUndefined()
  })

  it('ignores non-string values', () => {
    const stamp = demographicsStamp(
      req(),
      { platform: ['ios'], timezone: 42, locale: { toString: 'en' } },
      null,
      undefined,
      NOW,
    )
    expect(stamp.platform).toBeUndefined()
    expect(stamp.timezone).toBeUndefined()
    expect(stamp.locale).toBeUndefined()
  })

  it('accepts the awkward but real timezone and locale shapes', () => {
    const stamp = demographicsStamp(
      req(),
      { timezone: 'America/Argentina/Buenos_Aires', locale: 'zh-Hant-TW' },
      null,
      undefined,
      NOW,
    )
    expect(stamp.timezone).toBe('America/Argentina/Buenos_Aires')
    expect(stamp.locale).toBe('zh-Hant-TW')
  })

  it('ignores a country header that is not an ISO alpha-2 code', () => {
    const stamp = demographicsStamp(
      req({ 'x-vercel-ip-country': 'United States' }),
      {},
      null,
      undefined,
      NOW,
    )
    expect(stamp.country).toBeUndefined()
  })
})

describe('demographicsStamp — update semantics', () => {
  it('accumulates platforms instead of overwriting them', () => {
    const stamp = demographicsStamp(
      req(),
      { platform: 'ios' },
      { platforms: ['desktop'], signup_provider: 'google' },
      'google',
      NOW,
    )
    expect(stamp.platforms).toEqual(['desktop', 'ios'])
    expect(stamp.platform).toBe('ios')
  })

  it('does not rewrite the platforms array when nothing is new', () => {
    const stamp = demographicsStamp(
      req(),
      { platform: 'desktop' },
      { platforms: ['desktop'], signup_provider: 'google' },
      'google',
      NOW,
    )
    expect(stamp.platforms).toBeUndefined()
  })

  it('keeps the original signup provider when a second one is linked later', () => {
    const stamp = demographicsStamp(
      req(),
      {},
      { platforms: ['ios'], signup_provider: 'google' },
      'apple',
      NOW,
    )
    expect(stamp.signup_provider).toBeUndefined()
  })

  it('records the signup provider on the first call only', () => {
    const stamp = demographicsStamp(req(), {}, { platforms: [] }, 'apple', NOW)
    expect(stamp.signup_provider).toBe('apple')
  })

  it('ignores a provider we do not offer', () => {
    const stamp = demographicsStamp(req(), {}, null, 'email', NOW)
    expect(stamp.signup_provider).toBeUndefined()
  })

  it('omits absent fields entirely so an older client cannot null them out', () => {
    const stamp = demographicsStamp(req(), { platform: 'web' }, null, undefined, NOW)
    expect(Object.keys(stamp).sort()).toEqual(['last_seen_at', 'platform', 'platforms'])
  })
})

describe('readBody', () => {
  it('reads a JSON object', async () => {
    const r = new Request('https://x.test', { method: 'POST', body: JSON.stringify(GOOD) })
    expect(await readBody(r)).toEqual(GOOD)
  })

  it('yields {} for malformed JSON rather than throwing', async () => {
    const r = new Request('https://x.test', { method: 'POST', body: 'not json' })
    expect(await readBody(r)).toEqual({})
  })

  it('yields {} for a JSON array or scalar', async () => {
    const arr = new Request('https://x.test', { method: 'POST', body: '[1,2]' })
    expect(await readBody(arr)).toEqual({})
    const num = new Request('https://x.test', { method: 'POST', body: '7' })
    expect(await readBody(num)).toEqual({})
  })

  it('yields {} for an empty body — the shape older clients send', async () => {
    const r = new Request('https://x.test', { method: 'POST' })
    expect(await readBody(r)).toEqual({})
  })
})
