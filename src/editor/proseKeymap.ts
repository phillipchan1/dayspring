import {
  copyLineDown,
  copyLineUp,
  defaultKeymap,
  deleteLine,
  moveLineDown,
  moveLineUp,
  selectDocEnd,
  selectDocStart,
  selectLine,
  toggleBlockComment,
  toggleComment,
  toggleTabFocusMode,
} from '@codemirror/commands'
import { EditorSelection, type EditorState, type SelectionRange, type Text } from '@codemirror/state'
import { EditorView, type Command, type KeyBinding } from '@codemirror/view'

/**
 * The writing surface's keys, made to match NSTextView (TextEdit, Notes,
 * Pages) instead of a code editor (DESIGN_PRINCIPLES N4).
 *
 * CodeMirror's `defaultKeymap` is a programmer's: ⌥↑ moved the line, ⇧⌥↑
 * duplicated it, ⌘/ commented it out and ⌘⇧K deleted it. A writer reaching
 * for "start of this paragraph" reordered their entry instead. Here:
 *
 *   ⌥↑ / ⌥↓        start / end of the paragraph (again: the one before/after)
 *   ⇧⌥↑ / ⇧⌥↓      extend the selection to it
 *   ⌥← / ⌥→        by word — `Intl.Segmenter` words, so "don't" and "God’s"
 *   ⌥⌫ / ⌥⌦        are one word, not three; ⇧ extends
 *   ⌃L             centre the caret's line in the window
 *   Home / End     scroll to the top / bottom without moving the caret (Mac);
 *                  ⇧Home / ⇧End select to there
 *
 * Every command here runs only on its own chord and reads only the caret's
 * line (or two): nothing is added to typing.
 */

// ── Paragraphs ─────────────────────────────────────────────────────────────

/**
 * Where ⌥↑ goes: NSTextView's `moveBackward:` then `moveToBeginningOfParagraph:`.
 * Mid-paragraph that is its start; at its start, the start of the one before.
 */
export function paragraphStartBefore(doc: Text, pos: number): number {
  return doc.lineAt(Math.max(0, pos - 1)).from
}

/** Where ⌥↓ goes: `moveForward:` then `moveToEndOfParagraph:`. */
export function paragraphEndAfter(doc: Text, pos: number): number {
  return doc.lineAt(Math.min(doc.length, pos + 1)).to
}

// ── Words ──────────────────────────────────────────────────────────────────

interface Seg {
  index: number
  segment: string
  isWordLike?: boolean
}

type Segmenter = { segment: (text: string) => Iterable<Seg> }

let segmenter: Segmenter | null | undefined

function wordSegmenter(): Segmenter | null {
  if (segmenter !== undefined) return segmenter
  const Ctor = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => Segmenter })
    .Segmenter
  segmenter = Ctor ? new Ctor(undefined, { granularity: 'word' }) : null
  return segmenter
}

/** Test seam: run the word commands as if the platform had no Segmenter. */
export function __setSegmenterForTests(value: Segmenter | null | undefined): void {
  segmenter = value
}

/** A word for these keys: a dictionary word, a number, or an emoji. */
function isWordish(seg: Seg): boolean {
  return !!seg.isWordLike || /\p{Extended_Pictographic}/u.test(seg.segment)
}

/**
 * In one line's text, where a word-move backward from `offset` lands: the
 * start of the last word before it. Punctuation between is passed over, as
 * NSTextView passes it ("world. |" → "|world. "). A line with no word before
 * the caret but some marks ("---|", "**|") stops at the start of those marks,
 * so a press never reaches further than the writer can see.
 */
function wordStartInLine(seg: Segmenter, text: string, offset: number): number {
  let word = -1
  for (const s of seg.segment(text)) {
    if (s.index >= offset) break
    if (isWordish(s)) word = s.index
  }
  if (word >= 0) return word
  const run = /\S+\s*$/.exec(text.slice(0, offset))
  return run ? run.index : 0
}

/** The mirror of wordStartInLine: the end of the first word after `offset`. */
function wordEndInLine(seg: Segmenter, text: string, offset: number): number {
  for (const s of seg.segment(text)) {
    const end = s.index + s.segment.length
    if (end <= offset) continue
    if (isWordish(s)) return end
  }
  const run = /^\s*\S+/.exec(text.slice(offset))
  return run ? offset + run[0].length : text.length
}

