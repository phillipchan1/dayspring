// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { applyEditorFace, EDITOR_FACE_METRICS, EDITOR_FONT_VARS, type EditorFont } from './settings'
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
