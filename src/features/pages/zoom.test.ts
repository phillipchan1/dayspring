import { describe, expect, it } from 'vitest'
import {
  CARD_CHROME_PX,
  cardHeightFor,
  cardLineCostPx,
  cardLinesFor,
  clampZoom,
  densityLabel,
  EXCERPT_MAX_LINES,
  isRows,
  PAGES_ZOOM_DEFAULT,
  ROWS_ZOOM,
  specForZoom,
  wheelZoomDelta,
  ZOOM_MAX,
  ZOOM_MIN,
} from './zoom'

const FIELDS = ['minWidth', 'cardHeight', 'gap', 'lines'] as const
const GROWS = [...FIELDS, 'textRem'] as const

describe('specForZoom', () => {
  /**
   * The load-bearing property. `cardHeight + gap` is the row height the
   * windowing math divides scrollTop by; a fraction there accumulates down a
   * 3,500-page wall until the rendered window and the scroll position disagree
   * by a whole row.
   */
  it('returns whole numbers at every zoom level', () => {
    for (let z = 0; z <= 1.0001; z += 0.01) {
      const spec = specForZoom(z)
      for (const k of [...FIELDS, 'maxCols'] as const) {
        expect(Number.isInteger(spec[k])).toBe(true)
      }
    }
  })

  it('grows every dimension as you move closer, and never shrinks one', () => {
    // From the card bands up. The rows band below is a different rendering, not
    // a smaller card, and it is allowed to break the curve — see its own tests.
    let prev = specForZoom(ROWS_ZOOM)
    for (let z = ROWS_ZOOM + 0.01; z <= 1.0001; z += 0.01) {
      const spec = specForZoom(z)
      for (const k of GROWS) expect(spec[k]).toBeGreaterThanOrEqual(prev[k])
      // Columns go the other way: closer means fewer pages across.
      expect(spec.maxCols).toBeLessThanOrEqual(prev.maxCols)
      prev = spec
    }
  })

  it('spans a real range end to end — the far wall is not the near one', () => {
    const far = specForZoom(ROWS_ZOOM)
    const near = specForZoom(ZOOM_MAX)
    expect(near.cardHeight).toBeGreaterThan(far.cardHeight * 2)
    expect(far.maxCols).toBeGreaterThan(near.maxCols)
    // Measured on the cards a 1440px wall actually lays out, not the nominal
    // heights: bigger type costs lines, and the near end must still hold
    // more than twice what the far end does.
    const far1440 = cardAt(ROWS_ZOOM, 1440)
    const near1440 = cardAt(ZOOM_MAX, 1440)
    expect(near1440.lines).toBeGreaterThan(far1440.lines * 2)
  })

  // Excerpts are built once at this ceiling and sliced per card, so the ceiling
  // has to actually be the ceiling or the nearest zoom level renders short.
  it('never asks for more lines than an excerpt is built with', () => {
    for (let z = 0; z <= 1.0001; z += 0.01) {
      expect(specForZoom(z).lines).toBeLessThanOrEqual(EXCERPT_MAX_LINES)
      for (const w of [900, 1440, 2560, 3840]) {
        expect(cardAt(z, w).lines).toBeLessThanOrEqual(EXCERPT_MAX_LINES)
      }
    }
    // A tall enough card reaches the ceiling rather than stopping short of it.
    expect(cardAt(ZOOM_MAX, 3840).lines).toBe(EXCERPT_MAX_LINES)
  })

  it('treats out-of-range input as the nearest end rather than throwing', () => {
    expect(specForZoom(-5)).toEqual(specForZoom(ZOOM_MIN))
    expect(specForZoom(99)).toEqual(specForZoom(ZOOM_MAX))
  })
})

