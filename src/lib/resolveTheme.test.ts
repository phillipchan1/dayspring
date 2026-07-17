import { describe, expect, it } from 'vitest'
import { isLightTheme, resolveTheme, THEMES, type ThemeId } from './resolveTheme'
import type { Settings } from './settings'

function settings(patch: Partial<Settings>): Settings {
  return { appearance: 'auto', lightTheme: 'dawn', darkTheme: 'ink', ...patch } as Settings
}

describe('resolveTheme', () => {
  it('returns the chosen light palette in light mode', () => {
    expect(resolveTheme(settings({ appearance: 'light', lightTheme: 'vellum' }), true)).toBe('vellum')
  })

  it('returns the chosen dark palette in dark mode', () => {
    expect(resolveTheme(settings({ appearance: 'dark', darkTheme: 'compline' }), false)).toBe('compline')
  })

  it('auto pairs the two slots by system preference', () => {
    const s = settings({ appearance: 'auto', lightTheme: 'sabbath', darkTheme: 'nocturne' })
    expect(resolveTheme(s, false)).toBe('sabbath')
    expect(resolveTheme(s, true)).toBe('nocturne')
  })

  it('falls back when a slot holds a palette of the wrong family or a stale id', () => {
    // A dark id parked in the light slot (or a removed theme) must not leak through.
    expect(resolveTheme(settings({ appearance: 'light', lightTheme: 'ink' }), false)).toBe('dawn')
    expect(resolveTheme(settings({ appearance: 'dark', darkTheme: 'one-dark' as ThemeId }), true)).toBe('ink')
  })
})

describe('theme registry', () => {
  it('classifies every registered theme as light or dark', () => {
    for (const t of THEMES) expect(isLightTheme(t.id)).toBe(t.family === 'light')
  })

  it('ships four light and four dark palettes', () => {
    expect(THEMES.filter((t) => t.family === 'light')).toHaveLength(4)
    expect(THEMES.filter((t) => t.family === 'dark')).toHaveLength(4)
  })
})
