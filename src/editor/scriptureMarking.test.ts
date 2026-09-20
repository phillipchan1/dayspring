import { describe, it, expect } from 'vitest'
import { EditorState, RangeSet, Transaction } from '@codemirror/state'
import { EditorView, type DecorationSet } from '@codemirror/view'
import { spiritualBlocksField } from './spiritualBlocksField'
import { spiritualBlockExtension } from './spiritualBlockDecoration'
import { scriptureVerseAt, snapToWords, verseRange } from './scriptureBody'

const ID = '11111111-1111-1111-1111-111111111111'
const VERSE = 'Draw near to God, and he will draw near to you.'
const SCRIPTURE = '```dayspring-scripture ' + ID + '\n' + VERSE + '\nJames 4:8\n```\n'

const ext = [spiritualBlocksField, spiritualBlockExtension(() => {})]

function lineClass(state: EditorState, n: number): string | undefined {
  const at = state.doc.line(n).from
  for (const input of state.facet(EditorView.decorations)) {
    const set = input as DecorationSet
    if (!(set instanceof RangeSet)) continue
    const iter = set.iter()
    while (iter.value) {
      const spec = iter.value.spec as { class?: string }
      if (iter.from === at && iter.to === at && spec.class) return spec.class
      iter.next()
    }
  }
  return undefined
}

/** Ranges the atomicRanges facet claims — scripture must not be among them. */
function atomicRanges(state: EditorState): Array<{ from: number; to: number }> {
  const view = { state } as EditorView
  const out: Array<{ from: number; to: number }> = []
  for (const provider of state.facet(EditorView.atomicRanges)) {
    const set = provider(view)
    const iter = set.iter()
    while (iter.value) {
      out.push({ from: iter.from, to: iter.to })
      iter.next()
    }
  }
  return out
}

/** Apply a change the way a person's keystroke would — with a userEvent. */
function userEdit(
  state: EditorState,
  change: { from: number; to?: number; insert?: string },
  event = 'input.type',
): EditorState {
  return state.update({ changes: change, annotations: Transaction.userEvent.of(event) }).state
}

describe('a scripture quotation draws as lines, not a widget', () => {
  it('collapses the fences and sets the verse and citation apart', () => {
    const state = EditorState.create({ doc: SCRIPTURE, extensions: ext })
    expect(lineClass(state, 1)).toBe('cm-mark-fence')
    expect(lineClass(state, 2)).toContain('cm-scripture-line')
    expect(lineClass(state, 3)).toBe('cm-scripture-cite')
    expect(lineClass(state, 4)).toBe('cm-mark-fence')
    // The document is untouched — the fence is still there to parse, sync and export.
    expect(state.doc.line(1).text).toContain('```dayspring-scripture')
  })

  it('caps a multi-line verse at both ends but never on the citation', () => {
    const doc =
      '```dayspring-scripture ' + ID + '\nDraw near to God,\nand he will draw near to you.\nJames 4:8\n```\n'
    const state = EditorState.create({ doc, extensions: ext })
    expect(lineClass(state, 2)).toContain('cm-scripture-line--first')
    expect(lineClass(state, 2)).not.toContain('cm-scripture-line--last')
    expect(lineClass(state, 3)).toContain('cm-scripture-line--last')
    expect(lineClass(state, 4)).toBe('cm-scripture-cite')
  })

  // A pasted verse with no citation is a real shape: detectScripturePaste
  // declines to wrap when it isn't sure, but /scripture can still land one.
  it('treats a body with no citation as all verse', () => {
    const doc = '```dayspring-scripture ' + ID + '\n' + VERSE + '\n```\n'
    const state = EditorState.create({ doc, extensions: ext })
    expect(lineClass(state, 2)).toContain('cm-scripture-line')
    expect(lineClass(state, 2)).toContain('cm-scripture-line--last')
    const block = state.field(spiritualBlocksField)[0]!
    expect(state.doc.sliceString(verseRange(state.doc, block)!.from, verseRange(state.doc, block)!.to)).toBe(VERSE)
  })

  // An atomic range pushes a selection back out of itself, which would undo the
  // gesture marking is built on. This is the assertion that keeps it gone.
  it('leaves scripture out of the atomic ranges', () => {
    const state = EditorState.create({ doc: SCRIPTURE, extensions: ext })
    expect(atomicRanges(state)).toHaveLength(0)
  })

  it('still treats a prayer as atomic', () => {
    const doc = '```dayspring-pray ' + ID + '\nkeep my father steady\n```\n'
    const state = EditorState.create({ doc, extensions: ext })
    expect(atomicRanges(state)).toHaveLength(1)
  })
})

