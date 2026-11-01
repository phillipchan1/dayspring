import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { Prec, type Extension } from '@codemirror/state'

/**
 * Typewriter scrolling: keep the line with the cursor vertically centered.
 *
 * Padding is synced when the viewport height changes; scrolling runs only on
 * doc/selection changes — never on geometryChanged alone (that caused a CM
 * measure loop when padding + scrollIntoView fed each other).
 *
 * **Typing scrolls only when the caret's line block changes.** A keystroke
 * that stays on the same line, in a paragraph that did not grow a row, has
 * nothing to re-centre — but it used to cost a second transaction and a
 * scroll measure after every key. Now typing re-centres only when the caret's
 * block is a different one (Return, a join) or a different height (the
 * paragraph wrapped onto, or back off, a row). The block comes from
 * CodeMirror's height map (`lineBlockAt`), which reads no layout and no text.
 * Caret moves that are not typing — arrows, clicks, a jump — still centre
 * every time, as they always did.
 *
 * The theme is `Prec.high`: CodeMirror ranks themes by extension precedence,
 * EARLIER wins, so registered after `editorTheme` (as the compartment is) the
 * base `paddingBottom: 40vh` beat `--tw-pad` and the caret on the last lines
 * of an entry — where writing happens — settled below centre.
 *
 * **Centre means the centre of what the keyboard leaves.** iOS shrinks the
 * visual viewport for the on-screen keyboard and leaves the layout viewport,
 * and so this scroller, alone. The phone's shell follows the visual viewport
 * down, so there the two agree; the iPad's wide layout does not, and a third to
 * a half of its scroller sits under the keyboard — in landscape, the "centred"
 * line landed on the keyboard's top edge. So the covered band is a scroll
 * margin (CodeMirror centres the caret plus its margins, which puts the caret
 * mid-way up the visible part), and the padding is measured on the visible
 * part, with the band added below so the last line can still rise to centre.
 */
const typewriterTheme = Prec.high(EditorView.theme({
  '.cm-content': {
    paddingTop: 'var(--tw-pad, 0px)',
    paddingBottom: 'var(--tw-pad-bottom, var(--tw-pad, 0px))',
  },
}))

/** How much of the scroller's foot the on-screen keyboard covers, in px. */
function keyboardBand(view: EditorView): number {
  const vv = window.visualViewport
  if (!vv) return 0
  const bottom = view.scrollDOM.getBoundingClientRect().bottom
  return Math.max(0, Math.round(bottom - (vv.offsetTop + vv.height)))
}

const clearOfKeyboard = EditorView.scrollMargins.of((view) => {
  const bottom = keyboardBand(view)
  return bottom > 0 ? { bottom } : null
})

/** A line block as typewriter remembers it: where it starts and how tall it is. */
export interface CaretBlock {
  from: number
  height: number
}

/**
 * Does typing need a re-centre? Only when the caret is in a different line
 * block than at the last centring, or the same block grew or shrank a row.
 */
export function caretBlockMoved(last: CaretBlock | null, now: CaretBlock): boolean {
  return !last || last.from !== now.from || last.height !== now.height
}

