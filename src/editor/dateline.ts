import { StateField, type Extension } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'

/**
 * The dateline: the entry's date in the voice's label face, set above the
 * title like a magazine's masthead.
 *
 * Not document text — an entry's markdown never learns its own date — so it is
 * a block widget before the first line. A block widget has to come from a
 * StateField (CodeMirror refuses block decorations from a view plugin); the
 * text is fixed per mount and Editor.tsx swaps the whole extension through a
 * compartment when the entry or the setting changes.
 *
 * Each voice dresses it in its own ornament (themes.css, "The dateline"):
 * Dawn's short sunrise rule, Vellum's rubric, Plainsong's brackets — and
 * Sabbath and Vigil leave it bare, the way they leave everything bare.
 *
 * A press on it lands the caret at the start of the title rather than doing
 * nothing: the line reads as part of the page, so it should answer like it.
 */
class DatelineWidget extends WidgetType {
  constructor(readonly text: string) {
    super()
  }

  eq(other: DatelineWidget): boolean {
    return other.text === this.text
  }

  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-dateline'
    const label = document.createElement('span')
    label.className = 'cm-dateline__text'
    label.textContent = this.text
    el.appendChild(label)
    return el
  }

  ignoreEvent(): boolean {
    return false
  }
}

// The dateline's type lives in global.css ("The dateline"), shared with the
// Pages reader's, so an entry's head is set identically written and read.
// Only what is particular to the editor stays here.
const datelineTheme = EditorView.theme({
  '.cm-dateline': {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    cursor: 'text',
  },
})

/** The dateline extension for one entry. `text` is already formatted. */
export function datelineExtension(text: string): Extension {
  const deco = Decoration.set([
    Decoration.widget({ widget: new DatelineWidget(text), block: true, side: -1 }).range(0),
  ])
  const field = StateField.define<DecorationSet>({
    create: () => deco,
    // Position 0 is position 0 whatever changes; nothing to map.
    update: (value) => value,
    provide: (f) => EditorView.decorations.from(f),
  })
  return [datelineTheme, field]
}
