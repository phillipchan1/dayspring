// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { voiceCaretExtension, voiceCaretSupported } from './voiceCaret'

describe('voiceCaretSupported', () => {
  // The system caret on a touch OS is part of its text machinery (handles,
  // loupe, autocorrect) — those keep it.
  it('keeps the system caret on iPhone, iPad and Android', () => {
    expect(voiceCaretSupported('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe(false)
    expect(voiceCaretSupported('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)')).toBe(false)
    expect(voiceCaretSupported('Mozilla/5.0 (Linux; Android 15; Pixel 9)')).toBe(false)
  })

  it('draws the voice caret on a desktop browser', () => {
    expect(voiceCaretSupported('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15')).toBe(true)
    expect(voiceCaretSupported('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0')).toBe(true)
  })
})

describe('voiceCaretExtension', () => {
  it('draws its layer and leaves selection native', () => {
    const view = new EditorView({
      state: EditorState.create({ doc: 'Title\nbody', extensions: [voiceCaretExtension()] }),
      parent: document.body,
    })
    expect(view.dom.querySelector('.cm-voiceCaretLayer')).not.toBeNull()
    // Cursor only: drawSelection's selection layer would replace the native
    // ::selection theme.ts depends on.
    expect(view.dom.querySelector('.cm-selectionLayer')).toBeNull()
    view.destroy()
  })

  it('restarts the blink on every keystroke', () => {
    const view = new EditorView({
      state: EditorState.create({ doc: 'Title', extensions: [voiceCaretExtension()] }),
      parent: document.body,
    })
    const layer = view.dom.querySelector<HTMLElement>('.cm-voiceCaretLayer')!
    const before = layer.dataset.beat
    view.dispatch({ changes: { from: 5, insert: 'x' } })
    expect(layer.dataset.beat).not.toBe(before)
    view.destroy()
  })
})
