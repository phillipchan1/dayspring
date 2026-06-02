import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { parseSpiritualBlocks } from '@/lib/spiritualBlocks'
import { parseReferences } from '@/lib/scripture/parse'

const refMark = Decoration.mark({ class: 'cm-scriptureRef' })

/**
 * Quiet underline on recognized scripture references as you type. Passive
 * (non-interactive) so it never disrupts typing or focus mode. Scans only the
 * visible lines and rebuilds on doc/viewport changes — the same shape as the
 * other lightweight editor decorations.
 */
export function scriptureRefDecoration() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = build(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
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
  const blocks = parseSpiritualBlocks(doc.toString())
  const insideBlock = (pos: number) => blocks.some((b) => pos >= b.from && pos < b.to)

  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      if (line.text && !insideBlock(line.from)) {
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
