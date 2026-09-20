import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder, type EditorState, type Extension } from '@codemirror/state'
import { spiritualBlocksField } from './spiritualBlocksField'

/**
 * Paragraph dimming: fade every line except the paragraph the cursor is in, so
 * only what you're actively writing sits at full contrast. A "paragraph" is the
 * run of consecutive non-blank lines around the cursor (a blank line breaks it).
 */
const dimLine = Decoration.line({ class: 'cm-dim' })

/**
 * Line numbers `[first, last]` covered by each scripture block.
 *
 * A scripture block is a widget standing in for its fence lines, and those lines
 * are non-blank — so to a "run of non-blank lines" they look like prose, and the
 * paragraph above the block, the block, and the paragraph below it all read as
 * one. Write on the line beneath a verse and the line above the verse stayed lit.
 * A block is a boundary, the way a blank line is.
 *
 * Prayer and sense are not listed: they are the writer's own lines, drawn as
 * lines, and belong to the paragraph they sit in.
 */
function scriptureLineSpans(state: EditorState): Array<[number, number]> {
  const spans: Array<[number, number]> = []
  const { doc } = state
  for (const block of state.field(spiritualBlocksField, false) ?? []) {
    if (block.type !== 'scripture') continue
    // `block.to` is past the closing fence's newline, so the last character of
    // the block is always on the closing fence line (or is its newline).
    spans.push([doc.lineAt(block.from).number, doc.lineAt(Math.max(block.from, block.to - 1)).number])
  }
  return spans
}

export function activeParagraph(state: EditorState): { start: number; end: number } {
  const { doc } = state
  const spans = scriptureLineSpans(state)
  const isBreak = (n: number) =>
    doc.line(n).text.trim() === '' || spans.some(([first, last]) => n >= first && n <= last)

  const cur = doc.lineAt(state.selection.main.head).number

  let start = cur
  let end = cur
  // A blank line, or the stub beside a scripture block → only it is "active".
  if (!isBreak(cur)) {
    while (start > 1 && !isBreak(start - 1)) start--
    while (end < doc.lines && !isBreak(end + 1)) end++
  }
  return { start, end }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const { start, end } = activeParagraph(view.state)
  const { doc } = view.state

  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      if (line.number < start || line.number > end) {
        builder.add(line.from, line.from, dimLine)
      }
      pos = line.to + 1
    }
  }
  return builder.finish()
}

const dimTheme = EditorView.theme({
  '.cm-line': { transition: 'opacity 160ms ease' },
  '.cm-dim': { opacity: '0.28' },
  // The whole surface animates on every caret move between paragraphs, and on
  // a long entry that is a lot of line boxes inside a contenteditable. Honour
  // the system setting — and give WebKit one less thing to composite while
  // someone is typing into it.
  '@media (prefers-reduced-motion: reduce)': {
    '.cm-line, .cm-practice-prompt, .cm-practice-header': { transition: 'none' },
  },
  // Scripture renders as a block widget that sits *between* lines, so the
  // line-level `.cm-dim` decoration can't reach it — left alone it would stay at
  // full strength and dominate the dimmed page. Fade it to the same resting
  // opacity while dimming is active; hovering brings it back to full so it stays
  // readable on demand.
  //
  // Prayer and sense need nothing here. They are the writer's own lines now
  // (spiritualBlockDecoration.ts), so `.cm-dim` reaches them like any other
  // paragraph — which is the point: a marked paragraph fades and brightens with
  // the writing, because it *is* the writing.
  '.cm-spiritual-block': { opacity: '0.28' },

  // Ritual scaffolding is block widgets too, and left alone it produced the
  // exact inversion focus mode exists to prevent: the writer's own answers faded
  // to 0.28 while every question the app had asked stayed at full strength.
  //
  // A ritual's prompts sit between line boxes, so they can only be reached
  // through their neighbours. The blank stub CodeMirror renders for the replaced
  // token line carries `.cm-dim` for that line, and two siblings on from the
  // prompt is the answer it introduces — so "dim, unless the section I'm writing
  // in is the live one" is expressible without any extra state. If `:has` is
  // ever unavailable the whole selector is dropped and prompts simply stay lit,
  // which is where this started.
  '.cm-practice-prompt, .cm-practice-header': { transition: 'opacity 160ms ease' },
  '.cm-line.cm-dim + .cm-practice-header': { opacity: '0.28' },
  '.cm-line.cm-dim + .cm-practice-prompt:not(:has(+ .cm-line + .cm-line:not(.cm-dim)))': {
    opacity: '0.28',
  },
  /*
   * Readable on demand — where "on demand" is a thing the device can express.
   *
   * `:hover` on a touch device means "the last thing tapped", and it latches
   * there until the next tap. Unguarded, these rules made focus mode do the
   * opposite of its job on the iPad: tapping anywhere near a scripture block
   * or a ritual prompt left it burning at full strength over a dimmed page,
   * for as long as the writer stayed in the entry.
   */
  '@media (hover: hover)': {
    '.cm-spiritual-block:hover': { opacity: '1' },
    '.cm-practice-prompt:hover, .cm-practice-header:hover': { opacity: '1' },
  },
})

const dimPlugin = ViewPlugin.fromClass(
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
  {
    decorations: (v) => v.decorations,
  },
)

export const dimmingExtension: Extension = [dimTheme, dimPlugin]
