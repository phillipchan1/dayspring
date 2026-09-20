import { describe, it, expect } from 'vitest'
import { EditorState, type Transaction } from '@codemirror/state'
import { deleteCharBackward, deleteCharForward } from '@codemirror/commands'
import { parseSpiritualBlocks } from '@/lib/spiritualBlocks'
import { EditorView, type Command, type DecorationSet } from '@codemirror/view'
import { RangeSet } from '@codemirror/state'
import { spiritualBlocksField } from './spiritualBlocksField'
import { spiritualBlockExtension } from './spiritualBlockDecoration'

const ID = '11111111-1111-1111-1111-111111111111'
// A scripture block followed by its trailing newline — exactly what
// completeSlashInsert leaves in the document after a /scripture insert.
const SCRIPTURE = '```dayspring-scripture ' + ID + '\nDelight in the LORD\nPsalm 37:4\n```\n'

/** Every decoration in the facet, with the bit of spec each assertion needs. */
function decorations(
  state: EditorState,
): Array<{ from: number; to: number; class: string | undefined; widget: boolean }> {
  const out: Array<{ from: number; to: number; class: string | undefined; widget: boolean }> = []
  for (const input of state.facet(EditorView.decorations)) {
    const set = input as DecorationSet
    if (!(set instanceof RangeSet)) continue
    const iter = set.iter()
    while (iter.value) {
      const spec = iter.value.spec as { class?: string; widget?: unknown }
      out.push({ from: iter.from, to: iter.to, class: spec.class, widget: Boolean(spec.widget) })
      iter.next()
    }
  }
  return out
}

/** The `class` of the line decoration sitting at the start of line `n`, if any. */
function lineClass(state: EditorState, n: number): string | undefined {
  const at = state.doc.line(n).from
  return decorations(state).find((d) => d.from === at && d.to === at)?.class
}

describe('prayer and sense render as marked lines, not block widgets', () => {
  const ext = [spiritualBlocksField, spiritualBlockExtension(() => {})]
  const PRAYER = '```dayspring-pray ' + ID + '\nkeep my father steady today\n```\n'

  it('draws no block widget for a prayer', () => {
    const state = EditorState.create({ doc: PRAYER, extensions: ext })
    expect(decorations(state).some((d) => d.widget)).toBe(false)
  })

  // The fence delimiters stay in the document — search, sync and export all read
  // them — they simply have no height. `display: none` is not an option here:
  // CodeMirror can't measure a hidden line, so its coordinate→position map
  // drifts and clicks land on the wrong line.
  it('collapses both fence lines and marks the writer’s line between them', () => {
    const state = EditorState.create({ doc: PRAYER, extensions: ext })
    expect(lineClass(state, 1)).toBe('cm-mark-fence')
    expect(lineClass(state, 2)).toContain('cm-mark-line--prayer')
    expect(lineClass(state, 3)).toBe('cm-mark-fence')
    // The document is untouched: the fence is still there to be parsed.
    expect(state.doc.line(1).text).toContain('```dayspring-pray')
  })

  it('caps the run at both ends so the ground has ends', () => {
    const doc = '```dayspring-sense ' + ID + '\nsomething is being asked of me\nand I am not sure what\nbut it is not nothing\n```\n'
    const state = EditorState.create({ doc, extensions: ext })
    expect(lineClass(state, 2)).toContain('cm-mark-line--first')
    expect(lineClass(state, 2)).not.toContain('cm-mark-line--last')
    expect(lineClass(state, 3)).toBe('cm-mark-line cm-mark-line--sense')
    expect(lineClass(state, 4)).toContain('cm-mark-line--last')
  })

  it('marks a single-line run as both first and last', () => {
    const state = EditorState.create({ doc: PRAYER, extensions: ext })
    expect(lineClass(state, 2)).toBe(
      'cm-mark-line cm-mark-line--prayer cm-mark-line--first cm-mark-line--last',
    )
  })

  // An empty capture still serializes one blank body line, and that line has to
  // carry the mark or the prayer disappears from the page entirely.
  it('still marks an empty capture', () => {
    const doc = '```dayspring-pray ' + ID + '\n\n```\n'
    const state = EditorState.create({ doc, extensions: ext })
    expect(lineClass(state, 2)).toContain('cm-mark-line--prayer')
  })

  it('handles a prayer at end-of-document with no trailing newline', () => {
    const doc = '```dayspring-pray ' + ID + '\namen\n```'
    const state = EditorState.create({ doc, extensions: ext })
    expect(lineClass(state, 1)).toBe('cm-mark-fence')
    expect(lineClass(state, 2)).toContain('cm-mark-line--prayer')
    expect(lineClass(state, 3)).toBe('cm-mark-fence')
  })

  // Prose either side of a marking must stay plain prose.
  it('leaves the surrounding paragraphs alone', () => {
    const doc = 'before\n\n' + PRAYER + '\nafter\n'
    const state = EditorState.create({ doc, extensions: ext })
    expect(lineClass(state, 1)).toBeUndefined()
    expect(lineClass(state, 3)).toBe('cm-mark-fence')
    expect(lineClass(state, 4)).toContain('cm-mark-line--prayer')
    expect(lineClass(state, 5)).toBe('cm-mark-fence')
    expect(lineClass(state, 7)).toBeUndefined()
  })

  // Borrowed words are still set apart — just no longer by a replace widget.
  it('draws scripture as its own lines alongside a marked prayer', () => {
    const state = EditorState.create({ doc: PRAYER + '\n' + SCRIPTURE, extensions: ext })
    // Scripture's two widgets — the `\u22ef` menu and the citation's arrow — are
    // both point decorations, never a range that replaces text. A zero-width
    // `from === to` is exactly what says so.
    const widgets = decorations(state).filter((d) => d.widget)
    expect(widgets).toHaveLength(2)
    for (const w of widgets) expect(w.to).toBe(w.from)
    expect(lineClass(state, 6)).toContain('cm-scripture-line')
  })
})

