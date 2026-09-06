import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { THEMES, resolveTheme, type ThemeId } from './resolveTheme'
import { DEFAULT_SETTINGS, migrateSettings, reconcileVoice, type Settings } from './settings'
import { VOICES, getVoice, isNightOnly, voiceForPalettes } from './voices'

const themesCss = readFileSync(new URL('../styles/themes.css', import.meta.url), 'utf8')
const indexHtml = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')

/**
 * Every declaration block whose selector list mentions this palette — including
 * the grouped ones, since a voice declares its type once for both of its
 * grounds (`[data-theme='dawn'], [data-theme='ink'] { … }`).
 */
function blocksFor(id: ThemeId): string {
  const needle = `[data-theme='${id}']`
  const bodies: string[] = []
  for (const match of themesCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1] ?? ''
    if (selector.includes(needle)) bodies.push(match[2] ?? '')
  }
  return bodies.join('\n')
}

const KINDS = ['scripture', 'prayer', 'sense', 'desire', 'learned', 'story'] as const

describe('the voice registry', () => {
  it('gives every voice a dark ground, and every ground a real palette', () => {
    const ids = new Set(THEMES.map((t) => t.id))
    for (const v of VOICES) {
      expect(ids.has(v.dark), `${v.id}: dark`).toBe(true)
      if (v.light) expect(ids.has(v.light), `${v.id}: light`).toBe(true)
    }
  })

  it('puts each ground on the right side of the light/dark line', () => {
    const family = Object.fromEntries(THEMES.map((t) => [t.id, t.family]))
    for (const v of VOICES) {
      expect(family[v.dark], `${v.id}: dark`).toBe('dark')
      if (v.light) expect(family[v.light], `${v.id}: light`).toBe('light')
    }
  })

  it('claims each palette for at most one voice', () => {
    // Two voices sharing a ground would mean picking one silently re-pointed
    // the other — and the picker would show two rows lighting up at once.
    const seen = new Set<string>()
    for (const v of VOICES) {
      for (const g of [v.light, v.dark]) {
        if (!g) continue
        expect(seen.has(g), `${g} claimed twice`).toBe(false)
        seen.add(g)
      }
    }
  })

  it('has exactly one night-only voice', () => {
    expect(VOICES.filter((v) => v.light === null).map((v) => v.id)).toEqual(['vigil'])
  })
})

describe('a voice owns its typography', () => {
  it('sets a display face and a heading scale for every ground', () => {
    // The whole finding behind D-028: a palette that declares no font cannot
    // match a font, and headings were the body face at 1.6em/700 everywhere.
    for (const v of VOICES) {
      const css = [v.light, v.dark].filter(Boolean).map((g) => blocksFor(g as ThemeId)).join('\n')
      expect(css, `${v.id}: --font-display`).toContain('--font-display:')
      expect(css, `${v.id}: --font-editor`).toContain('--font-editor:')
      expect(css, `${v.id}: --h1-size`).toContain('--h1-size:')
      expect(css, `${v.id}: --h1-weight`).toContain('--h1-weight:')
    }
  })

  it('gives both grounds of a voice the same face', () => {
    // The point of pairing light and dark under one name: the face must not
    // change when the sun goes down.
    const face = (css: string) => /--font-display:\s*([^;]+);/.exec(css)?.[1]?.trim()
    for (const v of VOICES) {
      if (!v.light) continue
      expect(face(blocksFor(v.light)), `${v.id}`).toBe(face(blocksFor(v.dark)))
    }
  })
})

describe('marking tones', () => {
  it('gives every palette all six live kinds', () => {
    // Three of the six used to follow the palette and three did not, which is
    // why a fixed rose sat unchanged in Cloister's cool grey.
    for (const t of THEMES) {
      const css = blocksFor(t.id)
      for (const k of KINDS) expect(css, `${t.id}: --k-${k}`).toContain(`--k-${k}:`)
    }
  })

  it('keeps a palette from spending one tone on two kinds', () => {
    // "Recognisable as the same hand" survives the hexes changing, but not two
    // kinds landing on the same colour with only a glyph to tell them apart.
    for (const t of THEMES) {
      const css = blocksFor(t.id)
      const tones = KINDS.map((k) => new RegExp(`--k-${k}:\\s*([^;]+);`).exec(css)?.[1]?.trim())
      expect(tones.every(Boolean), `${t.id}: missing a tone`).toBe(true)
      expect(new Set(tones).size, `${t.id}: duplicate tones`).toBe(KINDS.length)
    }
  })
})

describe('ornament', () => {
  it('gives every palette its own thematic-break gem', () => {
    // Without one a palette falls through to the default rotated square — the
    // one shape that belongs to no theme at all, which is how Quire and Grove
    // shipped their first hour.
    for (const t of THEMES) {
      expect(themesCss, `${t.id}: no gem`).toContain(`[data-theme='${t.id}'] .cm-hr::before`)
    }
  })
})

