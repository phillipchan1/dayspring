import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, type Extension } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'

/**
 * Live nested-numbering for ordered lists. The raw markdown always uses plain
 * digits (`1.`, `2.`, ...) — CodeMirror's list continuation doesn't know
 * about nesting depth, so a Tab-indented sub-item keeps whatever digit it was
 * typed with. This decorates each `ListMark` with the label it *should* have
 * given its depth and position (1, 2, 3 at the top level; a, b, c one level
 * in; i, ii, iii two levels in — matching the `ol ol` / `ol ol ol` CSS used
 * for rendered/printed entries), without touching the underlying text.
 *
 * A marker is left as raw digits while the selection overlaps it, so hand-
 * editing the number still works normally.
 */

function toAlpha(n: number): string {
  let s = ''
  let rest = n
  while (rest > 0) {
    rest -= 1
    s = String.fromCharCode(97 + (rest % 26)) + s
    rest = Math.floor(rest / 26)
  }
  return s
}

const ROMAN_TABLE: [number, string][] = [
  [1000, 'm'],
  [900, 'cm'],
  [500, 'd'],
  [400, 'cd'],
  [100, 'c'],
  [90, 'xc'],
  [50, 'l'],
  [40, 'xl'],
  [10, 'x'],
  [9, 'ix'],
  [5, 'v'],
  [4, 'iv'],
  [1, 'i'],
]

function toRoman(n: number): string {
  let rest = n
  let s = ''
  for (const [value, symbol] of ROMAN_TABLE) {
    while (rest >= value) {
      s += symbol
      rest -= value
    }
  }
  return s
}

function labelFor(depth: number, index: number): string {
  switch ((depth - 1) % 3) {
    case 0:
      return `${index}.`
    case 1:
      return `${toAlpha(index)}.`
    default:
      return `${toRoman(index)}.`
  }
}

class ListLabelWidget extends WidgetType {
  constructor(readonly label: string) {
    super()
  }

  eq(other: ListLabelWidget): boolean {
    return other.label === this.label
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-list-label'
    span.textContent = this.label
    return span
  }
}

function selectionOverlaps(view: EditorView, from: number, to: number): boolean {
  return view.state.selection.ranges.some((r) => r.to >= from && r.from <= to)
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  // One counter per currently-open OrderedList nesting level.
  const counters: number[] = []

  syntaxTree(view.state).iterate({
    enter(node) {
      if (node.name === 'OrderedList') {
        counters.push(0)
      } else if (node.name === 'ListMark') {
        const parent = node.node.parent
        const grandparent = parent?.parent
        if (grandparent?.name === 'OrderedList' && counters.length > 0) {
          const depth = counters.length
          const index = (counters[depth - 1] ?? 0) + 1
          counters[depth - 1] = index
          if (!selectionOverlaps(view, node.from, node.to)) {
            builder.add(node.from, node.to, Decoration.replace({ widget: new ListLabelWidget(labelFor(depth, index)) }))
          }
        }
      }
    },
    leave(node) {
      if (node.name === 'OrderedList') counters.pop()
    },
  })

  return builder.finish()
}

const orderedListNumberingPlugin = ViewPlugin.fromClass(
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
  { decorations: (v) => v.decorations },
)

const orderedListNumberingTheme = EditorView.theme({
  '.cm-list-label': { color: 'var(--md-list)' },
})

export function orderedListNumberingExtension(): Extension {
  return [orderedListNumberingTheme, orderedListNumberingPlugin]
}
