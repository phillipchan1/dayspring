import { describe, expect, it } from 'vitest'
import {
  LOOPBACK_STATE_RE,
  createLoopbackState,
  loopbackCallbackMatches,
} from './loopbackOAuth'

describe('createLoopbackState', () => {
  it('is 128 bits of lowercase hex', () => {
    const state = createLoopbackState()
    expect(state).toMatch(LOOPBACK_STATE_RE)
    expect(state).toHaveLength(32)
    expect(createLoopbackState()).not.toBe(state)
  })
})

describe('loopbackCallbackMatches', () => {
  const state = '0123456789abcdef0123456789abcdef'

  it('accepts the exact path plus an in-process code query', () => {
    expect(
      loopbackCallbackMatches(
        `http://127.0.0.1:54721/auth-callback/${state}?code=ott-1`,
        state,
      ),
    ).toBe(true)
  })

  it('ignores a wrong or missing state so sign-in does not run', () => {
    expect(
      loopbackCallbackMatches(
        `http://127.0.0.1:54721/auth-callback/ffffffffffffffffffffffffffffffff?code=attacker`,
        state,
      ),
    ).toBe(false)
    expect(
      loopbackCallbackMatches('http://127.0.0.1:54721/auth-callback?code=attacker', state),
    ).toBe(false)
    expect(
      loopbackCallbackMatches(`http://127.0.0.1:54721/auth-callback/${state}?code=ott-1`, 'aa'.repeat(16)),
    ).toBe(false)
  })
})
