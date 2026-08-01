import { afterEach, describe, expect, it, vi } from 'vitest'
import { classifySyncError, describeSyncError } from './syncError'

// `classifySyncError` short-circuits on navigator.onLine, which is undefined in
// the node test environment (so the check is skipped). Tests that care about it
// stub it explicitly.
function withOnLine(value: boolean, fn: () => void): void {
  vi.stubGlobal('navigator', { onLine: value })
  try {
    fn()
  } finally {
    vi.unstubAllGlobals()
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('classifySyncError', () => {
  // Shapes below are what @supabase/postgrest-js 2.x actually hands back — a
  // network failure becomes a PostgrestError with an EMPTY code, because the
  // response's status 0 is gone by the time callers rethrow `error`.
  describe('offline — never burns a retry attempt', () => {
    it('reads Chrome/Node "Failed to fetch"', () => {
      const e = { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }
      expect(classifySyncError(e)).toBe('offline')
    })

    it('reads WebKit "Load failed" — iOS ships WebKit, so this one matters', () => {
      const e = { message: 'TypeError: Load failed', details: '', hint: '', code: '' }
      expect(classifySyncError(e)).toBe('offline')
    })

    it('reads Firefox "NetworkError when attempting to fetch resource"', () => {
      const e = {
        message: 'TypeError: NetworkError when attempting to fetch resource.',
        code: '',
      }
      expect(classifySyncError(e)).toBe('offline')
    })

    it('trusts navigator.onLine over anything the error says', () => {
      withOnLine(false, () => {
        expect(classifySyncError({ code: '23505', message: 'duplicate key' })).toBe('offline')
      })
    })

    it('reads a storage error with status 0', () => {
      expect(classifySyncError({ status: 0, message: 'network' })).toBe('offline')
    })
  })

  describe('permanent — retired so it cannot block the queue', () => {
    it('classifies an RLS refusal (42501)', () => {
      const e = { code: '42501', message: 'new row violates row-level security policy' }
      expect(classifySyncError(e)).toBe('permanent')
    })

    it('classifies a unique violation (23505)', () => {
      expect(classifySyncError({ code: '23505', message: 'duplicate key value' })).toBe('permanent')
    })

    it('classifies a check-constraint violation (23514)', () => {
      expect(classifySyncError({ code: '23514', message: 'violates check constraint' })).toBe(
        'permanent',
      )
    })

    it('classifies a 400 from storage', () => {
      expect(classifySyncError({ status: 400, message: 'Bad Request' })).toBe('permanent')
    })

    it('classifies PGRST116 (single() got no row)', () => {
      expect(classifySyncError({ code: 'PGRST116', message: 'no rows' })).toBe('permanent')
    })
  })

  describe('transient — retried, but counted', () => {
    it('classifies an expired JWT (PGRST301) — auth-js refreshes behind us', () => {
      expect(classifySyncError({ code: 'PGRST301', message: 'JWT expired' })).toBe('transient')
    })

    it('classifies a statement timeout (57014)', () => {
      expect(classifySyncError({ code: '57014', message: 'canceling statement' })).toBe('transient')
    })

    it('classifies the connection-exception class (08xxx)', () => {
      expect(classifySyncError({ code: '08006', message: 'connection failure' })).toBe('transient')
    })

    it('classifies 5xx and 429', () => {
      expect(classifySyncError({ status: 503, message: 'unavailable' })).toBe('transient')
      expect(classifySyncError({ status: 429, message: 'rate limited' })).toBe('transient')
    })

    it('treats 401/403 as transient — a token caught mid-refresh must not be retired', () => {
      expect(classifySyncError({ status: 401, message: 'unauthorized' })).toBe('transient')
      expect(classifySyncError({ status: 403, message: 'forbidden' })).toBe('transient')
    })

    it('defaults an unrecognised failure to transient rather than discarding a write', () => {
      expect(classifySyncError(new Error('something odd'))).toBe('transient')
      expect(classifySyncError(undefined)).toBe('transient')
      expect(classifySyncError('a bare string')).toBe('transient')
    })
  })
})

describe('describeSyncError', () => {
  it('prefixes the code when there is one', () => {
    expect(describeSyncError({ code: '42501', message: 'denied' })).toBe('[42501] denied')
  })

  it('falls back to the message alone', () => {
    expect(describeSyncError({ message: 'boom' })).toBe('boom')
  })

  it('caps the length so a stack trace cannot bloat the outbox row', () => {
    expect(describeSyncError({ message: 'x'.repeat(1000) })).toHaveLength(300)
  })
})
