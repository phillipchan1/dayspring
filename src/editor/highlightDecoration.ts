import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { posInsideBlock, spiritualBlocksField } from './spiritualBlocksField'
import { isHighlightColor, type HighlightColor } from '@/lib/highlightColors'

/**
 * Paints the highlighter wash over `==text==` spans.
 *
 * This can't ride the HighlightStyle tag pipeline like every other mark, because
 * the colour is per-instance: it's written in the document, inside the opening
 * marker (`=={rose}`). So the colour is read off that marker's own text and
 * turned into a class. Everything else about the shape follows
 * scriptureRefDecoration.ts.
 *
 * The mark covers the CONTENT only — between the two markers — so a revealed
 * marker keeps the faint colour every other marker has instead of sitting inside
 * the wash.
 */
const marks: Record<HighlightColor, Decoration> = {
  amber: Decoration.mark({ class: 'cm-hl cm-hl--amber' }),
  rose: Decoration.mark({ class: 'cm-hl cm-hl--rose' }),
  sage: Decoration.mark({ class: 'cm-hl cm-hl--sage' }),
  sky: Decoration.mark({ class: 'cm-hl cm-hl--sky' }),
  lilac: Decoration.mark({ class: 'cm-hl cm-hl--lilac' }),
}

const COLOR_RE = /^==\{([a-z]+)\}$/

export function highlightDecoration() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = build(view)
      }

      update(update: ViewUpdate) {
        // No selectionSet: the wash never depends on where the caret is. Only
        // the concealment of its markers does.
        if (
          update.docChanged ||
          update.viewportChanged ||
          syntaxTree(update.state) != syntaxTree(update.startState)
        ) {
          this.decorations = build(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}

/** `amber` for a bare `==`, the named colour for `=={rose}`. */
function colorOfMarker(text: string): HighlightColor {
  const m = COLOR_RE.exec(text)
  if (m && m[1] && isHighlightColor(m[1])) return m[1]
  return 'amber'
}

function build(view: EditorView): DecorationSet {
  // Same guard as scriptureRefDecoration/markDecoration: a mark decoration
  // landing inside a block-replace widget crashes CodeMirror's measure pass.
  const blocks = view.state.field(spiritualBlocksField)
  const tree = syntaxTree(view.state)
  // A span straddling two visible ranges is entered once per range, so collect
  // and de-duplicate before handing anything to the (strictly ordered) builder.
  const found = new Map<string, { from: number; to: number; color: HighlightColor }>()

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== 'Highlight') return
        const open = node.node.firstChild
        const close = node.node.lastChild
        if (!open || !close || open === close) return
        if (open.name !== 'HighlightMark' || close.name !== 'HighlightMark') return
        if (open.to >= close.from) return
        if (posInsideBlock(blocks, open.from)) return
        const color = colorOfMarker(view.state.sliceDoc(open.from, open.to))
        found.set(`${open.to}:${close.from}`, { from: open.to, to: close.from, color })
      },
    })
  }

  const builder = new RangeSetBuilder<Decoration>()
  for (const range of [...found.values()].sort((a, b) => a.from - b.from || a.to - b.to)) {
    builder.add(range.from, range.to, marks[range.color])
  }
  return builder.finish()
}
