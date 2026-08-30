import { RangeSetBuilder, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'

/**
 * Hint text on an empty line, painted with a line decoration + CSS ::before.
 *
 * CodeMirror's stock placeholder (and our old body-line hint) insert a widget
 * span next to the caret. Safari / WKWebView then treat the line as
 * programmatic and drop as-you-type autocorrect — the whole reason a brand-new
 * entry felt broken after the mark-decoration fix. Line decorations do not
 * split the text node.
 */
export const EMPTY_PLACEHOLDER_CLASS = 'cm-empty-placeholder'
export const PRACTICE_PLACEHOLDER_CLASS = 'cm-practice-placeholder'

export function placeholderLineDeco(text: string, className = EMPTY_PLACEHOLDER_CLASS) {
  return Decoration.line({
    class: className,
    attributes: { 'data-placeholder': text },
  })
}

function emptyDocDecorations(docLength: number, deco: Decoration): DecorationSet {
  return docLength ? Decoration.none : Decoration.set([deco.range(0)])
}

/** Empty document — replaces `@codemirror/view`'s widget placeholder. */
export function emptyDocPlaceholder(text: string): Extension {
  const deco = placeholderLineDeco(text)
  return [
    EditorView.contentAttributes.of({ 'aria-placeholder': text }),
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet
        constructor(view: EditorView) {
          this.decorations = emptyDocDecorations(view.state.doc.length, deco)
        }
        update(update: ViewUpdate) {
          if (update.docChanged) {
            this.decorations = emptyDocDecorations(update.state.doc.length, deco)
          }
        }
      },
      { decorations: (v) => v.decorations },
    ),
  ]
}

function bodyLineDecorations(view: EditorView, text: string): DecorationSet {
  const { doc } = view.state
  // Only when the doc is exactly: title line + one empty body line
  if (doc.lines !== 2) return Decoration.none
  const line1 = doc.line(1)
  if (!line1.text.trim()) return Decoration.none
  const line2 = doc.line(2)
  if (line2.text !== '') return Decoration.none
  const builder = new RangeSetBuilder<Decoration>()
  builder.add(line2.from, line2.from, placeholderLineDeco(text))
  return builder.finish()
}

/** Placeholder on the first body line when a title exists but no body yet. */
export function bodyLinePlaceholder(text: string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = bodyLineDecorations(view, text)
      }
      update(update: ViewUpdate) {
        if (update.docChanged) this.decorations = bodyLineDecorations(update.view, text)
      }
    },
    { decorations: (v) => v.decorations },
  )
}
