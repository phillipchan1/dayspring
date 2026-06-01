import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder, type Extension } from '@codemirror/state'
import { isExplicitHeading } from '@/lib/entryMarkdown'
import { isSpiritualFenceLine } from '@/lib/spiritualBlocks'

function firstContentLine(doc: EditorView['state']['doc']): number | null {
  for (let n = 1; n <= doc.lines; n++) {
    const t = doc.line(n).text.trim()
    if (t && !isSpiritualFenceLine(t) && t !== '```') return n
  }
  return null
}

function buildDecorations(view: EditorView): DecorationSet {
  const { doc } = view.state
  const titleAt = firstContentLine(doc)
  if (titleAt === null) return Decoration.none

  const text = doc.line(titleAt).text
  const explicit = isExplicitHeading(text)
  const hasBodyBelow = titleAt < doc.lines
  const classes = [
    explicit ? 'cm-entry-title-explicit' : 'cm-entry-title',
    hasBodyBelow ? 'cm-entry-title--spaced' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const builder = new RangeSetBuilder<Decoration>()
  const line = doc.line(titleAt)
  builder.add(line.from, line.from, Decoration.line({ class: classes }))
  return builder.finish()
}

const titleTheme = EditorView.theme({
  '.cm-entry-title': {
    fontSize: '1.6em',
    fontWeight: '700',
    color: 'var(--md-heading)',
    lineHeight: '1.3',
  },
  '.cm-entry-title-explicit': {
    lineHeight: '1.3',
  },
  '.cm-entry-title--spaced, .cm-entry-title-explicit.cm-entry-title--spaced': {
    paddingBottom: '0.85em',
  },
})

const titlePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

/** Style the first line as an entry title (H1) when it is plain text. */
export const firstLineTitleExtension: Extension = [titleTheme, titlePlugin]
