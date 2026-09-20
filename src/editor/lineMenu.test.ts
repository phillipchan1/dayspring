// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { plusRect } from './lineMenu'

/** A line with a known box and leading. jsdom does no layout, so both are stated. */
function line(box: { left: number; top: number; height: number }, style: Partial<CSSStyleDeclaration>) {
  const el = document.createElement('div')
  Object.assign(el.style, style)
  el.getBoundingClientRect = () =>
    ({
      left: box.left,
      top: box.top,
      height: box.height,
      right: box.left + 600,
      bottom: box.top + box.height,
      width: 600,
      x: box.left,
      y: box.top,
      toJSON: () => ({}),
    }) as DOMRect
  document.body.appendChild(el)
  return el
}

describe('plusRect', () => {
  beforeEach(() => {
    document.documentElement.style.fontSize = '16px'
  })
  afterEach(() => {
    document.body.innerHTML = ''
    document.documentElement.style.fontSize = ''
  })

  const centreY = (r: { top: number; bottom: number }) => (r.top + r.bottom) / 2

  it('centres the box on the middle of the line, not on its font size', () => {
    // The editor's real numbers: a 23.28px face at 1.7 leading is a 39.6px line.
    // The mark used to be placed by `em`, which centred it on a line only as tall
    // as its font and left it about 7px high here.
    const el = line({ left: 176, top: 100, height: 39.6 }, { fontSize: '23.28px', lineHeight: '39.6px' })
    expect(centreY(plusRect(el))).toBeCloseTo(100 + 19.8, 5)
  })

  it('follows the leading, so it stays centred at any line-height setting', () => {
    const tight = line({ left: 0, top: 0, height: 30 }, { fontSize: '20px', lineHeight: '30px' })
    const loose = line({ left: 0, top: 0, height: 50 }, { fontSize: '20px', lineHeight: '50px' })
    expect(centreY(plusRect(tight))).toBeCloseTo(15, 5)
    expect(centreY(plusRect(loose))).toBeCloseTo(25, 5)
  })

  it('sits beside the FIRST row of a wrapped line, not the middle of the whole line', () => {
    const wrapped = line({ left: 0, top: 200, height: 120 }, { fontSize: '20px', lineHeight: '40px' })
    expect(centreY(plusRect(wrapped))).toBeCloseTo(200 + 20, 5)
  })

  it('falls back to the usual leading when the line has none to read', () => {
    const el = line({ left: 0, top: 0, height: 24 }, { fontSize: '20px', lineHeight: 'normal' })
    expect(centreY(plusRect(el))).toBeCloseTo(12, 5)
  })

  it('is a 24px square', () => {
    const r = plusRect(line({ left: 176, top: 0, height: 40 }, { lineHeight: '40px' }))
    expect(r.bottom - r.top).toBe(24)
    expect(r.right - r.left).toBe(24)
  })

  it('is measured from the LINE, so a padded editor does not move the click target off the mark', () => {
    // Cloister and Compline inset every line 2.2rem inside `.cm-content`. A hit
    // test measured from the content box sat a whole gutter left of the mark.
    const flush = plusRect(line({ left: 176, top: 0, height: 40 }, { lineHeight: '40px' }))
    const inset = plusRect(line({ left: 176 + 35.2, top: 0, height: 40 }, { lineHeight: '40px' }))
    expect(inset.left - flush.left).toBeCloseTo(35.2, 5)
    // And the mark's own centre is 1.35rem left of the line's edge.
    expect((flush.left + flush.right) / 2).toBeCloseTo(176 - 1.35 * 16, 5)
  })
})
