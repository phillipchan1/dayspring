import { syntaxTree } from '@codemirror/language'
import { highlightTree } from '@lezer/highlight'
import { Prec, RangeSetBuilder, type EditorState } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import {
  caretWordChanged,
  caretWordRange,
  overlapsCaretLine,
  overlapsCaretWord,
} from './caretLine'
import { markdownHighlight } from './highlight'

type SyntaxTree = ReturnType<typeof syntaxTree>

/**
 * Markdown syntax highlighting that leaves the word being typed alone.
 *
 * The stock `syntaxHighlighting()` wraps every token in a mark decoration.
 * On Safari / WKWebView (macOS desktop and iOS) that rewrite is enough for
 * the OS to stop tracking the word, so "teh" never becomes "the". Finished
 * inline marks on the same line still paint — `**bold**` turns bold as
 * soon as the closing mark is typed, without waiting for a newline. Block
 * markup (headings, quotes) still waits until the caret leaves the line, so a
 * title doesn't jump size mid-sentence. Line decorations (title face,
 * dimming) are unaffected: they don't split text nodes.
 */

const markCache: Record<string, Decoration> = Object.create(null)

/** Inline spans whose styling can settle before the caret leaves the line. */
const INLINE_SPAN = new Set([
  'Emphasis',
  'StrongEmphasis',
  'Strikethrough',
  'InlineCode',
  'Highlight',
  'Underline',
  'Link',
  'Image',
])

function insideInlineSpan(tree: SyntaxTree, pos: number): boolean {
  let n: ReturnType<SyntaxTree['resolveInner']> | null = tree.resolveInner(pos, 1)
  while (n) {
    if (INLINE_SPAN.has(n.name)) return true
    n = n.parent
  }
  return false
}

function closedInlineAtCaret(state: EditorState, tree: SyntaxTree): boolean {
  const word = caretWordRange(state)
  if (word.from === word.to) return false
  if (state.selection.main.head !== word.to) return false
  let n: ReturnType<SyntaxTree['resolveInner']> | null = tree.resolveInner(word.from, 1)
  while (n) {
    if (INLINE_SPAN.has(n.name) && n.from === word.from && n.to === word.to) return true
    n = n.parent
  }
  return false
}

function skipMark(
  state: EditorState,
  tree: SyntaxTree,
  start: number,
  end: number,
  allowClosedInline: boolean,
): boolean {
  if (overlapsCaretWord(state, start, end) && !allowClosedInline) return true
  if (!overlapsCaretLine(state, start, end)) return false
  return !insideInlineSpan(tree, start)
}

function buildDeco(view: EditorView): DecorationSet {
  const tree = syntaxTree(view.state)
  if (!tree.length) return Decoration.none

  const builder = new RangeSetBuilder<Decoration>()
  const { state } = view
  const allowClosedInline = closedInlineAtCaret(state, tree)
  for (const { from, to } of view.visibleRanges) {
    highlightTree(
      tree,
      markdownHighlight,
      (start, end, style) => {
        if (skipMark(state, tree, start, end, allowClosedInline)) return
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
        caretWordChanged(update) ||
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
