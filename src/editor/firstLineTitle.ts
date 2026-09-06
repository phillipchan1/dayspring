import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder, type Extension } from '@codemirror/state'
import { isExplicitHeading, isNonTitleLine } from '@/lib/entryMarkdown'

function buildDecorations(view: EditorView): DecorationSet {
  const { doc } = view.state
  // The title is strictly line 1. If the writer pressed Enter to push their
  // first words down (a blank first line), or led with a spiritual block, they
  // opted out of a title — nothing below line 1 is ever auto-promoted. This
  // keeps the title a convenience, not something forced onto the first text
  // wherever it happens to land.
  const titleAt = 1
  const text = doc.line(titleAt).text
  if (!text.trim()) return Decoration.none

  // A blank, list, quote, task, or spiritual-fence first line is content (or
  // nothing), not a title — leave it to the normal markdown highlighting so the
  // editor matches the rendered view.
  if (isNonTitleLine(text)) return Decoration.none
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
  // The implicit title takes the voice's display face and scale, exactly as an
  // explicit `# heading` does in highlight.ts — the two must not diverge, or
  // turning firstLineTitle off would change how the first line is set.
  '.cm-entry-title': {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--h1-size)',
    fontWeight: 'var(--h1-weight)',
    letterSpacing: 'var(--h1-track)',
    color: 'var(--md-heading)',
    lineHeight: 'var(--h1-lh)',
  },
  '.cm-entry-title-explicit': {
    lineHeight: 'var(--h1-lh)',
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
