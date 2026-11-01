import { EditorSelection, EditorState, type Transaction } from '@codemirror/state'
import type { Command, EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import {
  __setSegmenterForTests,
  cursorParagraphBackward,
  cursorParagraphForward,
  cursorWordBackward,
  cursorWordForward,
  deleteWordBackward,
  deleteWordForward,
  paragraphEndAfter,
  paragraphStartBefore,
  proseKeymap,
  selectParagraphBackward,
  selectParagraphForward,
  selectWordBackward,
  writingDefaultKeymap,
} from './proseKeymap'

/**
 * Run a command against a bare EditorState. `|` marks the caret, `[`…`]` a
 * selection (anchor at `[`, head at `]`). Returns the doc with the result
 * marked the same way.
 */
function run(cmd: Command, marked: string): { out: string; handled: boolean } {
  let doc = marked
  let anchor: number
  let head: number
  if (marked.includes('|')) {
    anchor = head = marked.indexOf('|')
    doc = marked.replace('|', '')
  } else {
    anchor = marked.indexOf('[')
    doc = marked.replace('[', '')
    head = doc.indexOf(']')
    doc = doc.replace(']', '')
  }
  let state = EditorState.create({ doc, selection: EditorSelection.single(anchor, head) })
  const view = {
    get state() {
      return state
    },
    dispatch(tr: Transaction) {
      state = tr.state
    },
  } as unknown as EditorView
  const handled = cmd(view)
  const sel = state.selection.main
  const text = state.doc.toString()
  if (sel.empty) return { out: text.slice(0, sel.head) + '|' + text.slice(sel.head), handled }
  // anchor/head order as written: [ at anchor, ] at head
  const marks = [
    { at: sel.anchor, ch: '[' },
    { at: sel.head, ch: ']' },
  ].sort((a, b) => b.at - a.at)
  let out = text
  for (const m of marks) out = out.slice(0, m.at) + m.ch + out.slice(m.at)
  return { out, handled }
}

const out = (cmd: Command, marked: string) => run(cmd, marked).out

afterEach(() => __setSegmenterForTests(undefined))

describe('paragraph boundaries (NSTextView ⌥↑/⌥↓)', () => {
  const doc = EditorState.create({ doc: 'One two.\n\nThree four.' }).doc
  it('goes to the start of this paragraph, then the one before', () => {
    expect(paragraphStartBefore(doc, 15)).toBe(10)
    expect(paragraphStartBefore(doc, 10)).toBe(9)
    expect(paragraphStartBefore(doc, 9)).toBe(0)
    expect(paragraphStartBefore(doc, 0)).toBe(0)
  })
  it('goes to the end of this paragraph, then the one after', () => {
    expect(paragraphEndAfter(doc, 3)).toBe(8)
    expect(paragraphEndAfter(doc, 8)).toBe(9)
    expect(paragraphEndAfter(doc, 9)).toBe(21)
  })
})

describe('⌥↑ / ⌥↓ move by paragraph and never move a line', () => {
  it('⌥↑ moves the caret, the text stays put', () => {
    expect(out(cursorParagraphBackward, 'One.\nTwo th|ree.')).toBe('One.\n|Two three.')
    expect(out(cursorParagraphBackward, 'One.\n|Two three.')).toBe('|One.\nTwo three.')
  })
  it('⌥↓ moves to the end of the paragraph, then the next', () => {
    expect(out(cursorParagraphForward, 'O|ne.\nTwo.')).toBe('One.|\nTwo.')
    expect(out(cursorParagraphForward, 'One.|\nTwo.')).toBe('One.\nTwo.|')
  })
  it('collapses a selection to the paragraph edge it moves toward', () => {
    expect(out(cursorParagraphBackward, 'One.\nTw[o th]ree.')).toBe('One.\n|Two three.')
  })
  it('⇧⌥↑ / ⇧⌥↓ extend the selection and never duplicate anything', () => {
    expect(out(selectParagraphBackward, 'One.\nTwo th|ree.')).toBe('One.\n]Two th[ree.')
    expect(out(selectParagraphForward, 'One.\nTwo th|ree.')).toBe('One.\nTwo th[ree.]')
  })
  it('swallows the chord at the top of the document', () => {
    const r = run(cursorParagraphBackward, '|One.')
    expect(r.handled).toBe(true)
    expect(r.out).toBe('|One.')
  })
})

describe('⌥← / ⌥→ by Intl.Segmenter words', () => {
  it('treats contractions and possessives as one word', () => {
    expect(out(cursorWordBackward, "I don't know|")).toBe("I don't |know")
    expect(out(cursorWordBackward, "I don't |know")).toBe("I |don't know")
    expect(out(cursorWordBackward, 'Praise God’s| name')).toBe('Praise |God’s name')
    expect(out(cursorWordForward, '|God’s name')).toBe('God’s| name')
  })
  it('passes over punctuation to the word before it', () => {
    expect(out(cursorWordBackward, 'Hello world. |')).toBe('Hello |world. ')
  })
  it('crosses a paragraph break once', () => {
    expect(out(cursorWordBackward, 'First line\n|Second')).toBe('First |line\nSecond')
    expect(out(cursorWordForward, 'First line|\nSecond')).toBe('First line\nSecond|')
  })
  it('⇧⌥← extends', () => {
    expect(out(selectWordBackward, "it isn't|")).toBe("it ]isn't[")
  })
})

describe('⌥⌫ / ⌥⌦ delete by word', () => {
  it("deletes a whole contraction, not half of it", () => {
    expect(out(deleteWordBackward, "we can't|")).toBe('we |')
    expect(out(deleteWordBackward, 'thank God’s| grace')).toBe('thank | grace')
  })
  it('takes the punctuation after the word with it', () => {
    expect(out(deleteWordBackward, 'Hello world. |')).toBe('Hello |')
  })
  it('deletes forward to the end of the next word', () => {
    expect(out(deleteWordForward, "|don't stop")).toBe('| stop')
  })
  it('deletes one emoji per press, never the line above it', () => {
    expect(out(deleteWordBackward, 'Amen\n🙏🙏|')).toBe('Amen\n🙏|')
  })
  it('stops at marks the writer can see rather than reaching up a line', () => {
    expect(out(deleteWordBackward, 'Words\n---|')).toBe('Words\n|')
  })
  it('at the start of a paragraph, joins it to the word above', () => {
    expect(out(deleteWordBackward, 'Ends here\n|Next')).toBe('Ends |Next')
  })
  it('leaves a selection to the selection delete', () => {
    expect(run(deleteWordBackward, 'a [bc] d').handled).toBe(false)
  })
})

describe('without Intl.Segmenter', () => {
  it('leaves the word keys to CodeMirror', () => {
    __setSegmenterForTests(null)
    expect(run(cursorWordBackward, 'one two|').handled).toBe(false)
    expect(run(deleteWordBackward, 'one two|').handled).toBe(false)
  })
})

describe('the keymap', () => {
  const keys = (bs: readonly { key?: string; mac?: string }[]) => bs.flatMap((b) => [b.key, b.mac])
  it('drops the code-editor bindings', () => {
    const k = keys(writingDefaultKeymap)
    for (const gone of ['Alt-ArrowUp', 'Alt-ArrowDown', 'Shift-Alt-ArrowUp', 'Mod-/', 'Shift-Mod-k', 'Alt-A', 'Shift-Alt-m']) {
      expect(k).not.toContain(gone)
    }
  })
  it('keeps the ordinary editing keys', () => {
    const k = keys(writingDefaultKeymap)
    for (const kept of ['Mod-a', 'ArrowLeft', 'Backspace', 'Enter']) expect(k).toContain(kept)
  })
  it('binds the prose chords on the Mac', () => {
    const mac = proseKeymap.map((b) => b.mac)
    for (const chord of ['Alt-ArrowUp', 'Alt-ArrowDown', 'Alt-ArrowLeft', 'Alt-ArrowRight', 'Alt-Backspace', 'Alt-Delete', 'Ctrl-l', 'Home', 'End']) {
      expect(mac).toContain(chord)
    }
  })
})
