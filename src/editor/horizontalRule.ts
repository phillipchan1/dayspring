import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { posInsideBlock, spiritualBlocksField } from './spiritualBlocksField'

/**
 * Turns a CommonMark thematic break (`---`, `***`, `___` on its own line)
 * into a decorative section break.
 *
 * The dashes stay in the document — nothing here rewrites an entry. They are
 * replaced with a widget so the page reads as a break, and they come back the
 * moment the caret or a selection touches the line, same reveal rule as
 * concealMarkers.ts. Click the rule, the source is there to delete.
 *
 * The widget's DOM is the same in every palette; themes.css paints the gem.
 * That is the whole point of putting the chrome in CSS rather than in the
 * widget: a theme switch must not rebuild the editor.
 */

class HorizontalRuleWidget extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const el = document.createElement('span')
    el.className = 'cm-hr'
    el.setAttribute('role', 'separator')
    el.setAttribute('aria-orientation', 'horizontal')
    return el
  }

  ignoreEvent(): boolean {
    return false
  }
}

const hrWidget = new HorizontalRuleWidget()
const hrReplace = Decoration.replace({ widget: hrWidget })
const hrLine = Decoration.line({ class: 'cm-hr-line' })

function lineTouched(view: EditorView, from: number, to: number): boolean {
  for (const r of view.state.selection.ranges) {
    if (r.from <= to && r.to >= from) return true
  }
  return false
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const tree = syntaxTree(view.state)
  if (!tree.length) return Decoration.none

  const blocks = view.state.field(spiritualBlocksField)
  const doc = view.state.doc

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== 'HorizontalRule') return
        if (posInsideBlock(blocks, node.from)) return
        const line = doc.lineAt(node.from)
        if (lineTouched(view, line.from, line.to)) return
        builder.add(line.from, line.from, hrLine)
        builder.add(line.from, line.to, hrReplace)
      },
    })
  }
  return builder.finish()
}

const plugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        syntaxTree(update.state) != syntaxTree(update.startState)
      ) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

export function horizontalRuleExtension(): Extension {
  return plugin
}
