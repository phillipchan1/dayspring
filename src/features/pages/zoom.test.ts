import { describe, expect, it } from 'vitest'
import {
  clampZoom,
  EXCERPT_MAX_LINES,
  isRows,
  PAGES_ZOOM_DEFAULT,
  ROWS_ZOOM,
  specForZoom,
  standLabel,
  wheelZoomDelta,
  ZOOM_MAX,
  ZOOM_MIN,
} from './zoom'

const FIELDS = ['minWidth', 'cardHeight', 'gap', 'lines'] as const

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
      for (const k of FIELDS) expect(spec[k]).toBeGreaterThanOrEqual(prev[k])
      // Columns go the other way: closer means fewer pages across.
      expect(spec.maxCols).toBeLessThanOrEqual(prev.maxCols)
      prev = spec
    }
  })

  it('spans a real range end to end — the far wall is not the near one', () => {
    const far = specForZoom(ROWS_ZOOM)
    const near = specForZoom(ZOOM_MAX)
    expect(near.cardHeight).toBeGreaterThan(far.cardHeight * 2)
    expect(near.lines).toBeGreaterThan(far.lines * 2)
    expect(far.maxCols).toBeGreaterThan(near.maxCols)
  })

  // Excerpts are built once at this ceiling and sliced per card, so the ceiling
  // has to actually be the ceiling or the nearest zoom level renders short.
  it('never asks for more lines than an excerpt is built with', () => {
    for (let z = 0; z <= 1.0001; z += 0.01) {
      expect(specForZoom(z).lines).toBeLessThanOrEqual(EXCERPT_MAX_LINES)
    }
    expect(specForZoom(ZOOM_MAX).lines).toBe(EXCERPT_MAX_LINES)
  })

  it('treats out-of-range input as the nearest end rather than throwing', () => {
    expect(specForZoom(-5)).toEqual(specForZoom(ZOOM_MIN))
    expect(specForZoom(99)).toEqual(specForZoom(ZOOM_MAX))
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
   * The number this whole band exists to hit. D-022 reversed D-018 because
   * browsing for a half-remembered entry got slower — a row shows ~30 a screen
   * and the wall at its densest shows fewer. If this stops being true the band
   * is not beating the panel it replaced.
   */
  it('puts thirty rows on a 900px screen', () => {
    const spec = specForZoom(ZOOM_MIN)
    const perScreen = Math.floor(900 / (spec.cardHeight + spec.gap))
    expect(perScreen).toBeGreaterThanOrEqual(30)
  })

  it('is one page across, however wide the screen', () => {
    expect(specForZoom(ZOOM_MIN).maxCols).toBe(1)
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
    expect(specForZoom(ZOOM_MAX).cardHeight).toBe(620)
  })

  it('says where you are standing', () => {
    expect(standLabel(ZOOM_MIN)).toBe('a list')
    expect(standLabel(ZOOM_MAX)).toBe('reading')
    expect(standLabel(PAGES_ZOOM_DEFAULT)).toBe('the years')
  })
})