describe('the type comes closer too', () => {
  /*
   * Standing closer to a wall makes the writing bigger. For a long time only
   * the boxes grew — the near end was the far end with more lines of the same
   * 0.79rem prose. This is the guard against sliding back to that.
   */
  it('sets the prose larger at the near end than the far end', () => {
    expect(specForZoom(ZOOM_MAX).textRem).toBeGreaterThan(specForZoom(ROWS_ZOOM).textRem * 1.2)
  })

  // The far end is for shape, but a card you glance at must still be legible.
  it('never sets the prose smaller than the wall always has', () => {
    for (let z = ROWS_ZOOM; z <= 1.0001; z += 0.01) {
      expect(specForZoom(z).textRem).toBeGreaterThanOrEqual(0.79)
    }
  })

  // The open page is set at the editor's size (~1.05rem and up). A card that
  // matched it would make opening a page stop feeling like stepping in.
  it('stays under the size of an open page', () => {
    expect(specForZoom(ZOOM_MAX).textRem).toBeLessThanOrEqual(1)
  })

  /*
   * The line budget and the CSS read the same number, so a card is handed the
   * lines it has room for: never a band of empty paper, and never more than
   * one line spilling under the fade.
   */
  it('asks for the lines a card has room for, erring high by at most one', () => {
    for (let z = ROWS_ZOOM; z <= 1.0001; z += 0.05) {
      for (const w of [900, 1440, 1920]) {
        const { spec, height, lines } = cardAt(z, w)
        const body = height - CARD_CHROME_PX
        const cost = cardLineCostPx(spec.textRem)
        if (lines === EXCERPT_MAX_LINES) continue
        expect(lines * cost).toBeGreaterThanOrEqual(body)
        expect((lines - 1) * cost).toBeLessThan(body)
      }
    }
  })

  it('never hands a card zero lines, however small', () => {
    expect(cardLinesFor(0.79, 0)).toBe(1)
    expect(cardLinesFor(1, 20)).toBe(1)
  })
})

describe('clampZoom', () => {
  it('holds the range', () => {
    expect(clampZoom(-1)).toBe(ZOOM_MIN)
    expect(clampZoom(2)).toBe(ZOOM_MAX)
    expect(clampZoom(0.3)).toBe(0.3)
  })

  // A NaN reaching settings would persist, and the wall would render at NaN
  // height forever with no way back short of clearing storage. Any non-finite
  // value is treated as no value at all rather than as an extreme one.
  it('falls back to the default on anything non-finite', () => {
    expect(clampZoom(NaN)).toBe(PAGES_ZOOM_DEFAULT)
    expect(clampZoom(Infinity)).toBe(PAGES_ZOOM_DEFAULT)
    expect(clampZoom(-Infinity)).toBe(PAGES_ZOOM_DEFAULT)
  })
})

describe('wheelZoomDelta', () => {
  it('zooms in when the gesture pushes up, out when it pushes down', () => {
    expect(wheelZoomDelta(-100)).toBeGreaterThan(0)
    expect(wheelZoomDelta(100)).toBeLessThan(0)
  })

  // deltaY is unbounded and its units differ per device; one flick must not
  // teleport you from the whole decade to a single page.
  it('caps a violent flick', () => {
    expect(wheelZoomDelta(-100000)).toBeLessThanOrEqual(0.1)
    expect(wheelZoomDelta(100000)).toBeGreaterThanOrEqual(-0.1)
  })

  it('normalizes line and page delta modes to the same scale as pixels', () => {
    // 1 line ≈ 16px, 1 page ≈ 400px — without this a Firefox line-mode wheel
    // would move the zoom by a sixteenth of what the same gesture does elsewhere.
    expect(wheelZoomDelta(10, 1)).toBeCloseTo(wheelZoomDelta(160, 0), 6)
    expect(wheelZoomDelta(1, 2)).toBeCloseTo(wheelZoomDelta(400, 0), 6)
  })
})

