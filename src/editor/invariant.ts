import type { Extension } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'

/**
 * The editor's invariant, checked in development after every change.
 *
 * CodeMirror's state is the one source of truth for the text and the caret;
 * the DOM is a picture of it. Every caret bug this editor has had was the
 * picture and the truth disagreeing without anyone noticing — most recently an
 * iPad tap the view never took (journalView.ts), after which Backspace deleted
 * text far from where the writer was looking. So in development we look:
 *
 *  · **text** — every rendered line that is plain text reads, in the DOM,
 *    exactly what the document holds for that line;
 *  · **selection** — when the editor has focus, the DOM's caret maps to the
 *    state's selection;
 *  · **tap** — a tap that placed a caret put CodeMirror's caret on the line
 *    under the finger. This is the one that catches a dropped tap: when the
 *    view throws a tap away it also writes its old caret back over the DOM, so
 *    the first two checks agree with each other and are both wrong.
 *
 * A mismatch is logged with `console.error` and recorded on
 * `window.__editorInvariant`, which the browser suite (e2e/) asserts is empty.
 * Never shipped: Editor.tsx installs this only when `import.meta.env.DEV`.
 */

export type InvariantKind = 'text' | 'selection' | 'tap'

export interface InvariantViolation {
  kind: InvariantKind
  message: string
  /** Doc positions or line numbers involved — whatever makes the log useful. */
  detail: Record<string, unknown>
}

interface InvariantGlobal {
  violations: InvariantViolation[]
  /** Run the text + selection checks now, for tests driving the editor. */
  check: () => InvariantViolation[]
}

declare global {
  interface Window {
    __editorInvariant?: InvariantGlobal
  }
}

/** Lines whose DOM is not just their text: widgets, concealed markup, placeholders. */
function hasWidget(line: Element): boolean {
  return line.querySelector('[contenteditable="false"]') !== null
}

function lineElementAt(view: EditorView, pos: number): Element | null {
  const { node } = view.domAtPos(pos)
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  return el?.closest('.cm-line') ?? null
}

/** DOM text of every plain rendered line equals the document's line. */
export function checkText(view: EditorView): InvariantViolation[] {
  if (view.composing) return []
  const out: InvariantViolation[] = []
  const { doc } = view.state
  const { from, to } = view.viewport
  for (let pos = from; pos <= to; ) {
    const line = doc.lineAt(pos)
    const el = lineElementAt(view, line.from)
    if (el && view.contentDOM.contains(el) && !hasWidget(el)) {
      const dom = el.textContent ?? ''
      if (dom !== line.text) {
        out.push({
          kind: 'text',
          message: `line ${line.number} reads differently in the DOM than in the document`,
          detail: { line: line.number, doc: line.text, dom },
        })
      }
    }
    pos = line.to + 1
  }
  return out
}

function domPos(view: EditorView, node: Node | null, offset: number): number | null {
  if (!node || !view.contentDOM.contains(node)) return null
  try {
    return view.posAtDOM(node, offset)
  } catch {
    return null
  }
}

/** Same DOM point, or a DOM point that maps to the same document position. */
function agrees(view: EditorView, pos: number, node: Node, offset: number): boolean {
  if (domPos(view, node, offset) === pos) return true
  const at = view.domAtPos(pos)
  return at.node === node && at.offset === offset
}

/** With focus, the DOM caret is where the state says it is. */
export function checkSelection(view: EditorView): InvariantViolation[] {
  if (view.composing || !view.hasFocus) return []
  const sel = view.contentDOM.ownerDocument.getSelection()
  if (!sel?.anchorNode || !sel.focusNode) return []
  if (!view.contentDOM.contains(sel.anchorNode) || !view.contentDOM.contains(sel.focusNode)) return []
  const main = view.state.selection.main
  if (agrees(view, main.anchor, sel.anchorNode, sel.anchorOffset) && agrees(view, main.head, sel.focusNode, sel.focusOffset)) {
    return []
  }
  return [
    {
      kind: 'selection',
      message: "the DOM's caret is not where the editor's selection is",
      detail: {
        state: { anchor: main.anchor, head: main.head },
        dom: {
          anchor: domPos(view, sel.anchorNode, sel.anchorOffset),
          head: domPos(view, sel.focusNode, sel.focusOffset),
        },
      },
    },
  ]
}

export function checkEditorInvariant(view: EditorView): InvariantViolation[] {
  return [...checkText(view), ...checkSelection(view)]
}

function report(found: InvariantViolation[]) {
  if (found.length === 0) return
  const store = window.__editorInvariant
  for (const v of found) {
    store?.violations.push(v)
    console.error(`[editor invariant] ${v.kind}: ${v.message}`, v.detail)
  }
}

