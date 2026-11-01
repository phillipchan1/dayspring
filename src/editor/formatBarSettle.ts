/**
 * When the selection format bar may show (DESIGN_PRINCIPLES N4).
 *
 * The bar used to chase the selection: it appeared mid-drag, re-anchored on
 * every ⇧→, sprang up for ⌘A, and joined the native menu on a right-click.
 * A Mac or iOS edit menu waits for the selection to SETTLE:
 *
 *  - a pointer selection settles when the pointer lifts;
 *  - a keyboard (or touch-handle) selection settles ~350ms after its last
 *    change, so holding ⇧→ never strobes the bar;
 *  - while a pointer is down the bar is hidden;
 *  - select-all from the keyboard never raises it;
 *  - a right-click belongs to the native context menu alone;
 *  - Esc puts the bar away and keeps the selection, until the selection
 *    changes again.
 *
 * Summoned at the caret (⌘⇧F) it is not a selection bar and shows at once.
 *
 * This is view-side bookkeeping only — booleans and one timer, fed by the
 * editor's update listener and its pointer events. It never reads the
 * document; `read` asks the view for three facts about the main selection.
 */

/** What the editor reports about one update. */
export interface SettleUpdate {
  /** A selection gesture made this change (CodeMirror's `select` user event). */
  userSelect: boolean
  /** …and it was a pointer's (`select.pointer`). */
  pointerSelect: boolean
  /** The editor just gained focus. */
  focusGained: boolean
}

/** The live selection, read when the bar decides. */
export interface SelectionFacts {
  empty: boolean
  /** The whole document is selected. */
  wholeDoc: boolean
  /** The bar is pinned at the caret (⌘⇧F). */
  caret: boolean
}

export interface Timers {
  set: (fn: () => void, ms: number) => unknown
  clear: (handle: unknown) => void
}

/** How long a keyboard selection must sit still before the bar comes up. */
export const SETTLE_MS = 350

const defaultTimers: Timers = {
  set: (fn, ms) => window.setTimeout(fn, ms),
  clear: (h) => window.clearTimeout(h as number),
}

export class FormatBarSettle {
  private shown = false
  private pointerDown = false
  private touchPress = false
  private contextSuppressed = false
  private escSuppressed = false
  private wholeDocByKeys = false
  private timer: unknown = null

  constructor(
    private readonly read: () => SelectionFacts,
    private readonly onShow: () => void,
    private readonly onHide: () => void,
    private readonly delay = SETTLE_MS,
    private readonly timers: Timers = defaultTimers,
  ) {}

  get isShown(): boolean {
    return this.shown
  }

  /** Every editor update that touched the selection, the doc, or focus. */
  update(u: SettleUpdate): void {
    const facts = this.read()
    if (facts.empty && !facts.caret) {
      this.cancel()
      this.escSuppressed = false
      this.wholeDocByKeys = false
      this.hide()
      return
    }
    if (facts.caret) {
      this.cancel()
      this.show()
      return
    }
    if (u.userSelect) {
      // A new selection: whatever put the last one's bar away is spent.
      this.escSuppressed = false
      this.wholeDocByKeys = facts.wholeDoc && !u.pointerSelect
      if (this.pointerDown) {
        this.cancel()
        this.hide()
        return
      }
      if (u.pointerSelect) {
        // The pointer is already up: this is CodeMirror's final word on a
        // drag or a double-click. Settled.
        this.cancel()
        this.settle()
        return
      }
      this.cancel()
      this.hide()
      this.timer = this.timers.set(() => {
        this.timer = null
        this.settle()
      }, this.delay)
      return
    }
    if (this.shown) {
      // A change the bar itself made (bold, a colour), or the doc moving under
      // it: follow the selection where it went, without hiding.
      this.show()
      return
    }
    if (u.focusGained && this.timer == null) {
      this.timer = this.timers.set(() => {
        this.timer = null
        this.settle()
      }, this.delay)
    }
  }

  /**
   * A press in the editor. Secondary = right button or ⌃-click.
   *
   * `held` gates the bar on the release — right for a mouse or a pen. A finger
   * is different: WebKit takes a long-press over for text selection and may
   * never send its release, so a touch hides the bar and leaves the rest to
   * the settle delay, which handle drags keep resetting.
   */
  pressed(primary: boolean, held = true): void {
    this.cancel()
    if (!primary) {
      this.contextSuppressed = true
      this.hide()
      return
    }
    this.contextSuppressed = false
    this.escSuppressed = false
    this.pointerDown = held
    this.touchPress = !held
    this.hide()
  }

  /** The press ended (anywhere). Settle once CodeMirror's own mouseup has run. */
  released(): void {
    if (this.pointerDown) {
      this.pointerDown = false
      this.cancel()
      this.timer = this.timers.set(() => {
        this.timer = null
        this.settle()
      }, 0)
      return
    }
    if (this.touchPress) {
      this.touchPress = false
      if (this.timer == null) {
        this.timer = this.timers.set(() => {
          this.timer = null
          this.settle()
        }, this.delay)
      }
    }
  }

  /** The native context menu is opening: it, alone. */
  contextMenu(): void {
    this.cancel()
    this.contextSuppressed = true
    this.hide()
  }

  /** A key went down in the editor: a right-click's hold on the bar is over. */
  key(): void {
    this.contextSuppressed = false
  }

  /** Esc, or an action that is done with the bar. Keeps the selection. */
  dismiss(): void {
    this.cancel()
    this.escSuppressed = true
    this.hide()
  }

  /** The editor scrolled or resized: re-anchor a bar that is up. */
  refresh(): void {
    if (this.shown) this.onShow()
  }

  destroy(): void {
    this.cancel()
  }

  private settle(): void {
    if (this.pointerDown || this.contextSuppressed || this.escSuppressed) return
    const facts = this.read()
    if (facts.caret) {
      this.show()
      return
    }
    if (facts.empty || this.wholeDocByKeys) {
      this.hide()
      return
    }
    this.show()
  }

  private show(): void {
    this.shown = true
    this.onShow()
  }

  private hide(): void {
    if (!this.shown) return
    this.shown = false
    this.onHide()
  }

  private cancel(): void {
    if (this.timer == null) return
    this.timers.clear(this.timer)
    this.timer = null
  }
}
