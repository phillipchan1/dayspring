import { describe, expect, it } from 'vitest'
import { parseDayspringDeepLink, selectDayspringDeepLink } from './deepLink'

describe('parseDayspringDeepLink', () => {
  it('recognizes dayspring://open with or without a trailing slash or query', () => {
    for (const raw of [
      'dayspring://open',
      'dayspring://open/',
      'dayspring://open?',
      'dayspring://open?utm=',
      'dayspring:///open',
      'dayspring:///open/',
    ]) {
      expect(parseDayspringDeepLink(raw), raw).toEqual({ kind: 'open', url: raw })
    }
  })

  it('recognizes the OAuth callback with or without a code', () => {
    expect(parseDayspringDeepLink('dayspring://auth-callback?code=abc')).toEqual({
      kind: 'auth-callback',
      url: 'dayspring://auth-callback?code=abc',
    })
    expect(parseDayspringDeepLink('dayspring://auth-callback')).toEqual({
      kind: 'auth-callback',
      url: 'dayspring://auth-callback',
    })
    expect(parseDayspringDeepLink('dayspring://auth-callback/')).toEqual({
      kind: 'auth-callback',
      url: 'dayspring://auth-callback/',
    })
  })

  it('does not treat a future plans path, extra segments, or other schemes as open', () => {
    expect(parseDayspringDeepLink('dayspring://plans')).toBeNull()
    expect(parseDayspringDeepLink('dayspring://open/plans')).toBeNull()
    expect(parseDayspringDeepLink('dayspring://open?code=stolen')?.kind).toBe('open')
    expect(parseDayspringDeepLink('https://usedayspring.app/open')).toBeNull()
    expect(parseDayspringDeepLink('https://dayspring-eosin.vercel.app/auth/callback?code=abc')).toBeNull()
    expect(parseDayspringDeepLink('not a url')).toBeNull()
    expect(parseDayspringDeepLink('dayspring://')).toBeNull()
  })
})

describe('selectDayspringDeepLink', () => {
  it('prefers auth-callback when a batch contains both kinds', () => {
    const picked = selectDayspringDeepLink([
      'dayspring://open',
      'dayspring://auth-callback?code=abc',
    ])
    expect(picked).toEqual({
      kind: 'auth-callback',
      url: 'dayspring://auth-callback?code=abc',
    })
  })

  it('selects open when that is the only recognized URL', () => {
    expect(selectDayspringDeepLink(['https://example.com', 'dayspring://open/'])).toEqual({
      kind: 'open',
      url: 'dayspring://open/',
    })
  })

  it('returns null for an empty or unrecognized batch', () => {
    expect(selectDayspringDeepLink(null)).toBeNull()
    expect(selectDayspringDeepLink([])).toBeNull()
    expect(selectDayspringDeepLink(['https://usedayspring.app/open'])).toBeNull()
  })
})