describe('the line break in front of a fence', () => {
  const ext = [spiritualBlocksField, spiritualBlockExtension(() => {})]
  const FENCE = '```dayspring-scripture ' + ID + '\nWait for the LORD\nPsalm 27:14 · ESV\n```'
  const ABOVE = 'Lord i wait on you. i wait on the lord\n'

  /**
   * Run an editing command against a state, the way a keypress would. The
   * commands only read `state` and `dispatch`, so a bare pair stands in for a
   * view — no DOM to mount, nothing to measure.
   */
  function press(cmd: Command, doc: string, anchor: number, head = anchor): EditorState {
    let state = EditorState.create({ doc, selection: { anchor, head }, extensions: ext })
    cmd({ state, dispatch: (tr: Transaction) => (state = tr.state) } as unknown as EditorView)
    return state
  }

  const blockCount = (s: EditorState) => parseSpiritualBlocks(s.doc.toString()).length

  // The reported bug. The caret rests on the empty-looking row above a rendered
  // block — really the start of the fence line — and Backspace glued the fence
  // onto the paragraph above, dumping raw ```dayspring-scripture <id> on screen.
  it('Backspace from the row above a block goes up a line and leaves the fence alone', () => {
    const doc = ABOVE + FENCE
    const s = press(deleteCharBackward, doc, ABOVE.length)
    expect(s.doc.toString()).toBe(doc)
    expect(blockCount(s)).toBe(1)
    expect(s.selection.main.head).toBe(ABOVE.length - 1)
  })

  it('Delete from the end of the line above leaves the fence alone', () => {
    const doc = ABOVE + FENCE
    const s = press(deleteCharForward, doc, ABOVE.length - 1)
    expect(s.doc.toString()).toBe(doc)
    expect(blockCount(s)).toBe(1)
  })

  it('a selection running down onto the block deletes the text and keeps the break', () => {
    const doc = ABOVE + FENCE
    const s = press(deleteCharBackward, doc, 4, ABOVE.length)
    expect(s.doc.toString()).toBe('Lord\n' + FENCE)
    expect(blockCount(s)).toBe(1)
  })

  it('still lets a whole line go, break and all, since the fence then starts a line', () => {
    const s = press(deleteCharBackward, ABOVE + FENCE, 0, ABOVE.length)
    expect(s.doc.toString()).toBe(FENCE)
    expect(blockCount(s)).toBe(1)
  })

  it('still removes a blank line above the block', () => {
    const doc = ABOVE + '\n' + FENCE
    const s = press(deleteCharBackward, doc, ABOVE.length + 1)
    expect(s.doc.toString()).toBe(ABOVE + FENCE)
    expect(blockCount(s)).toBe(1)
  })

  it('still clears everything when the block goes too', () => {
    const doc = ABOVE + FENCE
    const s = press(deleteCharBackward, doc, 0, doc.length)
    expect(s.doc.toString()).toBe('')
  })
})
