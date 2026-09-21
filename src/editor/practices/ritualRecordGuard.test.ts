import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { judgeRitualEdit } from './ritualRecordGuard'
import { practicePromptExtension } from './usePracticeInsertion'
import { composeRitualMarkdown } from './ritualDocument'
import { PRACTICES } from './practicesData'

const examen = PRACTICES.find((p) => p.name === 'The Daily Examen')!
const LABELS = examen.prompts.map((p) => p.label)

describe('judgeRitualEdit', () => {
  const block = [{ from: 10, to: 50 }]

  it('refuses anything that reaches inside the record', () => {
    expect(judgeRitualEdit(block, 20, 20, 'x', false).kind).toBe('refuse')
    expect(judgeRitualEdit(block, 20, 25, '', false).kind).toBe('refuse')
    expect(judgeRitualEdit(block, 5, 20, '', false).kind).toBe('refuse')
  })

  it('allows taking the whole record only when it was selected', () => {
    expect(judgeRitualEdit(block, 0, 60, '', true).kind).toBe('allow')
    expect(judgeRitualEdit(block, 10, 50, 'new', true).kind).toBe('allow')
    // A lone Backspace beside the block, widened to it by atomic ranges.
    expect(judgeRitualEdit(block, 10, 50, '', false).kind).toBe('refuse')
  })

  it('puts typing at either edge onto its own line', () => {
    expect(judgeRitualEdit(block, 50, 50, 'a', false)).toEqual({ kind: 'reshape', insert: '\n\na' })
    expect(judgeRitualEdit(block, 10, 10, 'a', false)).toEqual({ kind: 'reshape', insert: 'a\n' })
    // Enter below the record opens a line that is already outside it.
    expect(judgeRitualEdit(block, 50, 50, '\n', false)).toEqual({ kind: 'reshape', insert: '\n\n' })
  })

  it('refuses deleting the newline that keeps a neighbour off the record', () => {
    expect(judgeRitualEdit(block, 9, 10, '', false).kind).toBe('refuse')
    expect(judgeRitualEdit(block, 50, 51, '', false).kind).toBe('refuse')
  })

  it('leaves the rest of the entry alone', () => {
    expect(judgeRitualEdit(block, 0, 3, 'hello', false).kind).toBe('allow')
    expect(judgeRitualEdit(block, 55, 55, 'x', false).kind).toBe('allow')
  })
})

describe('the ritual record in the entry', () => {
  const ritual = composeRitualMarkdown(examen.name, LABELS, ['Bread.', 'Distant.', '', ''])
  const doc = `Morning.\n\n${ritual}`
  const start = doc.indexOf('Bread.')
  const make = () =>
    EditorState.create({
      doc,
      extensions: practicePromptExtension(
        () => {},
        () => {},
      ),
    })

  it('refuses the writer typing into an answer', () => {
    const state = make()
    const next = state.update({ changes: { from: start, insert: 'x' }, userEvent: 'input.type' })
    expect(next.state.doc.toString()).toBe(doc)
  })

  it('still lets the composer write the block back', () => {
    const state = make()
    const next = state.update({ changes: { from: start, to: start + 6, insert: 'Rain.' } })
    expect(next.state.doc.toString()).toContain('Rain.')
  })

  it('moves typing after the record onto a new line', () => {
    const state = make()
    const end = doc.length
    const next = state.update({
      changes: { from: end, insert: 'x' },
      selection: { anchor: end + 1 },
      userEvent: 'input.type',
    })
    expect(next.state.doc.toString()).toBe(`${doc}\n\nx`)
    expect(next.state.selection.main.head).toBe(end + 3)
    // …and what was typed there is prose, not more of the last answer, so it
    // can be written on and deleted like the rest of the entry.
    const back = next.state.update({
      changes: { from: end + 2, to: end + 3, insert: '' },
      userEvent: 'delete.backward',
    })
    expect(back.state.doc.toString()).toBe(`${doc}\n\n`)
  })

  it('does not let one Backspace beside the record delete it', () => {
    const state = EditorState.create({
      doc,
      selection: { anchor: doc.length },
      extensions: practicePromptExtension(
        () => {},
        () => {},
      ),
    })
    const from = doc.indexOf('<!-- ritual:')
    const next = state.update({
      changes: { from, to: doc.length, insert: '' },
      userEvent: 'delete.backward',
    })
    expect(next.state.doc.toString()).toBe(doc)
  })

  it('lets the rest of the entry be written as usual', () => {
    const state = make()
    const next = state.update({ changes: { from: 0, insert: 'Early. ' }, userEvent: 'input.type' })
    expect(next.state.doc.toString()).toBe(`Early. ${doc}`)
  })
})
