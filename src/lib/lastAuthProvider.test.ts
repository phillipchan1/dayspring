import { describe, it, expect, beforeEach } from 'vitest'
import { readLastAuthProvider, rememberAuthProvider } from './lastAuthProvider'

// Minimal localStorage stand-in — the tests run in the `node` environment.
beforeEach(() => {
  const store = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as Storage
})

describe('lastAuthProvider', () => {
  it('remembers a provider across reads', () => {
    rememberAuthProvider('apple')
    expect(readLastAuthProvider()).toBe('apple')
  })

  it('reports nothing before the first sign-in', () => {
    expect(readLastAuthProvider()).toBeNull()
  })

  it('keeps the last provider rather than the first', () => {
    rememberAuthProvider('google')
    rememberAuthProvider('apple')
    expect(readLastAuthProvider()).toBe('apple')
  })

  // app_metadata.provider is untyped and can name a provider we don't show a
  // button for. Storing it would produce a hint the user cannot act on.
  it('ignores providers we do not offer', () => {
    rememberAuthProvider('google')
    rememberAuthProvider('email')
    rememberAuthProvider(undefined)
    rememberAuthProvider(null)
    rememberAuthProvider(42)
    expect(readLastAuthProvider()).toBe('google')
  })

  it('survives storage being unavailable', () => {
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('denied')
      },
    } as unknown as Storage

    expect(() => rememberAuthProvider('apple')).not.toThrow()
    expect(readLastAuthProvider()).toBeNull()
  })
})
