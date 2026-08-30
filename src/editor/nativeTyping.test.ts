// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import { nativeTyping, nativeTypingAttributes, rearmNativeTyping } from './nativeTyping'

describe('nativeTypingAttributes', () => {
  it('asks the OS for journal-strength correction, not a code editor', () => {
    document.documentElement.lang = 'en'
    const view = new EditorView({
      state: EditorState.create({ extensions: [nativeTyping()] }),
      parent: document.createElement('div'),
    })
    const el = view.contentDOM
    expect(el.getAttribute('spellcheck')).toBe('true')
    expect(el.getAttribute('autocorrect')).toBe('on')
    expect(el.getAttribute('autocapitalize')).toBe('sentences')
    expect(el.getAttribute('autocomplete')).toBe('on')
    expect(el.getAttribute('writingsuggestions')).toBe('true')
    expect(el.getAttribute('lang')).toBe('en')
    view.destroy()
  })

  it('re-arms correction after a programmatic wipe of the attributes', () => {
    const view = new EditorView({
      state: EditorState.create({ extensions: [nativeTypingAttributes] }),
      parent: document.createElement('div'),
    })
    const el = view.contentDOM
    el.setAttribute('spellcheck', 'false')
    el.setAttribute('autocorrect', 'off')
    el.setAttribute('writingsuggestions', 'false')
    rearmNativeTyping(view)
    expect(el.getAttribute('spellcheck')).toBe('true')
    expect(el.getAttribute('autocorrect')).toBe('on')
    expect(el.getAttribute('writingsuggestions')).toBe('true')
    view.destroy()
  })
})
