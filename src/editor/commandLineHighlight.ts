import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { isSpiritualFenceLine } from '@/lib/spiritualBlocks'

const commandLineMark = Decoration.line({ class: 'cm-commandLine' })

/** Soft accent band on the slash-command line while a command popover is open. */
export function commandLineHighlight(pos: number | null) {
  if (pos === null) return []
  const anchorPos = pos

  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = build(view, anchorPos)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = build(update.view, anchorPos)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}

function build(view: EditorView, pos: number): DecorationSet {
  const doc = view.state.doc
  if (pos < 0 || pos > doc.length) return Decoration.none

  const line = doc.lineAt(pos)
  // A line decoration inside an atomic block-replace widget crashes CM's
  // measure pass — never band a spiritual fence line.
  if (isSpiritualFenceLine(line.text)) return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()
  builder.add(line.from, line.from, commandLineMark)
  return builder.finish()
}
