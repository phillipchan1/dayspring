import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { posInsideBlock, spiritualBlocksField } from './spiritualBlocksField'
import { editorTap, type TapContext } from './pointerInput'

/**
 * The `+`, in the left gutter of every line.
 *
 * This replaces the margin that used to run down the RIGHT of the writing
 * column — a hairline, a hand beside each marking, a `+` on the current line,
 * and a panel the rule opened. The whole of it is gone, and the reasons are
 * worth keeping:
 *
 *  · **Reading back is not writing.** What you set apart on a page is something
 *    you want when you return to the page, not while you are still making it.
 *    The margin now lives on the read surface, where it is the answer to a
 *    question someone is actually asking.
 *  · **One door, on the side doors are on.** Every editor a writer has used
 *    puts insert on the left of the line. Putting marking on the right made it
 *    a second vocabulary for the same act, and the rule then had three jobs —
 *    show, add, open — none of which announced itself.
 *
 * So: nothing on the right, and one `+` on the left that opens the same palette
 * `/` opens. Notion's gesture, and deliberately Notion's gesture: the writers
 * this is for have met it before, and a `/` they were never taught is exactly
 * the thing they never find.
 */

/** Distance from the writing column's left edge to the `+`, in rem. */
const GUTTER_REM = 1.35
/** Half-width of the clickable band around it, in px. */
const HIT_PX = 11

const plusLine = Decoration.line({ class: 'cm-plus-here' })

/**
 * The caret's line gets the `+` without a hover.
 *
 * Hover alone would mean the one line the writer is certainly on is the one
 * line that only reveals its door if they happen to move the mouse. Never
 * beside a line already inside a fence: a fence within a fence is not a
 * document anyone can edit back out of.
 */
function buildPlusHere(view: EditorView): DecorationSet {
  if (!view.hasFocus) return Decoration.none
  const { from } = view.state.selection.main
  if (posInsideBlock(view.state.field(spiritualBlocksField), from)) return Decoration.none
  return Decoration.set([plusLine.range(view.state.doc.lineAt(from).from)])
}

/** Lines the `+` never belongs beside. Mirrors the `content: none` rules above. */
const NO_PLUS = ['cm-mark-line', 'cm-mark-fence', 'cm-entry-title', 'cm-entry-title-explicit', 'cm-hr-line']