/** Movement (px) past which a press was a drag, not a tap. */
const TAP_SLOP = 10
/**
 * The longest a tap's caret may take to arrive. iOS places it on its own
 * schedule — later still for the tap that raises the keyboard — and CodeMirror
 * adopts it from `selectionchange` after that.
 */
const TAP_SETTLE_MS = 400

/**
 * Watches taps; the checks after each change are the listener below.
 *
 * A tap is judged at the writer's next act — the next key or press — or after
 * `TAP_SETTLE_MS`, whichever comes first. The next key is the moment it
 * matters: that is when a caret the view never took starts deleting in the
 * wrong place. An edit or a programmatic caret move in between makes the
 * question moot, and drops it.
 */
// Pure, so a production build — which never calls editorInvariant() — drops
// this module entirely.
const invariantPlugin = /* @__PURE__ */ ViewPlugin.fromClass(
  class {
    private press: { x: number; y: number; id: number; claimed: boolean } | null = null
    private pending: { x: number; y: number } | null = null
    private timer = 0

    // Presses in the bubble phase on the outer element, so CodeMirror's own
    // handlers on the content have run and a press they claimed shows as
    // `defaultPrevented`. Keys in the capture phase, so the tap is judged
    // before CodeMirror acts on the key.
    constructor(private readonly view: EditorView) {
      view.dom.addEventListener('pointerdown', this.onDown)
      view.dom.addEventListener('pointerup', this.onUp)
      view.dom.addEventListener('pointercancel', this.onCancel)
      view.dom.addEventListener('keydown', this.settle, true)
    }

    update(update: ViewUpdate) {
      if (!this.pending) return
      const moot =
        update.docChanged || update.transactions.some((tr) => tr.selection && !tr.isUserEvent('select'))
      if (moot) this.drop()
    }

    private onDown = (e: PointerEvent) => {
      this.settle()
      this.press = { x: e.clientX, y: e.clientY, id: e.pointerId, claimed: e.defaultPrevented }
    }

    private onCancel = () => {
      this.press = null
    }

    private onUp = (e: PointerEvent) => {
      const press = this.press
      this.press = null
      if (!press || press.id !== e.pointerId) return
      if (Math.abs(e.clientX - press.x) > TAP_SLOP || Math.abs(e.clientY - press.y) > TAP_SLOP) return
      // A press something on the page claimed (a block, a photo, the `+`) is
      // not a caret placement, and must not move the caret.
      if (press.claimed || e.defaultPrevented) return
      this.drop()
      this.pending = { x: e.clientX, y: e.clientY }
      this.timer = window.setTimeout(this.settle, TAP_SETTLE_MS)
    }

    private drop() {
      window.clearTimeout(this.timer)
      this.pending = null
    }

    private settle = () => {
      const at = this.pending
      this.drop()
      if (at) this.checkTap(at)
    }

    private checkTap(at: { x: number; y: number }) {
      const { view } = this
      if (!view.hasFocus) return
      const main = view.state.selection.main
      // A double tap or a long press selects; that is the system's gesture.
      if (!main.empty) return
      const target = view.posAtCoords(at)
      if (target === null) return
      const { doc } = view.state
      const want = doc.lineAt(target).number
      const got = doc.lineAt(main.head).number
      if (want === got) return
      report([
        {
          kind: 'tap',
          message: `a tap on line ${want} left the editor's caret on line ${got}`,
          detail: { tapLine: want, caretLine: got, caret: main.head, tapPos: target },
        },
      ])
    }

    destroy() {
      this.drop()
      this.view.dom.removeEventListener('pointerdown', this.onDown)
      this.view.dom.removeEventListener('pointerup', this.onUp)
      this.view.dom.removeEventListener('pointercancel', this.onCancel)
      this.view.dom.removeEventListener('keydown', this.settle, true)
    }
  },
)

/** The dev-only invariant: checks after every change, logs loudly on a mismatch. */
export function editorInvariant(): Extension {
  if (typeof window !== 'undefined' && !window.__editorInvariant) {
    window.__editorInvariant = {
      violations: [],
      check: () => {
        const el = document.querySelector('.cm-editor')
        const view = el ? EditorView.findFromDOM(el as HTMLElement) : null
        if (!view) return []
        const found = checkEditorInvariant(view)
        report(found)
        return found
      },
    }
  }
  return [
    invariantPlugin,
    // A listener, not the plugin's `update`: plugins update BEFORE CodeMirror
    // syncs the DOM and writes the selection, listeners after — and the DOM is
    // what is being checked.
    EditorView.updateListener.of((update: ViewUpdate) => {
      if (!update.docChanged && !update.selectionSet && !update.focusChanged && !update.viewportChanged) return
      report(checkEditorInvariant(update.view))
    }),
  ]
}