/**
 * Where ⌥← (and ⌥⌫) go from `pos`, or null when the platform has no word
 * segmenter (the caller then leaves the key to CodeMirror).
 *
 * At the start of a paragraph — or with only spaces before the caret — the
 * move crosses the line break once and carries on in the paragraph above.
 */
export function wordBoundaryBackward(doc: Text, pos: number): number | null {
  const seg = wordSegmenter()
  if (!seg) return null
  let line = doc.lineAt(pos)
  let offset = pos - line.from
  if (!/\S/.test(line.text.slice(0, offset))) {
    if (line.number === 1) return line.from
    line = doc.line(line.number - 1)
    offset = line.length
  }
  return line.from + wordStartInLine(seg, line.text, offset)
}

/** Where ⌥→ (and ⌥⌦) go from `pos`. */
export function wordBoundaryForward(doc: Text, pos: number): number | null {
  const seg = wordSegmenter()
  if (!seg) return null
  let line = doc.lineAt(pos)
  let offset = pos - line.from
  if (!/\S/.test(line.text.slice(offset))) {
    if (line.number === doc.lines) return line.to
    line = doc.line(line.number + 1)
    offset = 0
  }
  return line.from + wordEndInLine(seg, line.text, offset)
}

// ── Commands ───────────────────────────────────────────────────────────────

type Target = { state: EditorState; dispatch: (tr: ReturnType<EditorState['update']>) => void }

/** Push `pos` out of an atomic range (a concealed marker, a photo) the way CM's own commands do. */
function skipAtomic(target: Target, pos: number, forward: boolean): number {
  if (!(target instanceof EditorView)) return pos
  for (const ranges of target.state.facet(EditorView.atomicRanges).map((f) => f(target))) {
    ranges.between(pos, pos, (from, to) => {
      if (from < pos && to > pos) pos = forward ? to : from
    })
  }
  return pos
}

function moveBy(
  target: Target,
  find: (doc: Text, range: SelectionRange) => number | null,
  forward: boolean,
  extend: boolean,
): boolean {
  const { state } = target
  let unsupported = false
  const selection = EditorSelection.create(
    state.selection.ranges.map((range) => {
      const to = find(state.doc, range)
      if (to == null) {
        unsupported = true
        return range
      }
      const head = skipAtomic(target, to, forward)
      return extend ? EditorSelection.range(range.anchor, head) : EditorSelection.cursor(head, forward ? -1 : 1)
    }),
    state.selection.mainIndex,
  )
  if (unsupported) return false
  // Swallow the chord even at the edge of the document, so the browser's own
  // contenteditable handling of it never runs behind CodeMirror's back.
  if (selection.eq(state.selection)) return true
  target.dispatch(state.update({ selection, scrollIntoView: true, userEvent: 'select' }))
  return true
}

/** A plain move with a selection collapses it to the edge it is moving toward first. */
function collapsedOr(forward: boolean, find: (doc: Text, pos: number) => number | null) {
  return (doc: Text, range: SelectionRange) =>
    range.empty ? find(doc, range.head) : forward ? range.to : range.from
}

function paragraphMove(forward: boolean, extend: boolean): Command {
  const step = forward ? paragraphEndAfter : paragraphStartBefore
  return (view) =>
    moveBy(
      view,
      extend
        ? (doc, range) => step(doc, range.head)
        : (doc, range) =>
            range.empty
              ? step(doc, range.head)
              : forward
                ? doc.lineAt(range.to).to
                : doc.lineAt(range.from).from,
      forward,
      extend,
    )
}

function wordMove(forward: boolean, extend: boolean): Command {
  const find = forward ? wordBoundaryForward : wordBoundaryBackward
  return (view) =>
    moveBy(view, extend ? (doc, range) => find(doc, range.head) : collapsedOr(forward, find), forward, extend)
}

