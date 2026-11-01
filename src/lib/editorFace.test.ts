// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyEditorFace,
  EDITOR_FACE_METRICS,
  EDITOR_FONT_VARS,
  EXTRA_EDITOR_FONTS,
  resolveWritingFace,
  WRITING_FACE_VARS,
  writingFacePatch,
  type EditorFont,
  type ExtraEditorFont,
} from './settings'
import { VOICES } from './voices'

const THEMES_CSS = readFileSync(resolve(__dirname, '../styles/themes.css'), 'utf8')

/** The custom-property names a token like `var(--face-serif)` points at. */
const tokenOf = (v: string) => /var\((--[\w-]+)\)/.exec(v)?.[1] ?? ''

describe('the writing faces are the faces they are named', () => {
  // A voice repoints --font-serif and --font-display (themes.css), which is how
  // "Serif" came to set JetBrains Mono in Plainsong and "Literary" Archivo in
  // Cloister. A face picked by name must point somewhere no voice can move.
  it('points every face at a token no voice block declares', () => {
    const voiceBlocks = THEMES_CSS.split(/\n(?=\[data-theme=)/).slice(1).join('\n')
    for (const font of Object.keys(EDITOR_FONT_VARS) as EditorFont[]) {
      const token = tokenOf(EDITOR_FONT_VARS[font])
      expect(token, font).not.toBe('--font-serif')
      expect(token, font).not.toBe('--font-display')
      expect(voiceBlocks.includes(`${token}:`), `${font} → ${token} is repointed by a voice`).toBe(false)
      expect(THEMES_CSS.includes(`${token}:`), `${font} → ${token} is declared`).toBe(true)
    }
  })

  it('has metrics for every face', () => {
    for (const font of Object.keys(EDITOR_FONT_VARS) as EditorFont[]) {
      expect(EDITOR_FACE_METRICS[font].scale).toBeGreaterThan(0.5)
      expect(EDITOR_FACE_METRICS[font].scale).toBeLessThanOrEqual(1)
    }
  })
})

describe('applyEditorFace', () => {
  const root = () => document.createElement('div')

  it('clears every inline property while the face follows the voice', () => {
    const el = root()
    el.style.setProperty('--font-editor', 'x')
    el.style.setProperty('--font-scale', '0.5')
    applyEditorFace(el, { voice: 'dawn', editorFont: 'serif', editorFontAuto: true })
    expect(el.style.getPropertyValue('--font-editor')).toBe('')
    expect(el.style.getPropertyValue('--font-scale')).toBe('')
    expect(el.style.getPropertyValue('--line-height-scale')).toBe('')
  })

  it('gives a hand-picked face its own scale, not the voice’s', () => {
    // Mono in Dawn was JetBrains Mono at a full 24px.
    const el = root()
    applyEditorFace(el, { voice: 'dawn', editorFont: 'mono', editorFontAuto: false })
    expect(el.style.getPropertyValue('--font-editor')).toBe('var(--font-mono)')
    expect(el.style.getPropertyValue('--font-scale')).toBe(String(EDITOR_FACE_METRICS.mono.scale))
    // …and Serif in Plainsong was Newsreader at 17px.
    applyEditorFace(el, { voice: 'plainsong', editorFont: 'serif', editorFontAuto: false })
    expect(el.style.getPropertyValue('--font-editor')).toBe('var(--face-serif)')
    expect(el.style.getPropertyValue('--font-scale')).toBe('1')
  })

  it('leaves the voice’s own tuning when the picked face is the voice’s face', () => {
    for (const voice of VOICES) {
      const el = root()
      applyEditorFace(el, { voice: voice.id, editorFont: voice.face, editorFontAuto: false })
      expect(el.style.getPropertyValue('--font-scale'), voice.id).toBe('')
    }
  })
})

describe('the faces added after stable shipped', () => {
  const extras = Object.keys(EXTRA_EDITOR_FONTS) as ExtraEditorFont[]

  // Same trap as the six above: a voice repoints --font-serif and --font-display,
  // so a face picked by name must point at a token no voice can move.
  it('points every extra face at a fixed token that is declared', () => {
    const voiceBlocks = THEMES_CSS.split(/\n(?=\[data-theme=)/).slice(1).join('\n')
    for (const font of extras) {
      const token = tokenOf(EXTRA_EDITOR_FONTS[font].var)
      expect(token, font).toMatch(/^--face-/)
      expect(voiceBlocks.includes(`${token}:`), `${font} → ${token} is repointed by a voice`).toBe(false)
      expect(THEMES_CSS.includes(`${token}:`), `${font} → ${token} is declared`).toBe(true)
    }
  })

  // The older client indexes EDITOR_FACE_METRICS[settings.editorFont].scale, so
  // what we project into `editorFont` has to be an id it already knows.
  it('projects each into an id the older client can render', () => {
    for (const font of extras) {
      const { fallback } = EXTRA_EDITOR_FONTS[font]
      expect(EDITOR_FONT_VARS[fallback], font).toBeTruthy()
      expect(EDITOR_FACE_METRICS[fallback], font).toBeTruthy()
    }
  })

  it('has a sample token and sane metrics for every face', () => {
    for (const font of extras) {
      expect(WRITING_FACE_VARS[font], font).toBe(EXTRA_EDITOR_FONTS[font].var)
      expect(EXTRA_EDITOR_FONTS[font].scale).toBeGreaterThan(0.5)
      expect(EXTRA_EDITOR_FONTS[font].scale).toBeLessThanOrEqual(1)
      expect(EXTRA_EDITOR_FONTS[font].leading).toBeGreaterThanOrEqual(1)
    }
  })

  it('has a font file imported for the family each one names', () => {
    const main = readFileSync(resolve(__dirname, '../main.tsx'), 'utf8')
    const packages = { lora: 'lora', merriweather: 'merriweather', literata: 'literata', lato: 'lato' }
    for (const font of extras) {
      expect(main, font).toMatch(new RegExp(`@fontsource(-variable)?/${packages[font]}`))
    }
  })

  describe('writingFacePatch', () => {
    it('stores the real face beside a fallback an older client understands', () => {
      expect(writingFacePatch('lora')).toEqual({
        editorFontAuto: false,
        editorFont: 'serif',
        editorFontExtra: 'lora',
      })
      expect(writingFacePatch('lato')).toMatchObject({ editorFont: 'sans', editorFontExtra: 'lato' })
    })

    it('clears the extra face (null, so it overwrites on the other device) when a built-in is picked', () => {
      expect(writingFacePatch('mono')).toEqual({
        editorFontAuto: false,
        editorFont: 'mono',
        editorFontExtra: null,
      })
      // 'serif' is Lora's own fallback — the case a missing clear would leave Lora standing.
      expect(writingFacePatch('serif').editorFontExtra).toBeNull()
    })
  })

  describe('resolveWritingFace', () => {
    it('reads the extra face while editorFont still holds its fallback', () => {
      expect(
        resolveWritingFace({ editorFont: 'serif', editorFontAuto: false, editorFontExtra: 'merriweather' }),
      ).toBe('merriweather')
    })

    it('lets the voice win while following it', () => {
      expect(
        resolveWritingFace({ editorFont: 'serif', editorFontAuto: true, editorFontExtra: 'lora' }),
      ).toBe('serif')
    })

    it('treats the extra as stale once another client has chosen again', () => {
      // The older client set Mono and left our key where it was.
      expect(
        resolveWritingFace({ editorFont: 'mono', editorFontAuto: false, editorFontExtra: 'lora' }),
      ).toBe('mono')
    })

    it('falls back to editorFont for a face a still-newer client added', () => {
      expect(
        resolveWritingFace({
          editorFont: 'serif',
          editorFontAuto: false,
          editorFontExtra: 'fraktur' as ExtraEditorFont,
        }),
      ).toBe('serif')
      // …and never trips over an inherited property name.
      expect(
        resolveWritingFace({
          editorFont: 'sans',
          editorFontAuto: false,
          editorFontExtra: 'constructor' as ExtraEditorFont,
        }),
      ).toBe('sans')
    })

    it('is just editorFont when no extra was ever chosen', () => {
      expect(resolveWritingFace({ editorFont: 'readable', editorFontAuto: false })).toBe('readable')
      expect(resolveWritingFace({ editorFont: 'readable', editorFontAuto: false, editorFontExtra: null })).toBe(
        'readable',
      )
    })
  })

  describe('applyEditorFace', () => {
    it('sets the extra face and its own scale, not the voice’s', () => {
      const el = document.createElement('div')
      applyEditorFace(el, { voice: 'plainsong', editorFont: 'serif', editorFontAuto: false, editorFontExtra: 'merriweather' })
      expect(el.style.getPropertyValue('--font-editor')).toBe('var(--face-merriweather)')
      expect(el.style.getPropertyValue('--font-scale')).toBe(String(EXTRA_EDITOR_FONTS.merriweather.scale))
      expect(el.style.getPropertyValue('--line-height-scale')).toBe(String(EXTRA_EDITOR_FONTS.merriweather.leading))
    })

    it('drops the extra face when the voice is followed again', () => {
      const el = document.createElement('div')
      applyEditorFace(el, { voice: 'dawn', editorFont: 'serif', editorFontAuto: false, editorFontExtra: 'lora' })
      applyEditorFace(el, { voice: 'dawn', editorFont: 'serif', editorFontAuto: true, editorFontExtra: 'lora' })
      expect(el.style.getPropertyValue('--font-editor')).toBe('')
      expect(el.style.getPropertyValue('--font-scale')).toBe('')
    })
  })
})
