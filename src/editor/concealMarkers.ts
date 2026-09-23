import { syntaxTree } from '@codemirror/language'
import { Prec, type EditorSelection, type EditorState, type Range, type Text } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  keymap,
  ViewPlugin,
  type Command,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
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
 *   HorizontalRule — horizontalRule.ts replaces the line with a decorative
 *                 rule, and reveals the source when the caret sits on it.
 *   fenced CodeMark, CodeInfo — meaningful, visible content (and the fences
 *                 are where spiritual blocks live).
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
}

/*
 * Headings are deliberately NOT in SPAN_OF_MARK. A heading is a whole line, so
 * "reveal while the caret touches it" meant the `## ` stayed on screen the
 * entire time you typed the heading and only vanished on Enter. Instead the
 * leading hashes hide the moment `## ` is complete and stay hidden while you
 * write; they come back only with the caret at the very start of the line
 * (Home, or arrowing left past the text). Backspace and Enter at the start of
 * the text are handled below so neither lands on an invisible character.
 */

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

/**
 * The leading `## ` (hashes + space, `[from, to)`) shows only when a selection
 * reaches into it — the caret at the line start, or a range that starts before
 * the text. A caret at `to`, the start of the heading text, keeps it hidden:
 * that's where the caret sits the moment the space is typed.
 */
function revealsLeadingMark(sel: EditorSelection, from: number, to: number): boolean {
  for (const r of sel.ranges) {
    if (r.from < to && r.to >= from) return true
  }
  return false
}

/**
 * The hidden leading `## ` of the heading on the caret's line, when the caret
 * sits exactly where the heading text starts. Null otherwise.
 */
function hiddenHeadingMarkAtCaret(state: EditorState): { from: number; to: number } | null {
  const sel = state.selection.main
  if (!sel.empty || state.selection.ranges.length > 1) return null
  const line = state.doc.lineAt(sel.head)
  const m = /^ {0,3}#{1,6} /.exec(line.text)
  if (!m || sel.head !== line.from + m[0].length) return null
  // Confirm with the tree — inside a fence, `## ` is not a heading.
  const node = syntaxTree(state).resolveInner(line.from + m[0].length - 1, -1)
  for (let n: typeof node | null = node; n; n = n.parent) {
    if (/^ATXHeading[1-6]$/.test(n.name)) return { from: line.from, to: sel.head }
  }
  return null
}

/**
 * Backspace at the start of the heading text: the character before the caret
 * is the hidden space, and deleting it alone would leave `##title` — no longer
 * a heading, hashes suddenly back. Remove the whole marker instead, turning the
 * heading back into a paragraph. (What Notion, Bear and Pages all do.)
 */
const demoteHeading: Command = ({ state, dispatch }) => {
  const mark = hiddenHeadingMarkAtCaret(state)
  if (!mark) return false
  dispatch(
    state.update({
      changes: { from: mark.from, to: mark.to },
      selection: { anchor: mark.from },
      userEvent: 'delete.backward',
      scrollIntoView: true,
    }),
  )
  return true
}

/**
 * Enter at the start of non-empty heading text: split there and the text below
 * becomes a plain paragraph, leaving an empty heading behind. The writer meant
 * "give me a line above", so open one and keep the heading whole.
 */
const openLineAboveHeading: Command = ({ state, dispatch }) => {
  const mark = hiddenHeadingMarkAtCaret(state)
  if (!mark) return false
  if (state.doc.lineAt(mark.to).to === mark.to) return false // empty heading: default Enter
  dispatch(
    state.update({
      changes: { from: mark.from, insert: '\n' },
      selection: { anchor: mark.to + 1 },
      userEvent: 'input',
      scrollIntoView: true,
    }),
  )
  return true
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
    // Above the markdown keymap (Prec.high), which would otherwise split the
    // heading or delete the invisible space.
    Prec.highest(
      keymap.of([
        { key: 'Backspace', run: demoteHeading },
        { key: 'Enter', run: openLineAboveHeading },
      ]),
    ),
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
        if (node.name === 'HeaderMark') {
          ;({ from: f, to: t } = widenHeaderMark(doc, f, t))
          const heading = node.node.parent
          if (!heading) return
          if (node.from === heading.from) {
            // Leading hashes. Until the space is typed this is still just
            // characters being typed — keep them visible.
            if (t === node.to) {
              if (touched(sel, heading.from, heading.to)) return
            } else if (revealsLeadingMark(sel, f, t)) return
          } else if (touched(sel, heading.from, heading.to)) {
            // Closing `##` — rare; shown whenever the caret is in the heading.
            return
          }
        }
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
