import { syntaxTree } from '@codemirror/language'
import type { EditorSelection, Range, Text } from '@codemirror/state'
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { posInsideBlock, spiritualBlocksField } from './spiritualBlocksField'
import { isPracticeTokenLine } from '@/lib/practiceTokens'

/**
 * Hides markdown's syntax characters so the prose reads as prose: `*word*` is
 * italic with no asterisks, `# Title` is a heading with no hash.
 *
 * The markers are still in the document — nothing here changes a character of
 * an entry — they're just not painted. They come back the moment the caret or a
 * selection touches the span they belong to, so the syntax is always there to
 * repair and never there to trip over. Settings → Writing → "Show markdown
 * syntax" turns the whole extension off.
 *
 * Driven by the syntax tree rather than regexes, on purpose: the styling in
 * highlight.ts already comes from the tree, so a second regex layer could
 * disagree with it — and a disagreement means markers hidden with no styling
 * applied, i.e. characters silently vanishing from someone's journal.
 */

/** Marker nodes to hide. See the exclusions below — they're deliberate. */
const CONCEALED = new Set([
  'EmphasisMark', // * and _ , for both Emphasis and StrongEmphasis
  'StrikethroughMark', // ~~
  'HeaderMark', // # (ATX only; SetextHeading is removed from the grammar)
  'LinkMark', // [ ] ( )
  'URL', // the destination, so a link reads as its label
  'HighlightMark', // == and =={rose}  (markdownMarks.ts)
  'UnderlineMark', // ++            (markdownMarks.ts)
  'CodeMark', // ` — inline only, guarded below
])

/*
 * Deliberately NOT concealed:
 *
 *   ListMark      "- " IS the visible bullet. Hiding it loses the bullet and
 *                 collides with orderedListNumbering, which already replaces
 *                 ordered list marks with a label widget.
 *   QuoteMark     ">" is the only visual signal a line is a blockquote today —
 *                 highlight.ts merely italicises it. Revisit together with a
 *                 real left-rule line decoration.
 *   TaskMarker    taskListExtension already replaces it with a checkbox.
 *   Escape        "\*" should keep showing its backslash while you edit it.
 *   HorizontalRule, fenced CodeMark, CodeInfo — meaningful, visible content
 *                 (and the fences are where spiritual blocks live).
 */

/** Inline spans whose markers reveal when the selection touches them. */
const SPAN_OF_MARK: Record<string, true> = {
  Emphasis: true,
  StrongEmphasis: true,
  Strikethrough: true,
  InlineCode: true,
  Highlight: true,
  Underline: true,
  Link: true,
  Image: true,
  ATXHeading1: true,
  ATXHeading2: true,
  ATXHeading3: true,
  ATXHeading4: true,
  ATXHeading5: true,
  ATXHeading6: true,
}

const hidden = Decoration.replace({})

/**
 * True when any selection range touches `[from, to]`, INCLUSIVE at both ends.
 *
 * Inclusive is the whole point. With an exclusive test, the caret sitting at
 * `*italic*|` would be pressed against an invisible, atomic `*`, and Backspace
 * would delete a character the writer cannot see. Inclusive means the markers
 * reappear the instant the caret arrives at a boundary, so every destructive
 * keystroke lands on something visible.
 */
function touched(sel: EditorSelection, from: number, to: number): boolean {
  for (const r of sel.ranges) {
    if (r.from <= to && r.to >= from) return true
  }
  return false
}

export function concealMarkersExtension() {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = build(view)
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          // The reveal rule lives here: moving the caret changes what's hidden.
          update.selectionSet ||
          // On a long entry the markdown parse finishes AFTER the doc change;
          // without this the concealment lags the text by several frames.
          syntaxTree(update.state) != syntaxTree(update.startState)
        ) {
          this.decorations = build(update.view)
        }
        // Not focusChanged: blurring the editor must not re-conceal under the
        // writer's cursor (the format bar deliberately keeps focus anyway).
      }
    },
    { decorations: (v) => v.decorations },
  )

  return [
    plugin,
    // Without this the caret stalls for two presses on a hidden `**`. Safe
    // because the reveal predicate is inclusive: a touched span stops being
    // decorated, and so stops being atomic, before the caret can be trapped.
    EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  ]
}

/**
 * A leading `#` marker covers only the hashes, so replacing it alone would leave
 * a stray space indenting the heading. Swallow the space on whichever side the
 * marker sits (`# Title` opens, `## Title ##` closes).
 */
function widenHeaderMark(doc: Text, from: number, to: number): { from: number; to: number } {
  const atLineStart = from === doc.lineAt(from).from
  if (atLineStart) {
    return doc.sliceString(to, to + 1) === ' ' ? { from, to: to + 1 } : { from, to }
  }
  return doc.sliceString(from - 1, from) === ' ' ? { from: from - 1, to } : { from, to }
}

function build(view: EditorView): DecorationSet {
  const { state } = view
  const doc = state.doc
  const sel = state.selection
  const blocks = state.field(spiritualBlocksField)
  const tree = syntaxTree(state)
  const ranges: Range<Decoration>[] = []
  const seen = new Set<string>()

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        // Attachment photos are block-replace widgets. An inline replace
        // overlapping one is the measure-pass crash all over again.
        if (node.name === 'Image') return false

        if (SPAN_OF_MARK[node.name]) {
          // A revealed span keeps ALL its markers visible — including those of
          // any span nested inside it, which is what you want when you're about
          // to retype the whole run.
          if (touched(sel, node.from, node.to)) return false
          return
        }

        if (!CONCEALED.has(node.name)) return
        // Fenced code marks (```) are where spiritual blocks live — only the
        // inline backtick is a marker we own.
        if (node.name === 'CodeMark' && node.node.parent?.name !== 'InlineCode') return

        let { from: f, to: t } = node
        if (node.name === 'HeaderMark') ({ from: f, to: t } = widenHeaderMark(doc, f, t))
        if (f >= t) return

        // Never decorate inside a spiritual block or a hidden practice token
        // line — both are already atomic block-replace widgets.
        if (posInsideBlock(blocks, f) || posInsideBlock(blocks, t - 1)) return
        const line = doc.lineAt(f)
        if (line.number !== doc.lineAt(t).number) return // replace can't span lines
        if (isPracticeTokenLine(line.text.trim())) return

        const key = `${f}:${t}`
        if (seen.has(key)) return
        seen.add(key)
        ranges.push(hidden.range(f, t))
      },
    })
  }

  // Sorted rather than RangeSetBuilder-built: a link emits `[` before the marks
  // inside its own label, so these do not arrive in document order.
  ranges.sort((a, b) => a.from - b.from || a.to - b.to)
  return Decoration.set(ranges, true)
}