describe('the rows band', () => {
  /*
   * Enough rows to browse quickly, with enough height for each one to remain a
   * recognizable target rather than becoming texture.
   */
  it('puts about twenty-six rows on a 900px screen', () => {
    const spec = specForZoom(ZOOM_MIN)
    const perScreen = Math.floor(900 / (spec.cardHeight + spec.gap))
    expect(perScreen).toBeGreaterThanOrEqual(25)
    expect(perScreen).toBeLessThanOrEqual(28)
  })

  /*
   * The band exists purely for density, and a line of prose has a measure past
   * which extra width buys nothing. Left at one column, a wide display spent
   * its whole width on one 25px row — so past that measure the width goes to
   * a second lane instead. This is the fix for "a full-width list makes no
   * sense" without splitting chronology across three competing scan paths.
   */
  it('spends extra width on a second lane rather than a longer one', () => {
    const spec = specForZoom(ZOOM_MIN)
    expect(spec.maxCols).toBe(2)
    // Narrow windows still get exactly one, because the measure comes first.
    const fits = (w: number) => Math.floor((w + spec.gap) / (spec.minWidth + spec.gap))
    expect(Math.min(spec.maxCols, fits(700))).toBe(1)
    expect(Math.min(spec.maxCols, fits(1400))).toBe(2)
  })

  it('offers fifty to sixty page cells before section headers', () => {
    const spec = specForZoom(ZOOM_MIN)
    const rows = Math.floor(900 / (spec.cardHeight + spec.gap))
    const cols = Math.min(spec.maxCols, Math.floor((1400 + spec.gap) / (spec.minWidth + spec.gap)))
    expect(rows * cols).toBeGreaterThanOrEqual(50)
    expect(rows * cols).toBeLessThanOrEqual(60)
  })

  // A threshold, not a blend: a squashed card is not a list.
  it('changes rendering at the threshold rather than interpolating into it', () => {
    expect(isRows(ROWS_ZOOM - 0.001)).toBe(true)
    expect(isRows(ROWS_ZOOM)).toBe(false)
    expect(specForZoom(ROWS_ZOOM).cardHeight).toBeGreaterThan(
      specForZoom(ROWS_ZOOM - 0.001).cardHeight * 4,
    )
  })

  // Adding a band at the bottom must not silently resize every card above it.
  it('leaves the card bands spanning their full range', () => {
    expect(specForZoom(ROWS_ZOOM).cardHeight).toBe(190)
    expect(specForZoom(ZOOM_MAX).cardHeight).toBe(430)
  })
})

describe('the near end', () => {
  /*
   * The reading band is gone, and this is what stops it coming back by
   * accident. It rendered whole pages two-up: at two columns a long page's
   * second leaf sat beside its first while a short page's neighbour was a
   * different day entirely, so half of what you were reading was someone
   * else's morning. The near end is a WALL of large cards — several across.
   */
  it('is still a wall, not two pages side by side', () => {
    expect(specForZoom(ZOOM_MAX).maxCols).toBeGreaterThan(2)
  })

  it('holds enough prose to read a page\u2019s substance', () => {
    expect(specForZoom(ZOOM_MAX).lines).toBeGreaterThanOrEqual(12)
  })
})

describe('densityLabel', () => {
  // A count, not a name. The old labels named four stops on a control that has
  // none, and the last of them named a mode that no longer exists.
  it('states the count', () => {
    expect(densityLabel(40)).toBe('40 a screen')
    expect(densityLabel(96)).toBe('96 a screen')
  })

  // The wall reports 0 until it has measured itself. An empty string is the
  // honest rendering of "not known yet"; "0 a screen" is a claim.
  it('says nothing before anything has been measured', () => {
    expect(densityLabel(0)).toBe('')
    expect(densityLabel(NaN)).toBe('')
    expect(densityLabel(-3)).toBe('')
  })
})

/**
 * How many pages a viewport of `width` × `height` actually holds at `zoom` —
 * the same arithmetic PageWall does, so these tests measure the thing the
 * reader sees rather than the numbers in the table.
 */
