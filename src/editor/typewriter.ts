import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

/**
 * Typewriter scrolling: keep the line with the cursor vertically centered.
 *
 * We add top/bottom padding equal to ~45% of the *measured* editor height (not
 * `vh`, which is unreliable with the mobile keyboard) so the first/last lines
 * can still reach the middle, then re-center on every doc/selection change.
 * The padding is driven by a CSS variable the plugin keeps in sync.
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

    constructor(view: EditorView) {
      this.syncPadding(view)
      this.schedule(view)
    }

    update(update: ViewUpdate) {
      if (update.geometryChanged) this.syncPadding(update.view)
      if (update.docChanged || update.selectionSet || update.geometryChanged) {
        this.schedule(update.view)
      }
    }

    // Measure the editor height and set the centering padding. If layout isn't
    // ready yet (height 0), retry next frame until it is.
    private syncPadding(view: EditorView) {
      const h = view.scrollDOM.clientHeight
      if (h > 0) {
        view.dom.style.setProperty('--tw-pad', `${Math.round(h * 0.45)}px`)
      } else {
        cancelAnimationFrame(this.padFrame)
        this.padFrame = requestAnimationFrame(() => this.syncPadding(view))
      }
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
    }
  },
)

export const typewriterExtension: Extension = [typewriterTheme, keepCentered]
