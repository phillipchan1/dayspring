import { StateEffect, StateField, type EditorState, type Range } from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { spiritualBlocksField, posInsideBlock } from './spiritualBlocksField'
import { anchorOf, type Mark } from '@/lib/marks'

/**
 * Marked passages, shown as a quiet ground behind the text.
 *
 * A StateField rather than a ViewPlugin: unlike scripture references, marks
 * aren't derivable from the visible text — they arrive from IndexedDB, so the
 * set is pushed in from outside and then mapped through document changes.
 * Between pushes, CodeMirror keeps the ranges correct as the writer types, for
 * free, which is also what keeps this off the input path.
 */
const markDeco = Decoration.mark({ class: 'cm-mark' })

/** Replace the marks shown in this editor. */
export const setMarks = StateEffect.define<Mark[]>()

export const marksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setMarks)) return build(tr.state, e.value)
    }
    // No effect this transaction — carry the existing ranges across the edit.
    return deco.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f),
})

function build(state: EditorState, marks: Mark[]): DecorationSet {
  const body = state.doc.toString()
  const blocks = state.field(spiritualBlocksField)

  const ranges: { from: number; to: number }[] = []
  for (const m of marks) {
    const at = anchorOf(body, m)
    // Orphaned — the sentence was edited away. The mark still lives in Remember;
    // there's just nothing here to draw it on.
    if (at == null) continue
    const to = Math.min(at + m.quote.length, state.doc.length)
    if (to <= at) continue
    // A mark decoration landing anywhere inside a spiritual block (rendered as
    // an atomic block-replace widget) crashes CodeMirror's measure pass. Same
    // guard as scriptureRefDecoration — a bug already paid for once.
    if (posInsideBlock(blocks, at) || posInsideBlock(blocks, to - 1)) continue
    ranges.push({ from: at, to })
  }

  // RangeSet requires sorted, non-overlapping ranges. Two marks can overlap if
  // one passage contains another, so keep the first and drop what it swallows.
  ranges.sort((a, b) => a.from - b.from || b.to - a.to)
  const out: Range<Decoration>[] = []
  let lastTo = -1
  for (const r of ranges) {
    if (r.from < lastTo) continue
    out.push(markDeco.range(r.from, r.to))
    lastTo = r.to
  }
  return Decoration.set(out)
}

/** Push the current marks into a live editor. Safe to call on every change. */
export function applyMarks(view: EditorView, marks: Mark[]): void {
  view.dispatch({ effects: setMarks.of(marks) })
}
