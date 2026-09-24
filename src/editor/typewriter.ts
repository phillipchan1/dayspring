import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { Prec, type Extension } from '@codemirror/state'

/**
 * Typewriter scrolling: keep the line with the cursor vertically centered.
 *
 * Padding is synced when the viewport height changes; scrolling runs only on
 * doc/selection changes — never on geometryChanged alone (that caused a CM
 * measure loop when padding + scrollIntoView fed each other).
 *
 * The theme is `Prec.high`: CodeMirror ranks themes by extension precedence,
 * EARLIER wins, so registered after `editorTheme` (as the compartment is) the
 * base `paddingBottom: 40vh` beat `--tw-pad` and the caret on the last lines
 * of an entry — where writing happens — settled below centre.
 */
const typewriterTheme = Prec.high(EditorView.theme({
  '.cm-content': {
    paddingTop: 'var(--tw-pad, 0px)',
    paddingBottom: 'var(--tw-pad, 0px)',
  },
}))

const keepCentered = ViewPlugin.fromClass(
  class {
    private frame = 0
    private padFrame = 0
    private pressed = false
    private dom: HTMLElement | null = null
    // Only the primary button presses. A right-click opens WebKit's native
    // context menu, which swallows the release — counted as a press, it left
    // `pressed` true and typewriter silently off for the rest of the session.
    private onPointerDown = (e: PointerEvent) => { this.pressed = e.button === 0 }
    private onPointerRelease = () => { this.pressed = false }

    constructor(view: EditorView) {
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
    }

    update(update: ViewUpdate) {
      if (update.geometryChanged) {
        this.syncPadding(update.view)
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
      if (update.transactions.some((tr) => tr.isUserEvent('input') || tr.isUserEvent('delete'))) {
        this.pressed = false
      }
      if (this.pressed) return
      this.schedule(update.view)
    }

    private syncPadding(view: EditorView): boolean {
      const h = view.scrollDOM.clientHeight
      if (h <= 0) return false
      const next = `${Math.round(h * 0.45)}px`
      const current = view.dom.style.getPropertyValue('--tw-pad')
      if (current === next) return true
      view.dom.style.setProperty('--tw-pad', next)
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
    }
  },
)

export const typewriterExtension: Extension = [typewriterTheme, keepCentered]
