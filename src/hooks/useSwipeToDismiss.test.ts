import { describe, expect, it } from 'vitest'
import { axisOf, commits } from './useSwipeToDismiss'

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
