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
 * soon as the closing mark is typed, without waiting for a newline.
 *
 * Block markup (headings, quotes) is NOT a mark at all: it's a line
 * decoration (`blockLineStyles` below). Line decorations only set a class on
 * the `.cm-line`, so they never split a text node, so autocorrect survives —
 * which is what lets `## ` become a heading the moment the space lands. They
 * used to be marks, and waited for Enter.
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
  const head = state.selection.main.head
  if (head !== word.to) return false
  // Any span whose closing delimiter was just typed — not only one that is a
  // single word. `**two words**` closes on the word `words**`, and requiring
  // the span to start at that word left "two" bold and "words" plain.
  let n: ReturnType<SyntaxTree['resolveInner']> | null = tree.resolveInner(head, -1)
  while (n) {
    if (INLINE_SPAN.has(n.name) && n.to === head) return true
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

/**
 * `cm-md-h1`…`cm-md-h6` and `cm-md-quote` on every line of a heading or quote,
 * the caret line included.
 *
 * The one hold-back: a bare `#`…`######` with no space yet, on the line being
 * typed. CommonMark already calls that an (empty) heading, but painting it would
 * swell the line for the single keystroke before `#grateful` turns out to be a
 * hashtag. The space is the trigger, as in every writing app.
 */
const HEADING_LEVEL: Record<string, number> = {
  ATXHeading1: 1,
  ATXHeading2: 2,
  ATXHeading3: 3,
  ATXHeading4: 4,
  ATXHeading5: 5,
  ATXHeading6: 6,
}

const lineCache: Record<string, Decoration> = Object.create(null)
const lineDeco = (cls: string) => lineCache[cls] ?? (lineCache[cls] = Decoration.line({ class: cls }))

function buildBlockLines(view: EditorView): DecorationSet {
  const { state } = view
  const tree = syntaxTree(state)
  const caretLine = state.doc.lineAt(state.selection.main.head).number
  const byLine = new Map<number, string[]>()
  const add = (from: number, cls: string) => {
    const at = state.doc.lineAt(from).from
    const list = byLine.get(at)
    if (list) list.push(cls)
    else byLine.set(at, [cls])
  }

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        const level = HEADING_LEVEL[node.name]
        if (level) {
          const line = state.doc.lineAt(node.from)
          const bare = /^ {0,3}#{1,6}$/.test(line.text)
          if (!(bare && line.number === caretLine)) add(node.from, `cm-md-h${level}`)
          return false
        }
        if (node.name === 'Blockquote') {
          const last = state.doc.lineAt(node.to).number
          for (let n = state.doc.lineAt(node.from).number; n <= last; n++) {
            add(state.doc.line(n).from, 'cm-md-quote')
          }
        }
      },
    })
  }

  const builder = new RangeSetBuilder<Decoration>()
  for (const at of [...byLine.keys()].sort((a, b) => a - b)) {
    builder.add(at, at, lineDeco([...new Set(byLine.get(at))].join(' ')))
  }
  return builder.finish()
}

const blockLineStyles = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildBlockLines(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        // Only matters for the bare-`##` hold-back.
        (update.selectionSet && caretLineMoved(update)) ||
        syntaxTree(update.state) != syntaxTree(update.startState)
      ) {
        this.decorations = buildBlockLines(update.view)
      }
    }
  },
  { decorations: (v) => v.decorations },
)

function caretLineMoved(update: ViewUpdate): boolean {
  return (
    update.startState.doc.lineAt(update.startState.selection.main.head).number !==
    update.state.doc.lineAt(update.state.selection.main.head).number
  )
}

/**
 * The heading scale lives here, on the line, and nowhere in highlight.ts: the
 * sizes are `em`, so a heading mark nested inside a heading line would compound
 * (1.4em × 1.4em). The heading faces mirror `.cm-entry-title` in
 * firstLineTitle.ts — the two must not diverge.
 */
const blockLineTheme = EditorView.theme({
  '.cm-md-h1': {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--h1-size)',
    fontWeight: 'var(--h1-weight)',
    letterSpacing: 'var(--h1-track)',
    color: 'var(--md-heading)',
    lineHeight: 'var(--h1-lh)',
  },
  '.cm-md-h2': {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--h2-size)',
    fontWeight: 'var(--h2-weight)',
    letterSpacing: 'var(--h1-track)',
    color: 'var(--md-heading)',
    lineHeight: '1.3',
  },
  '.cm-md-h3': {
    fontFamily: 'var(--font-display)',
    fontSize: 'var(--h3-size)',
    fontWeight: 'var(--h3-weight)',
    letterSpacing: 'var(--h1-track)',
    color: 'var(--md-heading)',
  },
  '.cm-md-h4, .cm-md-h5, .cm-md-h6': {
    fontFamily: 'var(--font-display)',
    fontSize: '1.05em',
    fontWeight: 'var(--h3-weight)',
    color: 'var(--md-heading)',
  },
  '.cm-md-quote': {
    fontStyle: 'italic',
    color: 'var(--md-quote)',
  },
})

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
  const ext = [Prec.high(highlighter), blockLineStyles, blockLineTheme]
  if (markdownHighlight.module) ext.unshift(EditorView.styleModule.of(markdownHighlight.module))
  return ext
}
