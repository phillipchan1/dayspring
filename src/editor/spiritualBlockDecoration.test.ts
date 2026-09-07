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

  // Borrowed words are still set apart: the one kind that keeps its widget.
  it('keeps scripture a block widget alongside a marked prayer', () => {
    const state = EditorState.create({ doc: PRAYER + '\n' + SCRIPTURE, extensions: ext })
    const widgets = decorations(state).filter((d) => d.widget)
    expect(widgets).toHaveLength(1)
    expect(widgets[0]!.to).toBeGreaterThan(widgets[0]!.from)
  })
})
