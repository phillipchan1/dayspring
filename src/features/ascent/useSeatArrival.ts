import { useLayoutEffect, type RefObject } from 'react'
import type { AscentSeat } from '@/lib/appHistory'

/** How long a page may take to grow tall enough before we settle for the nearest spot. */
const GIVE_UP_MS = 2500
/** How long the page must hold still before the arrival is over. */
const QUIET_MS = 400
/** How long the thing you opened keeps its mark. */
const MARK_MS = 1800

/**
 * Whether a scroller has grown far enough to stand where the reader stood.
 * The Ascent's months and seasons read their ledger after mount, so on the way
 * back the page is first a loader and only later the height it was.
 */
export function canStandAt(top: number, scrollHeight: number, clientHeight: number): boolean {
  // The top of a page is always standable, even one shorter than its window.
  return top <= 0 || scrollHeight - clientHeight >= top
}

/**
 * ARRIVING BACK. Put the reader where they stood, and show them what they opened.
 *
 * Coming back to the right period on the wrong part of the page is nearly as
 * lost as coming back to the wrong period: October, but from the top, and
 * nothing to say which of forty lines you had just read. So on the way back:
 *
 *  1. stand where they stood — and KEEP standing there while the page settles.
 *     It does not arrive whole: a month shows its loader, then its lines, then
 *     its photos, and in between it can be SHORTER than it was, which makes the
 *     browser clamp the scroll to the top. So the position is re-asserted on
 *     every change to the page until it has been still for a moment, and given
 *     up for good the instant they touch it;
 *  2. find the control they pressed (`data-entry-id`, the `nth` of them — a page
 *     can offer one entry twice), keep it in view, give it keyboard focus (so Tab
 *     carries on from there, and Esc has put a ring on it), and mark it with
 *     `data-returned` for a moment.
 *
 * The seat is read once, on arrival. It stays on the frame — a reload restores
 * it too — but only a mount is an arrival.
 *
 * A LAYOUT effect, and a MutationObserver rather than a timer: when the page is
 * already tall enough the scroll is set before the first paint, and when it grows
 * the scroll follows in the same task as the content. After paint, the reader
 * sees the top of the page for a frame and then watches it jump.
 */
export function useSeatArrival(scroller: RefObject<HTMLElement | null>, seat: AscentSeat | null): void {
  useLayoutEffect(() => {
    const box = scroller.current
    if (!seat || !box) return

    // Where we are holding the page: the seat, until bringing the control into
    // view has to move it.
    let goal = seat.top
    let marked = false
    let stopped = false
    let markTimer = 0
    let quietTimer = 0

    const mark = (target: HTMLElement) => {
      const at = target.getBoundingClientRect()
      const within = box.getBoundingClientRect()
      // A page that came back a different height can leave it off-screen.
      if (at.top < within.top + 8 || at.bottom > within.bottom - 8) {
        target.scrollIntoView({ block: 'center' })
        goal = box.scrollTop
      }
      target.focus({ preventScroll: true })
      target.setAttribute('data-returned', '')
      markTimer = window.setTimeout(() => target.removeAttribute('data-returned'), MARK_MS)
    }

    const attempt = (lastCall = false) => {
      if (stopped) return
      if (!marked && canStandAt(goal, box.scrollHeight, box.clientHeight) && Math.abs(box.scrollTop - goal) > 1) {
        box.scrollTop = goal
      }
      const there = Math.abs(box.scrollTop - goal) <= 1
      if (there && !marked && seat.entryId) {
        const found = box.querySelectorAll<HTMLElement>(`[data-entry-id="${CSS.escape(seat.entryId)}"]`)
        // The one they pressed. If it is not there yet, the page is still arriving
        // (a month's photos load after its lines) — wait for it. Only at the last
        // call settle for another control that opens the same entry.
        const target = found[seat.nth] ?? (lastCall ? found[0] : undefined)
        if (target) {
          mark(target)
          marked = true
        }
      }
      // Over when they are where they stood, the thing is found, and the page has
      // stopped changing — not before, or a late section would push it out again.
      window.clearTimeout(quietTimer)
      if (there && (marked || !seat.entryId)) quietTimer = window.setTimeout(stop, QUIET_MS)
    }

    // The page has been touched: it is theirs now, and a late scroll would fight them.
    const touched = () => stop()
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

    // The content grows by being added to — the observed box itself does not
    // change size (it fills the scroller), so a ResizeObserver never hears of it.
    const changes = new MutationObserver(() => attempt())
    changes.observe(box, { childList: true, subtree: true })
    for (const name of events) window.addEventListener(name, touched, { capture: true, passive: true })

    const giveUp = window.setTimeout(() => {
      // Never got tall enough: the nearest spot beats staying at the top.
      if (!canStandAt(goal, box.scrollHeight, box.clientHeight)) goal = Math.max(0, box.scrollHeight - box.clientHeight)
      attempt(true)
      stop()
    }, GIVE_UP_MS)

    function stop() {
      stopped = true
      changes.disconnect()
      window.clearTimeout(giveUp)
      window.clearTimeout(quietTimer)
      for (const name of events) window.removeEventListener(name, touched, { capture: true })
    }

    attempt()
    return () => {
      stop()
      window.clearTimeout(markTimer)
    }
    // Arrival is once per mount; the seat it arrived with is the one it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
