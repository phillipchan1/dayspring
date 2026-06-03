import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'

class BodyPlaceholderWidget extends WidgetType {
  constructor(readonly text: string) {
    super()
  }
  eq(other: BodyPlaceholderWidget) {
    return other.text === this.text
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-placeholder'
    span.setAttribute('aria-hidden', 'true')
    span.textContent = this.text
    return span
  }
  ignoreEvent() {
    return false
  }
}

function buildDecorations(view: EditorView, text: string): DecorationSet {
  const { doc } = view.state
  // Only when the doc is exactly: title line + one empty body line
  if (doc.lines !== 2) return Decoration.none
  const line1 = doc.line(1)
  if (!line1.text.trim()) return Decoration.none
  const line2 = doc.line(2)
  if (line2.text !== '') return Decoration.none
  const builder = new RangeSetBuilder<Decoration>()
  builder.add(
    line2.from,
    line2.from,
    Decoration.widget({ widget: new BodyPlaceholderWidget(text), side: 1 }),
  )
  return builder.finish()
}

/** Shows a placeholder on the first body line when there's a title but no body content yet. */
export function bodyLinePlaceholder(text: string) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, text)
      }
      update(update: ViewUpdate) {
        if (update.docChanged) this.decorations = buildDecorations(update.view, text)
      }
    },
    { decorations: (v) => v.decorations },
  )
}