describe('borrowed words are selectable, and not editable', () => {
  it('refuses a keystroke inside the verse', () => {
    const state = EditorState.create({ doc: SCRIPTURE, extensions: ext })
    const at = state.doc.line(2).from + 5
    expect(userEdit(state, { from: at, insert: 'X' }).doc.toString()).toBe(SCRIPTURE)
  })

  it('refuses a deletion that would rewrite part of a quotation', () => {
    const state = EditorState.create({ doc: SCRIPTURE, extensions: ext })
    const line = state.doc.line(2)
    const next = userEdit(state, { from: line.from, to: line.from + 4 }, 'delete.backward')
    expect(next.doc.toString()).toBe(SCRIPTURE)
  })

  it('refuses an edit to the citation line', () => {
    const state = EditorState.create({ doc: SCRIPTURE, extensions: ext })
    const at = state.doc.line(3).from + 2
    expect(userEdit(state, { from: at, insert: '!' }).doc.toString()).toBe(SCRIPTURE)
  })

  it('allows removing the whole quotation', () => {
    const doc = 'before\n\n' + SCRIPTURE + 'after\n'
    const state = EditorState.create({ doc, extensions: ext })
    const block = state.field(spiritualBlocksField)[0]!
    const next = userEdit(state, { from: block.from, to: block.to }, 'delete.selection')
    expect(next.doc.toString()).toBe('before\n\nafter\n')
  })

  // The selection that makes that deletion usually stops at the closing fence
  // rather than past its newline, so containment is measured against the last
  // visible character. Without that, selecting the block and pressing Delete
  // looked like it did nothing.
  it('allows removing the quotation when the selection stops at the closing fence', () => {
    const doc = 'before\n\n' + SCRIPTURE + 'after\n'
    const state = EditorState.create({ doc, extensions: ext })
    const block = state.field(spiritualBlocksField)[0]!
    const next = userEdit(state, { from: block.from, to: block.to - 1 }, 'delete.selection')
    expect(next.doc.toString()).toBe('before\n\n\nafter\n')
  })

  it('leaves the prose around a quotation editable', () => {
    const doc = 'before\n\n' + SCRIPTURE
    const state = EditorState.create({ doc, extensions: ext })
    expect(userEdit(state, { from: 6, insert: '!' }).doc.toString()).toContain('before!')
  })

  /*
   * The filter must never touch a programmatic dispatch. `applyRemoteDoc` sends
   * a minimal diff with no userEvent, and refusing one would silently drop an
   * edit another device had already saved — a far worse bug than the one the
   * filter prevents.
   */
  it('lets a programmatic change through untouched', () => {
    const state = EditorState.create({ doc: SCRIPTURE, extensions: ext })
    const at = state.doc.line(2).from + 5
    const next = state.update({ changes: { from: at, insert: 'X' } }).state
    expect(next.doc.toString()).not.toBe(SCRIPTURE)
  })
})

describe('a mark may cover the verse and nothing else', () => {
  const state = EditorState.create({ doc: SCRIPTURE, extensions: ext })
  const verse = state.doc.line(2)

  it('recognises a selection inside the verse', () => {
    const hit = scriptureVerseAt(state, verse.from + 2, verse.from + 9)
    expect(hit).not.toBeNull()
    expect(hit!.from).toBe(verse.from)
    expect(hit!.to).toBe(verse.to)
  })

  it('declines the citation line', () => {
    const cite = state.doc.line(3)
    expect(scriptureVerseAt(state, cite.from, cite.to)).toBeNull()
  })

  it('declines a selection that runs out of the block', () => {
    expect(scriptureVerseAt(state, verse.from + 2, state.doc.line(4).to)).toBeNull()
  })

  it('declines prose', () => {
    const prose = EditorState.create({ doc: 'just a sentence\n', extensions: ext })
    expect(scriptureVerseAt(prose, 2, 6)).toBeNull()
  })
})

describe('snapToWords', () => {
  const doc = EditorState.create({ doc: VERSE }).doc
  const limit = { from: 0, to: VERSE.length }

  it('grows a part-word selection out to whole words', () => {
    // "raw near to Go" → "Draw near to God,"
    const hit = snapToWords(doc, 1, 15, limit)
    expect(doc.sliceString(hit.from, hit.to)).toBe('Draw near to God,')
  })

  it('leaves a selection that is already on word boundaries alone', () => {
    const hit = snapToWords(doc, 0, 4, limit)
    expect(doc.sliceString(hit.from, hit.to)).toBe('Draw')
  })

  it('trims whitespace off both ends', () => {
    // 4..10 is " near " — the spaces either side come off, and neither edge
    // cuts a word, so nothing is pulled in.
    const hit = snapToWords(doc, 4, 10, limit)
    expect(doc.sliceString(hit.from, hit.to)).toBe('near')
  })

  // Starting on the space after "Draw" is not a partial "Draw".
  it('does not swallow the previous word from a selection that starts on a space', () => {
    const hit = snapToWords(doc, 4, 9, limit)
    expect(doc.sliceString(hit.from, hit.to)).toBe('near')
  })

  it('never walks past the range it is given', () => {
    const narrow = { from: 5, to: 9 }
    const hit = snapToWords(doc, 6, 7, narrow)
    expect(hit.from).toBeGreaterThanOrEqual(narrow.from)
    expect(hit.to).toBeLessThanOrEqual(narrow.to)
  })
})
