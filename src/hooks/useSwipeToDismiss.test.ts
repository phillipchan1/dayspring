import { describe, expect, it } from 'vitest'
import {
  axisOf,
  commits,
  isSwipeNotPress,
  locksToScroll,
  LONG_PRESS_MS,
  POINT_OF_NO_RETURN,
  speedAtRelease,
  STILL_MS,
} from './useSwipeToDismiss'

/** What the reader is configured with — the number these rules are tuned to. */
const THRESHOLD = 72

describe('axisOf', () => {
  it('says nothing until the gesture has travelled far enough to mean something', () => {
    expect(axisOf(0, 0)).toBe(null)
    expect(axisOf(6, 5)).toBe(null)
    // A tap with a wobble in it is not a swipe.
    expect(axisOf(-7, 3)).toBe(null)
  })

  it('takes a clearly sideways drag', () => {
    expect(axisOf(40, 4)).toBe('h')
    expect(axisOf(-40, 4)).toBe('h')
  })

  it('leaves a scroll alone', () => {
    expect(axisOf(3, 40)).toBe('v')
    expect(axisOf(0, -40)).toBe('v')
  })

  /*
   * The one that matters, and the one the old rule got wrong.
   *
   * A thumb running down a long page is never exactly vertical. At `|dx| > |dy|`
   * a 46° drag counted as a dismissal, so the reader fell off the screen while
   * somebody was scrolling it. Sideways has to be MEANT.
   */
  it('leaves a drifting scroll alone rather than reading it as a dismissal', () => {
    expect(axisOf(30, 28)).toBe('v')
    expect(axisOf(41, 40)).toBe('v')
    expect(axisOf(60, 50)).toBe('v')
  })

  it('still takes a drag that is sideways past any doubt', () => {
    expect(axisOf(60, 30)).toBe('h')
  })
})

describe('commits', () => {
  const at = (dx: number, speed: number) => commits({ dx, speed, threshold: THRESHOLD })

  it('takes a deliberate drag past the threshold, standing still', () => {
    expect(at(80, 0)).toBe(true)
    expect(at(71, 0)).toBe(false)
  })

  /*
   * The rule that was dead.
   *
   * Distance alone meant a flick fast enough to be unmistakable did nothing,
   * while a slow crawl 20px further dismissed — the hand and the screen
   * disagreeing about what just happened, which is the whole of "janky".
   */
  it('takes a fling that never reached the threshold', () => {
    // 40px, still travelling at 800px/s: projects well past it.
    expect(at(40, 0.8)).toBe(true)
  })

  /*
   * And the reason it is projection rather than "far enough OR fast enough".
   *
   * The two-rule version needs a floor on its fast branch, and every floor is
   * wrong somewhere: at `speed > 0.4 && dx > 12` a 13px nudge at an ordinary
   * drag speed threw away the page. Coupling the two means a short gesture has
   * to be genuinely quick to count.
   */
  it('does not take a short nudge at an ordinary drag speed', () => {
    expect(at(13, 0.5)).toBe(false)
    expect(at(20, 0.3)).toBe(false)
  })

  it('does not take a slow drag that stopped short', () => {
    expect(at(60, 0.05)).toBe(false)
    expect(at(40, 0.1)).toBe(false)
  })

  /*
   * Leftward is never a dismissal. The surface came in from the right and goes
   * back out to the right; dragging it further left is pushing it into an edge
   * it is already against, however hard.
   */
  it('never leaves to the left, at any distance or speed', () => {
    expect(at(-200, 0)).toBe(false)
    expect(at(-40, -3)).toBe(false)
    // Including a leftward pull that whips back rightward as the finger lifts,
    // which the projection on its own would happily take.
    expect(at(-5, 3)).toBe(false)
  })
})

/**
 * ── The rules that make an indecisive hand work ────────────────────────────
 *
 * What a thumb actually does on a phone is drag, hesitate, drift back, and then
 * decide. Every rule below exists because the first version punished exactly
 * that and answered only to one clean committed swipe.
 */

describe('locksToScroll', () => {
  it('leaves an ambiguous start open to being reconsidered', () => {
    // A thumb setting off down-and-right has not decided anything yet.
    expect(locksToScroll(0)).toBe(false)
    expect(locksToScroll(12)).toBe(false)
    expect(locksToScroll(-20)).toBe(false)
  })

  it('locks once the page has genuinely moved under the finger', () => {
    expect(locksToScroll(32)).toBe(true)
    expect(locksToScroll(-90)).toBe(true)
  })
})

describe('speedAtRelease', () => {
  it('keeps the speed of a finger that was still moving', () => {
    expect(speedAtRelease(0.8, 0)).toBe(0.8)
    expect(speedAtRelease(0.8, STILL_MS)).toBe(0.8)
  })

  /*
   * Drag a view out, stop, look at what is underneath, decide against it, lift.
   * `speed` is only ever written by a move, so without this the gesture flings
   * from a standstill on whatever it was doing before it stopped.
   */
  it('treats a finger that has been resting as not travelling', () => {
    expect(speedAtRelease(0.8, STILL_MS + 1)).toBe(0)
    expect(speedAtRelease(2, 400)).toBe(0)
  })
})

describe('isSwipeNotPress', () => {
  it('takes a drag that began as one motion from touchdown', () => {
    expect(isSwipeNotPress(0)).toBe(true)
    expect(isSwipeNotPress(LONG_PRESS_MS)).toBe(true)
  })

  /*
   * This is what buys the gesture the whole writing surface instead of a strip
   * at the screen edge: iOS puts the caret loupe and the selection handles
   * behind a long press, and dragging one of those is horizontal too.
   */
  it('leaves a press that turned into a drag to whoever is moving the caret', () => {
    expect(isSwipeNotPress(LONG_PRESS_MS + 1)).toBe(false)
    expect(isSwipeNotPress(900)).toBe(false)
  })
})

describe('commits, past the point of no return', () => {
  const PHONE = 402

  /*
   * A drag carried most of the way across and then wobbled backwards by a few
   * pixels as the finger lifted used to project to a negative and snap home —
   * the app refusing something you plainly did.
   */
  it('takes a drag that got far enough across, whatever the finger did last', () => {
    const dx = PHONE * POINT_OF_NO_RETURN + 1
    expect(commits({ dx, speed: 0, threshold: THRESHOLD, width: PHONE })).toBe(true)
    expect(commits({ dx, speed: -0.6, threshold: THRESHOLD, width: PHONE })).toBe(true)
  })

  it('still judges a drag short of it on where it was headed', () => {
    const dx = PHONE * POINT_OF_NO_RETURN - 1
    // Pulled back hard enough to be a change of mind, not a wobble.
    expect(commits({ dx, speed: -1.5, threshold: THRESHOLD, width: PHONE })).toBe(false)
    expect(commits({ dx, speed: 0, threshold: THRESHOLD, width: PHONE })).toBe(true)
    // And a wobble on the way out is still a way out.
    expect(commits({ dx, speed: -0.9, threshold: THRESHOLD, width: PHONE })).toBe(true)
  })

  it('falls back to the projection alone when the surface has no width to give', () => {
    expect(commits({ dx: 300, speed: -4, threshold: THRESHOLD })).toBe(false)
  })

  it('never leaves to the left, however far', () => {
    expect(commits({ dx: -PHONE, speed: 0, threshold: THRESHOLD, width: PHONE })).toBe(false)
  })
})
