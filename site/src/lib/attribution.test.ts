import { describe, expect, it } from 'vitest'
import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_COOKIE_DOMAIN,
  ATTRIBUTION_MAX_AGE_SEC,
  attributionCookieDomain,
  decodeAttributionCookieValue,
  formatAttributionSetCookie,
  hasAttribution,
  mergeAttribution,
  parseAttributionCookie,
  parseAttributionSearch,
  readNamedCookie,
  serializeAttribution,
} from './attribution'
import { persistLandingAttribution } from './attributionCookie'

describe('parseAttributionSearch', () => {
  it('reads click ids and the five utm_* keys', () => {
    expect(
      parseAttributionSearch(
        '?gclid=abc&gbraid=gb&wbraid=wb&utm_source=google&utm_medium=cpc&utm_campaign=test&utm_content=ad1&utm_term=journal&other=ignore',
      ),
    ).toEqual({
      gclid: 'abc',
      gbraid: 'gb',
      wbraid: 'wb',
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'test',
      utm_content: 'ad1',
      utm_term: 'journal',
    })
  })

  it('accepts a query string without the leading ?', () => {
    expect(parseAttributionSearch('gclid=xyz&utm_source=google')).toEqual({
      gclid: 'xyz',
      utm_source: 'google',
    })
  })

  it('drops empty, whitespace-only, and unknown keys', () => {
    expect(parseAttributionSearch('?gclid=&utm_source=%20&fbclid=face')).toEqual({})
  })

  it('returns nothing for an empty search', () => {
    expect(parseAttributionSearch('')).toEqual({})
    expect(parseAttributionSearch('?')).toEqual({})
  })
})

describe('mergeAttribution', () => {
  it('lets a later non-empty click id replace the stored one', () => {
    expect(
      mergeAttribution({ gclid: 'old', utm_source: 'google' }, { gclid: 'new' }),
    ).toEqual({ gclid: 'new', utm_source: 'google' })
  })

  it('does not overwrite existing values with an empty visit', () => {
    const existing = {
      gclid: 'keep',
      gbraid: 'gb',
      utm_source: 'google',
      utm_campaign: 'spring',
    }
    expect(mergeAttribution(existing, {})).toEqual(existing)
    expect(mergeAttribution(existing, { gclid: '', utm_source: '   ' })).toEqual(existing)
  })

  it('fills missing keys from a later visit without clearing the others', () => {
    expect(
      mergeAttribution({ gclid: 'abc', utm_source: 'google' }, { wbraid: 'wb', utm_medium: 'cpc' }),
    ).toEqual({
      gclid: 'abc',
      wbraid: 'wb',
      utm_source: 'google',
      utm_medium: 'cpc',
    })
  })

  it('treats gclid, gbraid, and wbraid independently', () => {
    expect(
      mergeAttribution({ gclid: 'abc', gbraid: 'old-gb' }, { gbraid: 'new-gb' }),
    ).toEqual({ gclid: 'abc', gbraid: 'new-gb' })
  })
})

describe('serialize / parse cookie payload', () => {
  it('round-trips the stored keys', () => {
    const attrs = { gclid: 'abc', utm_source: 'google', utm_term: 'a b' }
    const serialized = serializeAttribution(attrs)
    expect(parseAttributionCookie(serialized)).toEqual(attrs)
  })

  it('omits empty keys from the payload', () => {
    expect(serializeAttribution({ gclid: 'abc', utm_source: '' })).toBe('gclid=abc')
  })

  it('hasAttribution is false for an empty object', () => {
    expect(hasAttribution({})).toBe(false)
    expect(hasAttribution({ gclid: 'x' })).toBe(true)
  })
})

describe('cookie formatting', () => {
  it('sets Domain=.usedayspring.app on our host and any subdomain', () => {
    expect(attributionCookieDomain('usedayspring.app')).toBe(ATTRIBUTION_COOKIE_DOMAIN)
    expect(attributionCookieDomain('www.usedayspring.app')).toBe(ATTRIBUTION_COOKIE_DOMAIN)
    expect(attributionCookieDomain('app.usedayspring.app')).toBe(ATTRIBUTION_COOKIE_DOMAIN)
  })

  it('omits Domain on localhost and preview hosts', () => {
    expect(attributionCookieDomain('localhost')).toBeUndefined()
    expect(attributionCookieDomain('dayspring-site.vercel.app')).toBeUndefined()
  })

  it('writes 90-day SameSite=Lax Secure cookies', () => {
    const header = formatAttributionSetCookie('gclid=abc', {
      domain: ATTRIBUTION_COOKIE_DOMAIN,
      secure: true,
    })
    expect(header).toBe(
      `${ATTRIBUTION_COOKIE}=${encodeURIComponent('gclid=abc')}; Path=/; Max-Age=${ATTRIBUTION_MAX_AGE_SEC}; SameSite=Lax; Secure; Domain=${ATTRIBUTION_COOKIE_DOMAIN}`,
    )
  })

  it('reads ds_attrib from a cookie header that also has other cookies', () => {
    expect(readNamedCookie('theme=dark; ds_attrib=gclid=abc&utm_source=google; other=1', ATTRIBUTION_COOKIE)).toBe(
      'gclid=abc&utm_source=google',
    )
  })
})

describe('persistLandingAttribution', () => {
  it('writes a merged cookie when the landing URL carries params', () => {
    let written = ''
    persistLandingAttribution(
      '?gclid=new&utm_source=google',
      `${ATTRIBUTION_COOKIE}=${encodeURIComponent('gclid=old&utm_campaign=spring')}`,
      (value) => {
        written = value
      },
      'www.usedayspring.app',
      true,
    )
    const payload = decodeAttributionCookieValue(
      readNamedCookie(written.split(';')[0], ATTRIBUTION_COOKIE) ?? '',
    )
    expect(parseAttributionCookie(payload)).toEqual({
      gclid: 'new',
      utm_source: 'google',
      utm_campaign: 'spring',
    })
    expect(written).toContain(`Domain=${ATTRIBUTION_COOKIE_DOMAIN}`)
    expect(written).toContain('SameSite=Lax')
    expect(written).toContain('Secure')
  })

  it('does not write on a visit with no attribution params', () => {
    let written: string | undefined
    persistLandingAttribution(
      '?fbclid=face',
      `${ATTRIBUTION_COOKIE}=gclid=keep`,
      (value) => {
        written = value
      },
      'www.usedayspring.app',
      true,
    )
    expect(written).toBeUndefined()
  })
})
