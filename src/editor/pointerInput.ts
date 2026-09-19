import { EditorView } from '@codemirror/view'
import { Prec, type Extension } from '@codemirror/state'

/**
 * One input model for everything you can press in the editor.
 *
 * ## Why this exists
 *
 * Every interactive thing on the writing surface — the `+` in the gutter, a
 * marked line, a scripture block, a task checkbox — used to be bound to
 * `mousedown`. That is a fair description of a trackpad and a lie about a
 * finger.
 *
 * WKWebView does not deliver a touch as a mouse press. It delivers
 * `pointer*`/`touch*` immediately, decides what the gesture meant, and only
 * then — if it concluded "click" — **replays** it as a compatibility burst of
 * `mousemove` → `mousedown` → `mouseup` → `click`, roughly 300ms later. Three
 * consequences, all of which are bugs someone can feel while writing:
 *
 *  1. **Latency.** The tap is acknowledged a third of a second after the
 *     finger left the glass. On a checkbox that reads as "it didn't take".
 *  2. **Taps that never arrive.** If WebKit decided the gesture was a scroll,
 *     a selection, a long-press, or a caret placement, the replay never comes
 *     and the handler never runs. Tapping a marking twice before it opens is
 *     this.
 *  3. **Taps that arrive twice.** Anything that *did* run off the real touch
 *     gets run again by the replay — against a document the first run may have
 *     already changed.
 *
 * The scattered fixes for this (ghost-click timers, `touchstart`/`touchend`
 * pairing, `pointer: coarse` media queries, UA sniffing) are all the same
 * workaround wearing different clothes.
 *
 * ## The rule
 *
 * **Ask the event what pressed it, not the device what it is.**
 *
 * `PointerEvent.pointerType` is correct per-gesture and always available.
 * `(pointer: coarse)` and the UA are device *capability* questions, and they
 * get iPad wrong in both directions: an iPad with a Magic Keyboard reports
 * `fine` while its owner is still writing with a finger, and Chrome's device
 * mode reports `fine` while pretending to be a phone. A `pointerType` of
 * `'touch'` is a finger — on any device, in any mode, every time.
 *
 * So: pointer events are the input layer; mouse events exist only to be
 * ignored when they are the replay of a touch we already served.
 */

/** Movement (px) past which a press is a drag — a scroll, or a selection. */
export const TAP_SLOP = 10

/**
 * A press held longer than this belongs to the system, not to us: it is the
 * gesture for the magnifier, the selection callout, and drag-to-select. Ours
 * is a tap, and a tap is short.
 */
export const TAP_HOLD_MS = 500

/** How long after a served touch its compatibility replay is still expected. */
const REPLAY_WINDOW_MS = 700

/** The replay lands within a few px of the touch that produced it. */
const REPLAY_SLOP = 24

export interface TapContext {
  /**
   * What pressed: `'mouse'`, `'touch'`, or `'pen'`.
   *
   * Only `'mouse'` can hover, which is the test to use for anything revealed
   * by hovering — a control nothing can show you is a control nobody can find.
   */
  pointerType: string
  clientX: number
  clientY: number
  target: EventTarget | null
  /** The pointer event itself, for handlers needing more than the above. */
  event: PointerEvent
}

export interface TapSpec {
  /**
   * Cheap test, run on press: is this gesture ours?
   *
   * Keep it to a `closest()` or a coordinate compare — it runs on every press
   * anywhere in the editor, including the first press of a scroll.
   *
   * A `true` here calls `preventDefault()` on the press, which is the only
   * moment that still stops WebKit starting a native drag, raising the
   * selection callout, or moving the caret. It also suppresses the
   * compatibility replay at the source.
   */
  claims: (ctx: TapContext, view: EditorView) => boolean
  /**
   * Act on the completed tap. Return true when it was consumed.
   *
   * Runs on press for a mouse (no replay to wait for, and pressing is what a
   * mouse means) and on release for a finger or a pen, once the gesture has
   * proved to be a tap and not a scroll, a hold, or a selection drag.
   */
  onTap: (ctx: TapContext, view: EditorView) => boolean
}

function contextOf(event: PointerEvent): TapContext {
  return {
    pointerType: event.pointerType || 'mouse',
    clientX: event.clientX,
    clientY: event.clientY,
    target: event.target,
    event,
  }
}

function near(ax: number, ay: number, bx: number, by: number, slop: number): boolean {
  return Math.abs(ax - bx) <= slop && Math.abs(ay - by) <= slop
}

/**
 * Bind a press-target in the editor to a single tap, from any pointer.
 *
 * Registered at `Prec.highest` so the claim lands before CodeMirror's own
 * mouse handling gets to move the caret or start a selection.
 */
export function editorTap(spec: TapSpec, now: () => number = Date.now): Extension {
  /** The live press, once claimed. Null between gestures and after a drag. */
  let press: { id: number; x: number; y: number; at: number } | null = null
  /** A touch we served, whose compatibility replay is still to come. */
  let served: { x: number; y: number; at: number } | null = null

  const isReplay = (event: MouseEvent): boolean => {
    if (!served) return false
    if (now() - served.at > REPLAY_WINDOW_MS) {
      served = null
      return false
    }
    return near(event.clientX, event.clientY, served.x, served.y, REPLAY_SLOP)
  }

  return Prec.highest(
    EditorView.domEventHandlers({
      pointerdown(event, view) {
        press = null
        served = null
        // A mouse's secondary buttons are the context menu's gesture, which is
        // handled where context menus are handled.
        if (event.pointerType === 'mouse' && event.button !== 0) return false

        const ctx = contextOf(event)
        if (!spec.claims(ctx, view)) return false

        // Claimed: stop the native gesture before it can begin.
        event.preventDefault()

        if (ctx.pointerType === 'mouse') return spec.onTap(ctx, view)

        press = { id: event.pointerId, x: event.clientX, y: event.clientY, at: now() }
        return true
      },

      pointermove(event) {
        if (!press || press.id !== event.pointerId) return false
        // Moved: this is a scroll or a drag, and a drag is not a tap.
        if (!near(event.clientX, event.clientY, press.x, press.y, TAP_SLOP)) press = null
        return false
      },

      pointerup(event, view) {
        const start = press
        press = null
        if (!start || start.id !== event.pointerId) return false
        if (now() - start.at > TAP_HOLD_MS) return false
        if (!near(event.clientX, event.clientY, start.x, start.y, TAP_SLOP)) return false

        const ctx = contextOf(event)
        if (!spec.onTap(ctx, view)) return false

        event.preventDefault()
        served = { x: event.clientX, y: event.clientY, at: now() }
        return true
      },

      // The finger left for a reason that was not a tap — the system claimed
      // the gesture, or the app went to the background mid-press. Either way
      // there is no tap here, and nothing to leave behind.
      pointercancel() {
        press = null
        return false
      },

      // What remains of the compatibility burst for a touch we already served.
      // `preventDefault` on the press suppresses it in WebKit, but Chromium and
      // older WebKits still replay some of it, and a second firing would run
      // against a document the first firing may have changed.
      mousedown(event) {
        return isReplay(event)
      },
      mouseup(event) {
        return isReplay(event)
      },
      click(event) {
        if (!isReplay(event)) return false
        served = null
        return true
      },
    }),
  )
}
