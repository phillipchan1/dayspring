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

const datelineTheme = EditorView.theme({
  // Padding, never margin: CodeMirror measures a block widget from its
  // bounding rect, which excludes margins, and an uncounted margin drifts every
  // coordinate below it.
  '.cm-dateline': {
    paddingBottom: '1.35em',
    fontFamily: 'var(--font-label)',
    // Small caps are x-height tall, so a small-caps voice sets it larger
    // (--dateline-size, themes.css). Never under 11px: in Plainsong (0.72)
    // and on a phone (0.82) half the body size is too small to read.
    fontSize: 'max(var(--dateline-size, 0.5em), 11px)',
    lineHeight: '1.4',
    letterSpacing: 'var(--label-track)',
    textTransform: 'var(--label-case)' as 'uppercase',
    fontVariantCaps: 'var(--label-caps)' as 'normal',
    fontVariantNumeric: 'lining-nums',
    fontWeight: '500',
    // --text-dim alone is 3.8:1 on Dawn's paper; small text wants more.
    color: 'color-mix(in srgb, var(--text-dim) 70%, var(--text))',
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