const gutterTheme = EditorView.theme({
  '.cm-line': {
    position: 'relative',
  },
  /*
   * A pseudo-element, not a widget — and the reason is the caret.
   *
   * The `+` is the one thing here that lands on a line with nothing on it yet,
   * and as a widget it was the only node in that line's box. WebKit then
   * painted no caret there at all: the cursor vanished on exactly the empty
   * line the writer was about to write in. (Chrome paints it at the line start
   * anyway, which is why this only ever showed on the iPad, the phone and the
   * Mac app.) Drawn this way an empty line's DOM is `<br>` and nothing else.
   * One more paint, and no more DOM inside a contenteditable.
   */
  '.cm-line::after': {
    content: '"+"',
    position: 'absolute',
    top: '0.1em',
    left: `-${GUTTER_REM}rem`,
    transform: 'translateX(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '14px',
    height: '1.2em',
    color: 'var(--text-faint)',
    fontSize: '0.78em',
    lineHeight: '1',
    // Invisible until wanted. `opacity` and not `display`, so there is no
    // layout to redo when it appears and nothing shifts beside the text.
    opacity: '0',
    cursor: 'pointer',
    transition: 'opacity 120ms ease, color 120ms ease',
  },
  /*
   * **Exactly one `+` on screen, ever.**
   *
   * Two rules put it there — the line you are ON, and the line you are POINTING
   * AT — and left alone they draw two of them on different lines, which reads
   * as a bug rather than as two answers to two questions. So they take turns:
   *
   *  · Pointer anywhere over the text → the hovered line wins, and the caret's
   *    `+` steps aside. You are reaching for a line, so it should be that line.
   *  · Typing → `cm-typing` kills the hover rule until the mouse next moves.
   *    CSS `:hover` is sticky: a pointer resting where it happened to be left
   *    keeps lighting that line while you write somewhere else entirely, and
   *    the `+` then sits beside a sentence you are not in.
   *
   * Hover is the whole line rather than the 14px of the `+`, because a
   * pseudo-element cannot be hovered on its own — a bigger target for free.
   */
  /*
   * All of it behind `hover: hover`, because all of it is a hover.
   *
   * `:hover` does not mean "the pointer is here" on a touch device — it means
   * "this is where the last tap landed", and it stays that way until the next
   * one. Unguarded, every rule below inverted on the iPad: tapping into the
   * editor latched `:hover` on `.cm-content`, and the third rule then hid the
   * caret-line `+` for as long as the writer stayed in that entry, while the
   * first rule left a second `+` glued beside whatever line had been tapped.
   * A control that appears where you are not and vanishes where you are.
   */
  '@media (hover: hover)': {
    '.cm-line:hover::after': { opacity: '0.5' },
    '.cm-line.cm-plus-here::after': { opacity: '0.5' },
    '.cm-content:hover .cm-line.cm-plus-here::after': { opacity: '0' },
    '.cm-content:hover .cm-line.cm-plus-here:hover::after': { opacity: '0.5' },
    '.cm-content.cm-typing .cm-line:hover::after': { opacity: '0' },
    '.cm-content.cm-typing .cm-line.cm-plus-here::after': { opacity: '0.5' },
    '.cm-line:hover:hover::after': { color: 'var(--text)' },
  },
  // Never beside a line that is already inside a fence, nor the fence
  // delimiters (spiritualBlockDecoration) — a fence within a fence is not a
  // document anyone can edit back out of. And never beside the title, for the
  // same reason `detectSlash` refuses `/` there: a block inserted on line 1
  // becomes the entry's title.
  '.cm-line.cm-mark-line::after': { content: 'none' },
  '.cm-line.cm-mark-fence::after': { content: 'none' },
  '.cm-line.cm-entry-title::after': { content: 'none' },
  '.cm-line.cm-entry-title-explicit::after': { content: 'none' },
  '.cm-line.cm-hr-line::after': { content: 'none' },
  '@media (prefers-reduced-motion: reduce)': {
    '.cm-line::after': { transition: 'none' },
  },
  /*
   * No hover, no `+` — on a phone and on an iPad alike.
   *
   * This was `max-width: 767px`, which is a question about how wide the window
   * is, and the `+` is not a question about width. It is revealed by hovering,
   * so a device that cannot hover cannot reveal it, and what was left on the
   * iPad was an invisible 22px target sitting in the gutter — exactly where a
   * thumb reaches to put the caret at the start of a line. Touch keeps the
   * command toolbar above the keyboard, which names the same commands out loud
   * and is the better affordance there anyway.
   */
  '@media (hover: none)': {
    '.cm-line::after': { content: 'none' },
  },
})

/** Horizontal centre of the `+` column, in viewport coordinates. */
function gutterX(view: EditorView): number {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  return view.contentDOM.getBoundingClientRect().left - GUTTER_REM * rem
}

/**
 * Where the `+` is drawn for a line, in viewport coordinates.
 *
 * Read back from the theme rather than measured: a pseudo-element has no rect
 * of its own to ask for. `0.1em` of offset and `1.2em` of height at `0.78em`
 * resolve against the line's own font size, which is the one number to look up.
 */
export function plusRect(
  view: EditorView,
  line: HTMLElement,
): { top: number; bottom: number; left: number } {
  const size = parseFloat(getComputedStyle(line).fontSize) || 16
  const top = line.getBoundingClientRect().top + 0.1 * 0.78 * size
  return { top, bottom: top + 1.2 * 0.78 * size, left: gutterX(view) - 7 }
}

/**
 * The `+` was hit, and here is the line it belongs to.
 *
 * **The line is found by Y, not by the event target.** The `+` is drawn in the
 * gutter, which is outside its own line's box — so at that x the target is the
 * scroller, and `closest('.cm-line')` finds nothing. Asking `posAtCoords` at the
 * same height but just inside the text is the reliable question.
 *
 * The rest is geometry: inside the gutter's band, and within the small box the
 * `+` is actually drawn in. That last test matters on a wrapped line — the box
 * covers every row of it, but the `+` is only ever beside the first.
 */
