import { describe, expect, it } from 'vitest'
import { EditorState, RangeSet } from '@codemirror/state'
import { EditorView, type DecorationSet } from '@codemirror/view'
import { spiritualBlocksField } from './spiritualBlocksField'
import { marksField, setMarks } from './markDecoration'
import type { Mark } from '@/lib/marks'

const ID = '11111111-1111-1111-1111-111111111111'
const PRAY = '```dayspring-pray ' + ID + '\nlet my thoughts be of Jesus\n```'

const mark = (quote: string, charStart: number | null = null): Mark => ({
  id: `m-${quote.slice(0, 8)}`,
  entryId: 'e1',
  quote,
  charStart,
  noticedAt: '2026-01-09T00:00:00Z',
})

function ranges(doc: string, marks: Mark[]): { from: number; to: number }[] {
  const state = EditorState.create({ doc, extensions: [spiritualBlocksField, marksField] })
  const tr = state.update({ effects: setMarks.of(marks) })
  const out: { from: number; to: number }[] = []
  for (const input of tr.state.facet(EditorView.decorations)) {
    const set = input as DecorationSet
    if (!(set instanceof RangeSet)) continue
    const iter = set.iter()
    while (iter.value) {
      out.push({ from: iter.from, to: iter.to })
      iter.next()
    }
  }
  return out
}

describe('marksField', () => {
  const doc = 'Third month of this.\n\nI have been measuring the wrong thing.\n\nPrayed again.'
  const quote = 'I have been measuring the wrong thing.'

  it('decorates the marked passage where it sits', () => {
    const at = doc.indexOf(quote)
    expect(ranges(doc, [mark(quote, at)])).toEqual([{ from: at, to: at + quote.length }])
  })

  it('re-anchors when an edit above the passage moved it', () => {
    const edited = `A new opening line.\n\n${doc}`
    const [r] = ranges(edited, [mark(quote, doc.indexOf(quote))])
    expect(r!.from).toBe(edited.indexOf(quote))
  })

  it('emits nothing for an orphaned mark whose text was deleted', () => {
    expect(ranges('Something else entirely now.', [mark(quote, 12)])).toEqual([])
  })

  // A mark decoration landing inside a block:true replace widget crashes
  // CodeMirror's measure pass. Same guard as scriptureRefDecoration.
  it('refuses to decorate inside a spiritual block', () => {
    const withBlock = `Before the block.\n\n${PRAY}\n\nAfter.`
    expect(ranges(withBlock, [mark('let my thoughts be of Jesus')])).toEqual([])
  })

  it('still decorates a passage outside a block in the same document', () => {
    const withBlock = `${PRAY}\n\nI have been measuring the wrong thing.`
    const [r] = ranges(withBlock, [mark(quote)])
    expect(r!.from).toBe(withBlock.indexOf(quote))
  })

  it('drops an overlapping mark rather than emitting an unsorted set', () => {
    // RangeSet throws on overlapping mark ranges; one passage containing
    // another must collapse to the outer one.
    const out = ranges(doc, [mark(quote), mark('measuring the wrong thing.')])
    expect(out).toHaveLength(1)
    expect(out[0]!.to - out[0]!.from).toBe(quote.length)
  })

  it('clamps a quote that would run past the end of the document', () => {
    const short = 'I have been measuring'
    const out = ranges(short, [mark('I have been measuring the wrong thing.', 0)])
    expect(out.every((r) => r.to <= short.length)).toBe(true)
  })

  it('carries ranges through an edit without a new effect', () => {
    const at = doc.indexOf(quote)
    const state = EditorState.create({ doc, extensions: [spiritualBlocksField, marksField] })
    const seeded = state.update({ effects: setMarks.of([mark(quote, at)]) }).state
    const typed = seeded.update({ changes: { from: 0, insert: 'New. ' } }).state
    const set = typed.field(marksField)
    const iter = set.iter()
    expect(iter.from).toBe(at + 5)
  })
})
