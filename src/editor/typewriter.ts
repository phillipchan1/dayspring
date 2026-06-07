import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

/**
 * Typewriter scrolling: keep the line with the cursor vertically centered.
 *
 * Padding is synced when the viewport height changes; scrolling runs only on
 * doc/selection changes — never on geometryChanged alone (that caused a CM
 * measure loop when padding + scrollIntoView fed each other).
 */
const typewriterTheme = EditorView.theme({
  '.cm-content': {
    paddingTop: 'var(--tw-pad, 0px)',
    paddingBottom: 'var(--tw-pad, 0px)',
  },
})

const keepCentered = ViewPlugin.fromClass(
  class {
    private frame = 0
    private padFrame = 0
    private dragging = false
    private dom: HTMLElement | null = null
    private onMouseDown = () => { this.dragging = true }
    private onMouseUp = () => { this.dragging = false }

    constructor(view: EditorView) {
      this.syncPadding(view)
      this.schedule(view)
      if (view.scrollDOM.clientHeight === 0) {
        this.retryPadding(view)
      }
      this.dom = view.dom
      this.dom.addEventListener('mousedown', this.onMouseDown)
      this.dom.addEventListener('mouseup', this.onMouseUp)
    }

    update(update: ViewUpdate) {
      if (update.geometryChanged) {
        this.syncPadding(update.view)
      }
      if ((update.docChanged || update.selectionSet) && !this.dragging) {
        this.schedule(update.view)
      }
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
      this.dom?.removeEventListener('mousedown', this.onMouseDown)
      this.dom?.removeEventListener('mouseup', this.onMouseUp)
    }
  },
)

export const typewriterExtension: Extension = [typewriterTheme, keepCentered]
