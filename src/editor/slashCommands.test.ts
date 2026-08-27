// @vitest-environment jsdom
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { describe, expect, it } from 'vitest'
import {
  applyFormatCommand,
  filterSlashItems,
  firstCursor,
  itemAt,
  moveCursor,
  slashColumns,
  type SlashItem,
} from './slashCommands'
import { MARK_KINDS } from '@/lib/markKinds'

function applyNumbered(doc: string, at?: number): string {
  const state = EditorState.create({
    doc,
    selection: { anchor: at ?? doc.length },
  })
  const view = new EditorView({ state, parent: document.body })
  applyFormatCommand(view, 'numbered')
  const next = view.state.doc.toString()
  view.destroy()
  return next
}

describe('slashColumns', () => {
  it('leads with the Format column so the default cursor lands there', () => {
    const cols = slashColumns('')
    expect(cols[0]?.every((i) => i.column === 'format')).toBe(true)
    expect(cols[1]?.every((i) => i.column === 'capture')).toBe(true)
    expect(firstCursor(cols)).toEqual({ col: 0, row: 0 })
    expect(itemAt(cols, firstCursor(cols))?.column).toBe('format')
  })
})

describe('filterSlashItems', () => {
  // Counted against the kind table rather than a literal: a kind the parser
  // recognises but the palette hides is a kind nobody can make.
  it('offers every declared kind, and the captures that are not kinds', () => {
    const { capture, format } = filterSlashItems('')
    const ids = capture.map((i) => i.selection.id)
    for (const kind of MARK_KINDS) expect(ids).toContain(kind.command)
    expect(ids).toEqual(expect.arrayContaining(['ritual', 'image', 'emoji']))
    expect(format.length).toBeGreaterThan(0)
    expect(capture.every((i) => i.column === 'capture')).toBe(true)
    expect(format.every((i) => i.column === 'format')).toBe(true)
  })

  it('matches spiritual commands by keyword prefix', () => {
    const { capture } = filterSlashItems('scr')
    expect(capture.map((i) => i.selection.id)).toEqual(['scripture'])
  })

  it('matches format commands by keyword prefix', () => {
    const { format } = filterSlashItems('quo')
    expect(format.map((i) => i.selection.id)).toEqual(['quote'])
  })

  it('narrows both columns together', () => {
    const { capture, format } = filterSlashItems('head')
    expect(capture).toEqual([])
    // All three heading levels carry "head" via keyword or label.
    expect(format.map((i) => i.selection.id)).toEqual(['h1', 'h2', 'h3'])
  })
})

describe('cursor navigation', () => {
  const a: SlashItem[] = filterSlashItems('').capture
  const b: SlashItem[] = filterSlashItems('').format
  const cols = [a, b]

  it('starts on the first non-empty column', () => {
    expect(firstCursor(cols)).toEqual({ col: 0, row: 0 })
    expect(firstCursor([[], b])).toEqual({ col: 1, row: 0 })
    expect(firstCursor([[], []])).toBeNull()
  })

  it('wraps within a column on up/down', () => {
    expect(moveCursor(cols, { col: 0, row: 0 }, 'down')).toEqual({ col: 0, row: 1 })
    expect(moveCursor(cols, { col: 0, row: a.length - 1 }, 'down')).toEqual({ col: 0, row: 0 })
    expect(moveCursor(cols, { col: 0, row: 0 }, 'up')).toEqual({ col: 0, row: a.length - 1 })
  })

  it('hops between columns on left/right and clamps the row', () => {
    expect(moveCursor(cols, { col: 0, row: 1 }, 'right')).toEqual({ col: 1, row: 1 })
    expect(moveCursor(cols, { col: 1, row: 0 }, 'left')).toEqual({ col: 0, row: 0 })
    // Row beyond the target column's length clamps to its last row.
    expect(moveCursor(cols, { col: 1, row: b.length - 1 }, 'left')).toEqual({
      col: 0,
      row: a.length - 1,
    })
  })

  it('does not move off the edge or into an empty column', () => {
    expect(moveCursor(cols, { col: 0, row: 0 }, 'left')).toEqual({ col: 0, row: 0 })
    expect(moveCursor(cols, { col: 1, row: 0 }, 'right')).toEqual({ col: 1, row: 0 })
    expect(moveCursor([a, []], { col: 0, row: 0 }, 'right')).toEqual({ col: 0, row: 0 })
  })

  it('resolves the item under the cursor', () => {
    expect(itemAt(cols, { col: 0, row: 0 })?.selection.id).toBe('scripture')
    expect(itemAt(cols, null)).toBeNull()
  })
})

describe('Numbered list command continues the sequence', () => {
  it('inserts 2. after an existing 1. at the same indent', () => {
    expect(applyNumbered('1. first\n')).toBe('1. first\n2. ')
  })

  it('continues past interrupting bullets (the sermon-notes shape)', () => {
    const doc = ['1. favor', '- nested', '- also nested', ''].join('\n')
    expect(applyNumbered(doc)).toBe(['1. favor', '- nested', '- also nested', '2. '].join('\n'))
  })

  it('starts a nested list at 1. when indented under an ordered item', () => {
    const doc = ['1. first', '   '].join('\n')
    expect(applyNumbered(doc)).toBe(['1. first', '   1. '].join('\n'))
  })

  it('starts at 1. when nothing precedes the line', () => {
    expect(applyNumbered('hello', 0)).toBe('1. hello')
  })
})
