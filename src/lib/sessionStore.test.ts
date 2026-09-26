import { describe, expect, it } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { decideSession, parseStoredSession } from './sessionStore'

function session(overrides: Record<string, unknown> = {}): Session {
  return {
    access_token: 'at',
    refresh_token: 'rt',
    expires_in: 3600,
    // An hour ago: the access token has lapsed, as it will after any real
    // stretch offline. That must not make it any less this person's session.
    expires_at: Math.floor(Date.now() / 1000) - 3600,
    token_type: 'bearer',
    user: { id: 'u-1', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' },
    ...overrides,
  } as Session
}

describe('parseStoredSession', () => {
  it('accepts a stored session whose access token has expired', () => {
    expect(parseStoredSession(JSON.stringify(session()))?.user.id).toBe('u-1')
    expect(parseStoredSession(session())?.user.id).toBe('u-1')
  })

  it('rejects anything that cannot get back to the server or name its owner', () => {
    expect(parseStoredSession(null)).toBeNull()
    expect(parseStoredSession('{not json')).toBeNull()
    expect(parseStoredSession(JSON.stringify(session({ refresh_token: '' })))).toBeNull()
    expect(parseStoredSession(JSON.stringify(session({ user: null })))).toBeNull()
    expect(parseStoredSession(JSON.stringify({ access_token: 'at' }))).toBeNull()
  })
})

describe('decideSession', () => {
  const held = session()

  it('takes any session Supabase hands over', () => {
    const fresh = session({ access_token: 'fresh' })
    expect(decideSession('TOKEN_REFRESHED', fresh, held)).toEqual({ session: fresh })
    expect(decideSession('INITIAL_SESSION', fresh, null)).toEqual({ session: fresh })
  })

  it('ends the session only on an explicit sign-out', () => {
    expect(decideSession('SIGNED_OUT', null, held)).toEqual({ session: null })
  })

  it('does not drop a held session because an offline refresh answered null', () => {
    // Offline with an expired token, INITIAL_SESSION arrives null after ~50s of
    // refresh retries. That used to route a paying user into guest mode, whose
    // privacy fence then purged their journal and unsynced outbox.
    expect(decideSession('INITIAL_SESSION', null, held)).toBe('recheck-storage')
  })

  it('has nothing to do when nobody is signed in and nobody signs in', () => {
    expect(decideSession('INITIAL_SESSION', null, null)).toBe('keep')
  })
})