export function hitPlus(
  view: EditorView,
  event: { clientX: number; clientY: number },
): { el: HTMLElement; pos: number } | null {
  if (Math.abs(event.clientX - gutterX(view)) > HIT_PX) return null
  const rect = view.contentDOM.getBoundingClientRect()
  const pos = view.posAtCoords({ x: rect.left + 4, y: event.clientY }, false)
  const line = view.state.doc.lineAt(pos)
  const node = view.domAtPos(line.from).node
  const host = node instanceof HTMLElement ? node : node.parentElement
  const el = host?.closest('.cm-line') as HTMLElement | null
  if (!el) return null
  if (NO_PLUS.some((c) => el.classList.contains(c))) return null
  const { top, bottom } = plusRect(view, el)
  return event.clientY >= top && event.clientY <= bottom ? { el, pos: line.from } : null
}

/**
 * Mark the content as "being typed into", and unmark it on the next real
 * pointer movement.
 *
 * Cheap on purpose: a class toggle on one element, set from an update that has
 * already happened and cleared from a listener that removes itself the moment
 * it fires. Nothing measures, nothing runs per frame, and no keystroke waits on
 * it — Principle 3 is a hard constraint on this surface.
 */
function typingPlugin() {
  return ViewPlugin.define((view: EditorView) => {
    let typing = false
    const stop = () => {
      if (!typing) return
      typing = false
      view.contentDOM.classList.remove('cm-typing')
      window.removeEventListener('pointermove', stop)
    }
    return {
      update(update: ViewUpdate) {
        if (!update.docChanged) return
        if (!typing) {
          typing = true
          view.contentDOM.classList.add('cm-typing')
          window.addEventListener('pointermove', stop)
        }
      },
      destroy: stop,
    }
  })
}

function plusHerePlugin() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet

      constructor(view: EditorView) {
        this.decorations = buildPlusHere(view)
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.selectionSet || update.focusChanged) {
          this.decorations = buildPlusHere(update.view)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}

/**
 * The line menu: a `+` in the left gutter that opens the insert palette.
 *
 * `onPlus` carries the document position of the line it was pressed beside and
 * the viewport rect of the `+` itself, so the palette can open against it. The
 * caret is NOT moved here — the caller decides, because a live selection is a
 * range the palette may be about to mark.
 */
export function lineMenuExtension(
  onPlus: (pos: number, at: { top: number; bottom: number; left: number }) => void,
): Extension {
  return [
    gutterTheme,
    plusHerePlugin(),
    typingPlugin(),
    // Ahead of the block tap handler, which would otherwise read this as a
    // press on the line's content. `editorTap` cancels the press rather than
    // handling a click, so the caret and any live selection survive — the
    // selection is the range the palette may be about to mark.
    editorTap({
      claims: (ctx, view) => Boolean(plusTarget(ctx, view)),
      onTap: (ctx, view) => {
        const hit = plusTarget(ctx, view)
        if (!hit) return false
        onPlus(hit.pos, plusRect(view, hit.el))
        return true
      },
    }),
  ]
}

/**
 * The `+` under this press, if it is a press the `+` can answer.
 *
 * **Mouse only, and not as a platform exception.** The `+` is drawn at zero
 * opacity and revealed by hover; a finger cannot hover, so on a touch it is an
 * invisible 22px target sitting exactly where you reach to put the caret at the
 * start of a line. Gating on the pointer that is actually pressing — rather
 * than on what the device is capable of — is also the only test that survives
 * an iPad with a Magic Keyboard, where the trackpad makes `(pointer: coarse)`
 * false while the owner keeps writing with a finger. Touch reaches these same
 * commands through the command toolbar above the keyboard, which names them
 * out loud.
 */
function plusTarget(ctx: TapContext, view: EditorView): { el: HTMLElement; pos: number } | null {
  if (ctx.pointerType !== 'mouse') return null
  return hitPlus(view, ctx)
}
