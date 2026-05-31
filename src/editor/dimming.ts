import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder, type Extension } from '@codemirror/state'

/**
 * Paragraph dimming: fade every line except the paragraph the cursor is in, so
 * only what you're actively writing sits at full contrast. A "paragraph" is the
 * run of consecutive non-blank lines around the cursor (a blank line breaks it).
 */
const dimLine = Decoration.line({ class: 'cm-dim' })

function activeParagraph(view: EditorView): { start: number; end: number } {
  const { doc } = view.state
  const head = view.state.selection.main.head
  const cur = doc.lineAt(head).number

  let start = cur
  let end = cur
  // Empty current line → only it is "active".
  if (doc.line(cur).text.trim() !== '') {
    while (start > 1 && doc.line(start - 1).text.trim() !== '') start--
    while (end < doc.lines && doc.line(end + 1).text.trim() !== '') end++
  }
  return { start, end }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const { start, end } = activeParagraph(view)
  const { doc } = view.state

  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      if (line.number < start || line.number > end) {
        builder.add(line.from, line.from, dimLine)
      }
      pos = line.to + 1
    }
  }
  return builder.finish()
}

const dimTheme = EditorView.theme({
  '.cm-line': { transition: 'opacity 160ms ease' },
  '.cm-dim': { opacity: '0.28' },
})

const dimPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
)

export const dimmingExtension: Extension = [dimTheme, dimPlugin]
