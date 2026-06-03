import { describe, expect, it } from 'vitest'
import { matchSlashBefore } from './slashDetect'

describe('matchSlashBefore', () => {
  // cursor is the doc position the `before` text ends at; we pass before.length
  // so `from` (the `/` position) is reported relative to the start of `before`.
  const at = (before: string) => matchSlashBefore(before, before.length)

  it('opens on a slash at line start', () => {
    expect(at('/')).toEqual({ query: '', from: 0 })
    expect(at('/scr')).toEqual({ query: 'scr', from: 0 })
  })

  it('opens on a slash after whitespace', () => {
    const m = at('write /pray')
    expect(m).not.toBeNull()
    expect(m!.query).toBe('pray')
    expect('write /pray'[m!.from]).toBe('/')
  })

  // Regression: the old rule fired on any slash, popping the palette over URLs,
  // dates, fractions, and mid-word slashes.
  it('does NOT open inside URLs, dates, fractions, or words', () => {
    expect(at('http://')).toBeNull()
    expect(at('see http://example.com/path')).toBeNull()
    expect(at('6/3')).toBeNull()
    expect(at('1/2')).toBeNull()
    expect(at('and/or')).toBeNull()
    expect(at('w/')).toBeNull()
  })

  it('reports the slash position correctly with a leading space', () => {
    const before = 'a note /sense'
    const m = matchSlashBefore(before, before.length)
    expect(before[m!.from]).toBe('/')
    expect(m!.query).toBe('sense')
  })
})
