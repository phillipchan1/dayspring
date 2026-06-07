import { describe, it, expect } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView, type DecorationSet } from '@codemirror/view'
import { RangeSet } from '@codemirror/state'
import { spiritualBlocksField } from './spiritualBlocksField'
import { spiritualBlockExtension } from './spiritualBlockDecoration'

const ID = '11111111-1111-1111-1111-111111111111'
// A scripture block followed by its trailing newline — exactly what
// completeSlashInsert leaves in the document after a /scripture insert.
const SCRIPTURE = '```dayspring-scripture ' + ID + '\nDelight in the LORD\nPsalm 37:4\n```\n'

/** Collect the spiritual-block replace ranges from a state's decoration facet. */
function blockRanges(state: EditorState): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = []
  for (const input of state.facet(EditorView.decorations)) {
    const set = input as DecorationSet
    if (!(set instanceof RangeSet)) continue
    const iter = set.iter()
    while (iter.value) {
      ranges.push({ from: iter.from, to: iter.to })
      iter.next()
    }
  }
  return ranges
}

describe('spiritualBlockExtension decoration range', () => {
  const ext = [spiritualBlocksField, spiritualBlockExtension(() => {})]

  // Regression: a block:true replace range that extends past the final line
  // break makes CodeMirror render the widget DOM twice (one fence in the text,
  // two visible blocks) the moment a newline is appended after it — the
  // "scripture duplicates when I press Enter to write below it" bug. The range
  // must stop at the line boundary, before the block's trailing newline.
  it('stops the replace range before the block trailing newline', () => {
    const state = EditorState.create({ doc: SCRIPTURE, extensions: ext })
    const block = state.field(spiritualBlocksField)[0]!
    const ranges = blockRanges(state)
    expect(ranges).toHaveLength(1)
    // block.to points just past the trailing "\n"; the decoration must end one
    // char earlier, at the newline itself (a line boundary), not past it.
    expect(state.doc.sliceString(block.to - 1, block.to)).toBe('\n')
    expect(ranges[0]!.to).toBe(block.to - 1)
    expect(ranges[0]!.from).toBe(block.from)
  })

  it('still renders exactly one range after a newline is appended below', () => {
    let state = EditorState.create({ doc: SCRIPTURE, extensions: ext })
    const at = state.doc.length
    state = state.update({ changes: { from: at, insert: '\n' } }).state
    state = state.update({ changes: { from: state.doc.length, insert: '\n' } }).state
    expect(blockRanges(state)).toHaveLength(1)
  })

  it('covers a block with no trailing newline (end of document)', () => {
    const noNL = '```dayspring-scripture ' + ID + '\nDelight in the LORD\nPsalm 37:4\n```'
    const state = EditorState.create({ doc: noNL, extensions: ext })
    const block = state.field(spiritualBlocksField)[0]!
    const ranges = blockRanges(state)
    expect(ranges).toHaveLength(1)
    // No trailing newline to trim — the range runs to the block end.
    expect(ranges[0]!.to).toBe(block.to)
  })
})
