import { describe, expect, it } from 'vitest'
import { EditorState, RangeSet } from '@codemirror/state'
import { EditorView, type DecorationSet } from '@codemirror/view'
import { formatSpiritualBlock } from '@/lib/spiritualBlocks'
import { spiritualBlocksField } from './spiritualBlocksField'
import { spiritualBlockExtension } from './spiritualBlockDecoration'
import { markMarginExtension } from './markMargin'

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'

const ext = [spiritualBlocksField, spiritualBlockExtension(() => {}), markMarginExtension(() => {})]

/** Widget decorations that are the margin's glyphs (zero-width, not a block). */
function glyphs(state: EditorState): Array<{ from: number; kind: string }> {
  const out: Array<{ from: number; kind: string }> = []
  for (const input of state.facet(EditorView.decorations)) {
    const set = input as DecorationSet
    if (!(set instanceof RangeSet)) continue
    const iter = set.iter()
    while (iter.value) {
      const spec = iter.value.spec as { widget?: { kind?: string }; block?: boolean }
      if (iter.from === iter.to && spec.widget?.kind) out.push({ from: iter.from, kind: spec.widget.kind })
      iter.next()
    }
  }
  return out
}

describe('the closed margin', () => {
  it('puts a hand beside a prayer, on the prayer’s own line', () => {
    const doc = `Tuesday\n\n${formatSpiritualBlock('prayer', A, 'keep him steady')}\n`
    const state = EditorState.create({ doc, extensions: ext })
    const found = glyphs(state)
    expect(found).toHaveLength(1)
    expect(found[0]!.kind).toBe('prayer')
    // Line 3 is the opening fence; the hand belongs beside line 4, the sentence.
    expect(found[0]!.from).toBe(state.doc.line(4).from)
  })

  it('draws one hand for a multi-line sense, at its first line', () => {
    const doc = formatSpiritualBlock('sense', A, 'something is being asked\nand I am not sure what')
    const state = EditorState.create({ doc, extensions: ext })
    const found = glyphs(state)
    expect(found).toHaveLength(1)
    expect(found[0]!.from).toBe(state.doc.line(2).from)
  })

  // A decoration placed inside a replaced range is swallowed, so scripture —
  // still a block widget — draws its own glyph in `toDOM`. If this ever starts
  // emitting one, the verse would silently lose its hand.
  it('emits no separate glyph for scripture', () => {
    const doc = formatSpiritualBlock('scripture', A, 'Be still', 'Psalm 46:10')
    const state = EditorState.create({ doc, extensions: ext })
    expect(glyphs(state)).toHaveLength(0)
  })

  it('is empty on a page with nothing set apart', () => {
    const state = EditorState.create({ doc: 'Ordinary Wednesday.', extensions: ext })
    expect(glyphs(state)).toHaveLength(0)
  })

  it('keeps one hand per marking as the page fills', () => {
    const doc = [
      'Tuesday',
      '',
      formatSpiritualBlock('prayer', A, 'for Dad'),
      formatSpiritualBlock('sense', B, 'wait'),
    ].join('\n')
    const state = EditorState.create({ doc, extensions: ext })
    expect(glyphs(state).map((g) => g.kind)).toEqual(['prayer', 'sense'])
  })
})