describe('the pre-paint boot script', () => {
  it('maps every voice to the same two grounds the registry does', () => {
    // index.html resolves the theme before React mounts and duplicates this by
    // hand. Drift means the first paint flashes another voice's palette.
    const map = /var VOICES = \{([\s\S]*?)\n {10}\}/.exec(indexHtml)?.[1] ?? ''
    expect(map).not.toBe('')
    for (const v of VOICES) {
      const row = new RegExp(`${v.id}: \\[([^\\]]*)\\]`).exec(map)?.[1] ?? ''
      expect(row, `${v.id} missing from the boot map`).not.toBe('')
      expect(row).toContain(v.light ? `'${v.light}'` : 'null')
      expect(row).toContain(`'${v.dark}'`)
    }
  })
})

describe('settings stay readable by the other release channel', () => {
  const base = (patch: Partial<Settings>): Settings => ({ ...DEFAULT_SETTINGS, ...patch })

  it('projects the voice back onto the legacy slots', () => {
    // Alpha and stable share one profiles.settings row, pushed whole-object
    // last-writer-wins. A client that has never heard of `voice` still has to
    // find a real palette and a real font id in the blob.
    const s = reconcileVoice(base({ voice: 'vellum', editorFontAuto: true }))
    expect(s.lightTheme).toBe('vellum')
    expect(s.darkTheme).toBe('ember')
    expect(s.editorFont).toBe(getVoice('vellum').face)
  })

  it('never writes a font id an older client cannot resolve', () => {
    const ids = new Set(['serif', 'literary', 'typewriter', 'mono', 'sans', 'readable'])
    for (const v of VOICES) {
      const s = reconcileVoice(base({ voice: v.id, editorFontAuto: true }))
      expect(ids.has(s.editorFont), `${v.id} → ${s.editorFont}`).toBe(true)
    }
  })

  it('leaves a deliberate font choice alone', () => {
    const s = reconcileVoice(base({ voice: 'vellum', editorFontAuto: false, editorFont: 'typewriter' }))
    expect(s.editorFont).toBe('typewriter')
  })

  it('carries an existing user to the voice nearest their light palette', () => {
    // The light slot wins: it is the one most people actually chose, and the
    // dark slot was very often left at its default.
    const s = migrateSettings({ v: 4, lightTheme: 'cloister', darkTheme: 'nocturne', editorFont: 'serif' })
    expect(s.voice).toBe('cloister')
    expect(s.darkTheme).toBe('compline')
    expect(s.editorFontAuto).toBe(true)
  })

  it('treats a non-default font as deliberate and keeps it', () => {
    const s = migrateSettings({ v: 4, lightTheme: 'dawn', darkTheme: 'ink', editorFont: 'typewriter' })
    expect(s.editorFontAuto).toBe(false)
    expect(s.editorFont).toBe('typewriter')
  })

  it('does not re-run once a voice is stored', () => {
    const s = migrateSettings({ v: 4, voice: 'plainsong', editorFont: 'typewriter', editorFontAuto: false })
    expect(s.voice).toBe('plainsong')
    expect(s.editorFont).toBe('typewriter')
  })
})

describe('resolving a voice to a palette', () => {
  it('uses the voice ahead of the legacy slots', () => {
    const s = { ...DEFAULT_SETTINGS, voice: 'vellum', lightTheme: 'dawn', darkTheme: 'ink' } as Settings
    expect(resolveTheme({ ...s, appearance: 'light' }, false)).toBe('vellum')
    expect(resolveTheme({ ...s, appearance: 'dark' }, false)).toBe('ember')
  })

  it('keeps a night-only voice dark in every mode', () => {
    const s = { ...DEFAULT_SETTINGS, voice: 'vigil' } as Settings
    expect(isNightOnly('vigil')).toBe(true)
    expect(resolveTheme({ ...s, appearance: 'light' }, false)).toBe('vigil')
    expect(resolveTheme({ ...s, appearance: 'auto' }, false)).toBe('vigil')
  })

  it('falls back to the slots when no voice is stored', () => {
    const s = { ...DEFAULT_SETTINGS, lightTheme: 'sabbath' } as Settings
    delete (s as Partial<Settings>).voice
    expect(resolveTheme({ ...s, appearance: 'light' }, false)).toBe('sabbath')
  })

  it('maps an unpairable slot combination to a real voice', () => {
    expect(voiceForPalettes('vellum', 'compline')).toBe('vellum')
    expect(voiceForPalettes(undefined, 'nocturne')).toBe('plainsong')
    expect(voiceForPalettes('one-dark' as ThemeId, 'one-dark' as ThemeId)).toBe('dawn')
  })
})