function perScreen(zoom: number, width: number, height: number, narrow: boolean): number {
  const spec = specForZoom(zoom, narrow)
  const cols = Math.max(1, Math.min(spec.maxCols, Math.floor((width + spec.gap) / (spec.minWidth + spec.gap))))
  const colWidth = Math.floor((width - spec.gap * (cols - 1)) / cols)
  const h = isRows(zoom, narrow) ? spec.cardHeight : cardHeightFor(spec, colWidth)
  return Math.max(1, Math.floor(height / (h + spec.gap)) * cols)
}

/** The card the wall lays out at `zoom` on a `width` px wall, and what it holds. */
function cardAt(zoom: number, width: number) {
  const spec = specForZoom(zoom)
  const cols = Math.max(1, Math.min(spec.maxCols, Math.floor((width + spec.gap) / (spec.minWidth + spec.gap))))
  const colWidth = Math.floor((width - spec.gap * (cols - 1)) / cols)
  const height = isRows(zoom) ? spec.cardHeight : cardHeightFor(spec, colWidth)
  return { spec, height, lines: cardLinesFor(spec.textRem, height) }
}

const PHONE = { w: 335, h: 700 }

describe('the phone', () => {
  /*
   * One rendering, at every setting.
   *
   * The phone has no slider — the argument for taking it off is in `zoom.ts` —
   * so whatever number is stored (from a desktop session, from a migration, from
   * a keyboard shortcut on a tablet that then rotates) the phone must land on
   * rows. Anything else and a value the reader cannot see or change decides what
   * their entries list looks like.
   */
  it('renders rows wherever the stored zoom happens to be', () => {
    for (const z of [0, 0.16, 0.3, 0.45, 0.7, 1]) {
      expect(isRows(z, true)).toBe(true)
      expect(specForZoom(z, true)).toEqual(specForZoom(0, true))
    }
  })

  /*
   * 44 is Apple's floor — what a target must clear to be hittable at all. This
   * is a list you scroll fast with a moving thumb, where 44 is hittable and
   * still feels like aiming, so it clears the floor with room over it.
   */
  it('gives a row a tap target with room over the 44pt floor', () => {
    expect(specForZoom(ZOOM_MIN, true).cardHeight).toBeGreaterThanOrEqual(48)
  })

  /*
   * And room for the words, which is the other half of a target worth aiming at.
   *
   * A row that shows one clipped line is a date with decoration — the reader has
   * to open the page to find out whether it was the one. Two lines of her own
   * prose is what makes the list answer the question instead.
   */
  it('gives the row more than one line of her own prose', () => {
    expect(specForZoom(ZOOM_MIN, true).lines).toBeGreaterThanOrEqual(2)
    expect(EXCERPT_MAX_LINES).toBeGreaterThanOrEqual(specForZoom(ZOOM_MIN, true).lines)
  })

  it('is one page across, where a phone has no room for two', () => {
    expect(specForZoom(ZOOM_MIN, true).maxCols).toBe(1)
  })

  /*
   * Legible, and still a list.
   *
   * Recognition beats density once density stops being readable — but a row tall
   * enough to read is only worth it while the thing is still a LIST. Seven to a
   * screen is where Mail and Notes sit; below about six this has become a card
   * wall with the cards turned sideways.
   */
  it('still puts most of a screenful of pages in front of you', () => {
    expect(perScreen(0, PHONE.w, PHONE.h, true)).toBeGreaterThanOrEqual(7)
  })
})

describe('cardHeightFor', () => {
  // A card is a portrait, which is what makes it read as a page rather than a
  // tile. Cards are a pointer's rendering only — a phone never reaches this.
  it('keeps a card portrait', () => {
    const spec = specForZoom(0.5)
    expect(cardHeightFor(spec, 300)).toBe(400)
  })

  it('falls back to the band before anything has been measured', () => {
    const spec = specForZoom(0.5)
    expect(cardHeightFor(spec, 0)).toBe(spec.cardHeight)
  })
})
