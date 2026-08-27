import { readFileSync } from 'node:fs'
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

  it('ships four light and five dark palettes', () => {
    expect(THEMES.filter((t) => t.family === 'light')).toHaveLength(4)
    expect(THEMES.filter((t) => t.family === 'dark')).toHaveLength(5)
  })

  it('gives every registered theme a matching [data-theme] block', () => {
    const css = readFileSync(new URL('../styles/themes.css', import.meta.url), 'utf8')
    for (const t of THEMES) expect(css).toContain(`[data-theme='${t.id}']`)
  })

  it('paints highlighter washes from theme tokens in every palette', () => {
    // A wash that only paints in some palettes is a highlight that "doesn't
    // work" — Vigil used to miss the dark alpha group, and the editor wash
    // used to hop through a CodeMirror custom property that never resolved.
    const themes = readFileSync(new URL('../styles/themes.css', import.meta.url), 'utf8')
    const global = readFileSync(new URL('../styles/global.css', import.meta.url), 'utf8')
    for (const hue of ['amber', 'rose', 'sage', 'sky', 'lilac']) {
      expect(themes).toContain(`--hl-${hue}:`)
      expect(global).toContain(`.cm-hl--${hue} { background-color: rgba(var(--hl-${hue}), var(--hl-alpha))`)
    }
    const grouped = themes.slice(Math.max(0, themes.lastIndexOf('--hl-alpha: 0.24') - 280), themes.lastIndexOf('--hl-alpha: 0.24'))
    for (const t of THEMES.filter((th) => th.family === 'dark')) {
      expect(grouped).toContain(`[data-theme='${t.id}']`)
    }
  })

  it('lists every theme in the pre-paint boot script, on the right side', () => {
    // index.html resolves the theme before React mounts; a palette missing from
    // its LIGHT/DARK maps silently falls back and flashes the wrong family.
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    const map = (name: string) => new RegExp(`var ${name} = \\{([^}]*)\\}`).exec(html)?.[1] ?? ''
    const light = map('LIGHT')
    const dark = map('DARK')
    for (const t of THEMES) {
      expect(t.family === 'light' ? light : dark).toContain(`${t.id}: 1`)
      expect(t.family === 'light' ? dark : light).not.toContain(`${t.id}: 1`)
    }
  })
})
