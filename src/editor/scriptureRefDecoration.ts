import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { caretLineChanged, caretLineRange } from './caretLine'
import { spiritualBlocksField, posInsideBlock } from './spiritualBlocksField'
import { parseReferences } from '@/lib/scripture/parse'

const refMark = Decoration.mark({ class: 'cm-scriptureRef' })

/**
 * Quiet underline on recognized scripture references as you type. Passive
 * (non-interactive) so it never disrupts typing or focus mode. The caret's
 * line is left unmarked so WebKit can still autocorrect; the underline
 * returns when the caret leaves. Scans only the visible lines.
 */
export function scriptureRefDecoration() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = build(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || caretLineChanged(update)) {
          this.decorations = build(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const doc = view.state.doc

  // Spiritual blocks are rendered as atomic block-replace widgets. A mark
  // decoration landing ANYWHERE inside one (e.g. the reference line of an
  // inserted scripture block, which parses as a ref) crashes CM's measure pass.
  // Skip every line that falls within a block, not just the opening fence line.
  const blocks = view.state.field(spiritualBlocksField)
  const insideBlock = (pos: number) => posInsideBlock(blocks, pos)
  // Mark decorations on the caret line split the word and kill WebKit
  // autocorrect. The underline returns the moment the caret leaves.
  const caret = caretLineRange(view.state)

  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      if (line.from < caret.to && line.to > caret.from) {
        pos = line.to + 1
        continue
      }
      // A scripture reference always carries a chapter/verse number, so a line
      // with no digit can't contain one — skip the heavy canon regex on prose.
      if (line.text && /\d/.test(line.text) && !insideBlock(line.from)) {
        let lastEnd = -1
        for (const ref of parseReferences(line.text)) {
          const start = line.from + ref.char_start
          const end = line.from + ref.char_end
          // Verse lists ("John 15:5,11") emit several refs over one span — mark
          // the span once, in order, so the RangeSetBuilder stays sorted.
          if (end > start && start >= lastEnd) {
            builder.add(start, end, refMark)
            lastEnd = end
          }
        }
      }
      pos = line.to + 1
    }
  }
  return builder.finish()
}
