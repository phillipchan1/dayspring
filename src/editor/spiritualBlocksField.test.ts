import { describe, it, expect } from 'vitest'
import { EditorState, StateField } from '@codemirror/state'
import { spiritualBlocksField, posInsideBlock } from './spiritualBlocksField'

const PRAYER = '```dayspring-pray 11111111-1111-1111-1111-111111111111\nLord, help me\n```'

describe('spiritualBlocksField', () => {
  it('parses blocks on create', () => {
    const state = EditorState.create({ doc: PRAYER, extensions: [spiritualBlocksField] })
    const blocks = state.field(spiritualBlocksField)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.type).toBe('prayer')
  })

  it('reparses only on doc change and is stable otherwise', () => {
    const state = EditorState.create({ doc: PRAYER, extensions: [spiritualBlocksField] })
    const before = state.field(spiritualBlocksField)

    // Selection-only transaction: same array identity (no reparse).
    const selOnly = state.update({ selection: { anchor: 0 } })
    expect(selOnly.state.field(spiritualBlocksField)).toBe(before)

    // Doc change: fresh parse.
    const edited = state.update({ changes: { from: state.doc.length, insert: '\n\nmore' } })
    expect(edited.state.field(spiritualBlocksField)).toHaveLength(1)
  })

  it('is readable by a later field added after it (ordering contract)', () => {
    // Mirrors Editor.tsx: spiritualBlocksField precedes a field that reads it.
    const consumer = StateField.define<number>({
      create: (s) => s.field(spiritualBlocksField).length,
      update: (_v, tr) => tr.state.field(spiritualBlocksField).length,
    })
    const state = EditorState.create({ doc: PRAYER, extensions: [spiritualBlocksField, consumer] })
    expect(state.field(consumer)).toBe(1)
  })

  it('posInsideBlock detects positions within a block', () => {
    const state = EditorState.create({ doc: PRAYER, extensions: [spiritualBlocksField] })
    const blocks = state.field(spiritualBlocksField)
    expect(posInsideBlock(blocks, 5)).toBe(true)
    expect(posInsideBlock(blocks, state.doc.length)).toBe(false)
  })
})
