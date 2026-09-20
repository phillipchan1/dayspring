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

/** Distance from a line's left edge to the `+`'s centre, in rem. */
const GUTTER_REM = 1.35
/**
 * The `+`'s box, and what is drawn in it, in px.
 *
 * 24 is the size of Notion's own button, which is the one these writers have
 * already learned to reach for; the mark inside is 10 across at 1.5 thick, a
 * notch heavier than the serif `+` glyph it replaced. Fixed px rather than em:
 * a control does not grow with the sentence beside it, so a large heading does
 * not get a large door.
 */
const PLUS_BOX = 24
const PLUS_ARM = 10
const PLUS_STROKE = 1.5

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
   *
   * **Two bars, not a `+` character.** A glyph sits wherever its font puts the
   * math axis, which is not the middle of its em box and differs face to face —
   * it read as a few pixels high beside the text. Two gradient bars centred in
   * a box are centred by construction, whatever the font.
   *
   * **`0.5lh` is the middle of THIS line's first row.** The old offset was
   * `0.1em` against a `1.2em` box, which centred the mark on a line exactly as
   * tall as its font — and lines here are 1.7 times that, so it hung about a
   * quarter of a line too high. `lh` is the line's own leading, so it stays
   * right at any line-height setting, and it is the FIRST row's middle because
   * the box is anchored to the top of a line that may wrap.
   *
   * The font-size is left inherited on purpose: `lh` resolves against the
   * pseudo-element's own metrics, and those have to be the line's.
   */
  '.cm-line::after': {
    content: '""',
    position: 'absolute',
    top: `calc(0.5lh - ${PLUS_BOX / 2}px)`,
    left: `calc(-${GUTTER_REM}rem - ${PLUS_BOX / 2}px)`,
    width: `${PLUS_BOX}px`,
    height: `${PLUS_BOX}px`,
    color: 'var(--text-faint)',
    backgroundImage: 'linear-gradient(currentColor, currentColor), linear-gradient(currentColor, currentColor)',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: `${PLUS_ARM}px ${PLUS_STROKE}px, ${PLUS_STROKE}px ${PLUS_ARM}px`,
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
    // The line you are on, at rest: `--text-faint` at 0.85, roughly 1.9:1
    // against the page on the light themes. It was 0.5 (about 1.4:1), which is
    // under what a mark this thin can be found at without hunting for it.
    '.cm-line.cm-plus-here::after': { opacity: '0.85' },
    '.cm-content:hover .cm-line.cm-plus-here::after': { opacity: '0' },
    '.cm-content:hover .cm-line.cm-plus-here:hover::after': { opacity: '0.5' },
    '.cm-content.cm-typing .cm-line:hover::after': { opacity: '0' },
    '.cm-content.cm-typing .cm-line.cm-plus-here::after': { opacity: '0.85' },
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

const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

/** The line's own leading, in px. Unset (`normal`) has no number, so use the usual 1.2. */
function leadingPx(line: HTMLElement): number {
  const style = getComputedStyle(line)
  const leading = parseFloat(style.lineHeight)
  return Number.isFinite(leading) ? leading : 1.2 * (parseFloat(style.fontSize) || 16)
}

/**
 * Where the `+` is drawn for a line, in viewport coordinates.
 *
 * Read back from the theme rather than measured: a pseudo-element has no rect
 * of its own to ask for. It is the same two numbers the stylesheet uses —
 * half the line's leading down, and `GUTTER_REM` left of the line's own edge —
 * and both come from the LINE, not from the editor's content box. Themes that
 * pad `.cm-content` (Cloister and Compline draw their hairline at its edge and
 * inset the text) move every line right of that box, and a hit test measured
 * from the box then sat a whole gutter away from the mark it was testing.
 *
 * Takes no view on purpose: nothing here needs one, and it lets the marketing
 * scene press the same `+` a writer does without reaching for the editor.
 */
export function plusRect(line: HTMLElement): {
  top: number
  bottom: number
  left: number
  right: number
} {
  const box = line.getBoundingClientRect()
  const top = box.top + leadingPx(line) / 2 - PLUS_BOX / 2
  const left = box.left - GUTTER_REM * remPx() - PLUS_BOX / 2
  return { top, bottom: top + PLUS_BOX, left, right: left + PLUS_BOX }
}

/**
 * The `+` was hit, and here is the line it belongs to.
 *
 * **The line is found by Y, not by the event target.** A press on the `+` does
 * reach this handler — the pseudo-element reports its parent line as the
 * target — but that line cannot tell a press on the `+` from a press on its own
 * text, and a wrapped line has one target for every row. Asking `posAtCoords`
 * at the same height but just inside the text names the row the writer meant.
 *
 * The rest is geometry: inside the box the `+` is actually drawn in. That
 * matters on a wrapped line — the box sits beside the first row only.
 */
export function hitPlus(
  view: EditorView,
  event: { clientX: number; clientY: number },
): { el: HTMLElement; pos: number } | null {
  const rect = view.contentDOM.getBoundingClientRect()
  const lineLeft = rect.left + (parseFloat(getComputedStyle(view.contentDOM).paddingLeft) || 0)
  // Every press in the text comes through here and almost none are on the `+`,
  // which is always left of the lines.
  if (event.clientX > lineLeft) return null
  const pos = view.posAtCoords({ x: lineLeft + 4, y: event.clientY }, false)
  const line = view.state.doc.lineAt(pos)
  const node = view.domAtPos(line.from).node
  const host = node instanceof HTMLElement ? node : node.parentElement
  const el = host?.closest('.cm-line') as HTMLElement | null
  if (!el) return null
  if (NO_PLUS.some((c) => el.classList.contains(c))) return null
  const { top, bottom, left, right } = plusRect(el)
  const inside =
    event.clientY >= top && event.clientY <= bottom && event.clientX >= left && event.clientX <= right
  return inside ? { el, pos: line.from } : null
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
        onPlus(hit.pos, plusRect(hit.el))
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