const keepCentered = ViewPlugin.fromClass(
  class {
    private frame = 0
    private padFrame = 0
    private pressed = false
    private dom: HTMLElement | null = null
    private view: EditorView
    /** The keyboard's band as the padding last measured it. */
    private band = 0
    /** The caret's line block when we last centred. */
    private block: CaretBlock | null = null
    // Only the primary button presses. A right-click opens WebKit's native
    // context menu, which swallows the release — counted as a press, it left
    // `pressed` true and typewriter silently off for the rest of the session.
    private onPointerDown = (e: PointerEvent) => { this.pressed = e.button === 0 }
    private onPointerRelease = () => { this.pressed = false }

    constructor(view: EditorView) {
      this.view = view
      this.syncPadding(view)
      this.schedule(view)
      if (view.scrollDOM.clientHeight === 0) {
        this.retryPadding(view)
      }
      this.dom = view.dom
      // Pointer, not mouse: a finger dragging to place the caret sent no
      // `mousedown` at all, so the guard below was dead on the iPad and every
      // step of the drag re-centred the page under the finger that was
      // dragging it.
      this.dom.addEventListener('pointerdown', this.onPointerDown)
      // Release is watched on the window, not on the editor. A press that ends
      // outside the editor — released over the sidebar, or cancelled when the
      // app goes to the background — emits no `pointerup` here, and the old
      // listener's `dragging` then stayed true for the rest of the session:
      // typewriter scrolling silently stopped working until the entry was
      // reopened.
      window.addEventListener('pointerup', this.onPointerRelease)
      window.addEventListener('pointercancel', this.onPointerRelease)
      window.addEventListener('blur', this.onPointerRelease)
      // The keyboard rising or falling changes no geometry CodeMirror sees, so
      // it would sit out of centre until the next keystroke. Only a change in
      // the band counts: a desktop window resizing is geometry, handled below.
      window.visualViewport?.addEventListener('resize', this.onViewport)
    }

    private onViewport = () => {
      const view = this.view
      if (keyboardBand(view) === this.band) return
      this.syncPadding(view)
      if (view.state.selection.main.empty && !this.pressed) this.schedule(view)
    }

    /** Has the caret's line block moved or changed height since we last centred? */
    private blockChanged(view: EditorView): boolean {
      const b = view.lineBlockAt(view.state.selection.main.head)
      return caretBlockMoved(this.block, { from: b.from, height: b.height })
    }

    update(update: ViewUpdate) {
      if (update.geometryChanged) {
        this.syncPadding(update.view)
        // A paragraph that wrapped onto a new row is only measured after the
        // keystroke that wrapped it, so its new height arrives as geometry.
        if (
          !update.docChanged &&
          !update.selectionSet &&
          this.block &&
          update.state.selection.main.empty &&
          !this.pressed &&
          this.blockChanged(update.view)
        ) {
          this.schedule(update.view)
        }
      }
      if (!update.docChanged && !update.selectionSet) return
      // Typewriter centres *the caret*. A range has no caret to centre, and
      // trying to centre one is how selecting text — with a finger on iOS,
      // where the drag happens in system UI that sends this plugin no pointer
      // events at all — scrolled the page away from the words being selected.
      if (!update.state.selection.main.empty) return
      // The press guard is for a caret being PLACED — a click or a drag must
      // not scroll the page out from under the pointer. Typing is never a
      // press, so a keystroke proves any press is over: that also heals a
      // release some native gesture (a system drag, a menu) never delivered.
      // Keystrokes only — a click that edits (a task box) is still a press.
      const typing = update.transactions.some((tr) => tr.isUserEvent('input') || tr.isUserEvent('delete'))
      if (typing) {
        this.pressed = false
      }
      if (this.pressed) return
      if (typing && !this.blockChanged(update.view)) return
      this.schedule(update.view)
    }

    private syncPadding(view: EditorView): boolean {
      const h = view.scrollDOM.clientHeight
      if (h <= 0) return false
      this.band = Math.min(keyboardBand(view), h)
      const pad = Math.round((h - this.band) * 0.45)
      const top = `${pad}px`
      const bottom = `${pad + this.band}px`
      const style = view.dom.style
      if (style.getPropertyValue('--tw-pad') !== top) style.setProperty('--tw-pad', top)
      if (style.getPropertyValue('--tw-pad-bottom') !== bottom) style.setProperty('--tw-pad-bottom', bottom)
      return true
    }

    private retryPadding(view: EditorView, attempt = 0) {
      if (attempt > 12) return
      cancelAnimationFrame(this.padFrame)
      this.padFrame = requestAnimationFrame(() => {
        if (this.syncPadding(view)) this.schedule(view)
        else this.retryPadding(view, attempt + 1)
      })
    }

    private schedule(view: EditorView) {
      cancelAnimationFrame(this.frame)
      this.frame = requestAnimationFrame(() => {
        const head = view.state.selection.main.head
        const b = view.lineBlockAt(head)
        this.block = { from: b.from, height: b.height }
        view.dispatch({ effects: EditorView.scrollIntoView(head, { y: 'center' }) })
      })
    }

    destroy() {
      cancelAnimationFrame(this.frame)
      cancelAnimationFrame(this.padFrame)
      this.dom?.removeEventListener('pointerdown', this.onPointerDown)
      window.removeEventListener('pointerup', this.onPointerRelease)
      window.removeEventListener('pointercancel', this.onPointerRelease)
      window.removeEventListener('blur', this.onPointerRelease)
      window.visualViewport?.removeEventListener('resize', this.onViewport)
    }
  },
)

/**
 * Marks the editor so page-level CSS can stand aside. The Pages hand-off sets
 * a fixed `padding-top` on `.cm-content` to line the first line up with the
 * reader's; outside CodeMirror's theme, it beat `--tw-pad`, and an entry opened
 * from Pages never centred in focus mode — the caret sat at the top.
 */
const typewriterMarker = EditorView.editorAttributes.of({ class: 'cm-typewriter' })

export const typewriterExtension: Extension = [typewriterTheme, typewriterMarker, keepCentered, clearOfKeyboard]