function wordDelete(forward: boolean): Command {
  return (view) => {
    const { state } = view
    if (state.readOnly) return false
    // A selection is deleted as a selection; CodeMirror's binding below does it.
    if (state.selection.ranges.some((r) => !r.empty)) return false
    const find = forward ? wordBoundaryForward : wordBoundaryBackward
    if (find(state.doc, state.selection.main.head) == null) return false
    const tr = state.changeByRange((range) => {
      const raw = find(state.doc, range.head) ?? range.head
      const towards = skipAtomic(view, raw, forward)
      const from = Math.min(range.head, towards)
      const to = Math.max(range.head, towards)
      return from === to ? { range } : { changes: { from, to }, range: EditorSelection.cursor(from) }
    })
    if (tr.changes.empty) return true
    view.dispatch(
      state.update(tr, { scrollIntoView: true, userEvent: forward ? 'delete.forward' : 'delete.backward' }),
    )
    return true
  }
}

export const cursorParagraphBackward = paragraphMove(false, false)
export const cursorParagraphForward = paragraphMove(true, false)
export const selectParagraphBackward = paragraphMove(false, true)
export const selectParagraphForward = paragraphMove(true, true)
export const cursorWordBackward = wordMove(false, false)
export const cursorWordForward = wordMove(true, false)
export const selectWordBackward = wordMove(false, true)
export const selectWordForward = wordMove(true, true)
export const deleteWordBackward = wordDelete(false)
export const deleteWordForward = wordDelete(true)

/** ⌃L — NSTextView's `centerSelectionInVisibleArea:`. Scrolls; the caret stays. */
export const centerCaret: Command = (view) => {
  view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: 'center' }) })
  return true
}

/** Home on a Mac — `scrollToBeginningOfDocument:`. The caret does not move. */
export const scrollToDocStart: Command = (view) => {
  view.dispatch({ effects: EditorView.scrollIntoView(0, { y: 'start' }) })
  return true
}

/** End on a Mac — `scrollToEndOfDocument:`. The caret does not move. */
export const scrollToDocEnd: Command = (view) => {
  view.dispatch({ effects: EditorView.scrollIntoView(view.state.doc.length, { y: 'end' }) })
  return true
}

/** The prose bindings. Ahead of the defaults, so they win their chords. */
export const proseKeymap: readonly KeyBinding[] = [
  { mac: 'Alt-ArrowUp', key: 'Ctrl-ArrowUp', run: cursorParagraphBackward, shift: selectParagraphBackward, preventDefault: true },
  { mac: 'Alt-ArrowDown', key: 'Ctrl-ArrowDown', run: cursorParagraphForward, shift: selectParagraphForward, preventDefault: true },
  { mac: 'Alt-ArrowLeft', key: 'Mod-ArrowLeft', run: cursorWordBackward, shift: selectWordBackward, preventDefault: true },
  { mac: 'Alt-ArrowRight', key: 'Mod-ArrowRight', run: cursorWordForward, shift: selectWordForward, preventDefault: true },
  { mac: 'Alt-Backspace', key: 'Mod-Backspace', run: deleteWordBackward, preventDefault: true },
  { mac: 'Alt-Delete', key: 'Mod-Delete', run: deleteWordForward, preventDefault: true },
  { mac: 'Ctrl-l', run: centerCaret, preventDefault: true },
  { mac: 'Home', run: scrollToDocStart, shift: selectDocStart, preventDefault: true },
  { mac: 'End', run: scrollToDocEnd, shift: selectDocEnd, preventDefault: true },
]

/**
 * Code-editor commands with no place in a journal. The line movers and the
 * comment toggles are the ones the audit names; ⌃L's select-line gives way to
 * centring. Alt-A (block comment) and Shift-Alt-m (tab-focus mode, on a Mac)
 * go too: on a Mac those chords TYPE "Å" and "Â", and CodeMirror matched them
 * by key code and swallowed the letter.
 */
const DROPPED: ReadonlySet<Command> = new Set<Command>([
  moveLineUp,
  moveLineDown,
  copyLineUp,
  copyLineDown,
  toggleComment,
  toggleBlockComment,
  deleteLine,
  selectLine,
])

/** CodeMirror's default keymap, minus the code editor. */
export const writingDefaultKeymap: readonly KeyBinding[] = defaultKeymap
  .filter((b) => !(b.run && DROPPED.has(b.run)))
  .map((b) =>
    // Keep tab-focus mode's escape hatch where its chord types nothing.
    b.run === toggleTabFocusMode ? { key: 'Ctrl-m', run: toggleTabFocusMode } : b,
  )
