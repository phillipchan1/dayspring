import { syntaxTree } from '@codemirror/language'
import { highlightTree } from '@lezer/highlight'
import { RangeSetBuilder } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  Prec,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { caretLineChanged, overlapsCaretLine } from './caretLine'
import { markdownHighlight } from './highlight'

/**
 * Markdown syntax highlighting that leaves the caret's line alone.
 *
 * The stock `syntaxHighlighting()` wraps every token in a mark decoration.
 * On Safari / WKWebView (macOS desktop and iOS) that rewrite is enough for
 * the OS to stop tracking the word, so "teh" never becomes "the". Line
 * decorations — the title face, dimming — stay; they do not split text
 * nodes. The moment the caret leaves the line, the marks come back.
 */

const markCache: Record<string, Decoration> = Object.create(null)

function buildDeco(view: EditorView): DecorationSet {
  const tree = syntaxTree(view.state)
  if (!tree.length) return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()
  const { state } = view
  for (const { from, to } of view.visibleRanges) {
    highlightTree(
      tree,
      markdownHighlight,
      (start, end, style) => {
        if (overlapsCaretLine(state, start, end)) return
        const mark = markCache[style] ?? (markCache[style] = Decoration.mark({ class: style }))
        builder.add(start, end, mark)
      },
      from,
      to,
    )
  }
  return builder.finish()
}

const highlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDeco(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        caretLineChanged(update) ||
        syntaxTree(update.state) != syntaxTree(update.startState)
      ) {
        this.decorations = buildDeco(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

export function proseHighlighting() {
  const ext = [Prec.high(highlighter)]
  if (markdownHighlight.module) ext.unshift(EditorView.styleModule.of(markdownHighlight.module))
  return ext
}
