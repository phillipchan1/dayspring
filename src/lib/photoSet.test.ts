import { describe, expect, it } from 'vitest'
import {
  canJoinAbove,
  cleanCaption,
  findPhotoRuns,
  formatPhotoSetLine,
  layoutPhotoRows,
  photoRatio,
  photoCaptions,
  photoRowTarget,
  planInsertBeside,
  planJoinAbove,
  planMakeFirst,
  planMoveTo,
  planMoveWithin,
  planPlaceBeside,
  planRemovePhoto,
  planTakeOut,
  setPhotoSetsApart,
  PHOTO_ROW_GAP,
  type PhotoEdit,
} from './photoSet'

const ref = (c: string, alt = '') => `![${alt}](attachment:${c.repeat(64)}.jpg)`
const A = ref('a')
const B = ref('b')
const C = ref('c')
const PENDING = '![](attachment-pending:11111111-2222-3333-4444-555555555555)'

const apply = (doc: string, edit: PhotoEdit) => doc.slice(0, edit.from) + edit.insert + doc.slice(edit.to)
const at = (doc: string, r: string) => doc.indexOf(r)

describe('findPhotoRuns', () => {
  it('reads touching photo lines as one run and a blank line as the end of it', () => {
    const doc = `Morning\n\n${A}\n${B}\n\n${C}\n\nEvening`
    const runs = findPhotoRuns(doc)
    expect(runs.map((r) => r.refs.length)).toEqual([2, 1])
    expect(doc.slice(runs[0]!.from, runs[0]!.to)).toBe(`${A}\n${B}`)
    expect(doc.slice(runs[1]!.from, runs[1]!.to)).toBe(C)
  })

  it('ends a run at any line that is not a photo, blank or not', () => {
    const runs = findPhotoRuns(`${A}\nsome words\n${B}`)
    expect(runs.map((r) => r.refs.length)).toEqual([1, 1])
  })

  it('keeps a photo that is still uploading in its run', () => {
    const [run] = findPhotoRuns(`${A}\n${PENDING}\n${B}`)
    expect(run!.refs.map((r) => Boolean(r.pendingId))).toEqual([false, true, false])
    expect(run!.refs[0]!.hash).toBe('a'.repeat(64))
  })

  it('gives each ref its own range even when the line is indented', () => {
    const doc = `  ${A}  \n${B}`
    const [run] = findPhotoRuns(doc)
    expect(doc.slice(run!.refs[0]!.from, run!.refs[0]!.to)).toBe(A)
    expect(run!.refs[0]!.lineFrom).toBe(0)
  })

  it('does not take a photo sharing its line with words', () => {
    expect(findPhotoRuns(`look: ${A}`)).toEqual([])
  })
})

describe('arranging a photo among its neighbours', () => {
  it('puts a photo with the photos above when only blank lines are between', () => {
    const doc = `${A}\n\n\n${B}\n\nwords`
    const edit = planJoinAbove(doc, at(doc, B))!
    const next = apply(doc, edit)
    expect(next).toBe(`${A}\n${B}\n\nwords`)
    // The caret rests at the end of the set, not inside it.
    expect(edit.caret).toBe(next.indexOf(B) + B.length)
  })

  it('never jumps a photo over writing', () => {
    const doc = `${A}\n\nwords\n\n${B}`
    expect(planJoinAbove(doc, at(doc, B))).toBeNull()
    expect(canJoinAbove(doc, at(doc, B))).toBe(false)
  })

  it('offers nothing to join for the first photo in an entry', () => {
    expect(planJoinAbove(`${A}\n\n${B}`, 0)).toBeNull()
  })

  it('joins a whole set to the set above it', () => {
    const doc = `${A}\n\n${B}\n${C}`
    expect(apply(doc, planJoinAbove(doc, at(doc, B))!)).toBe(`${A}\n${B}\n${C}`)
  })

  it('takes a photo out and sets it down just below the set', () => {
    const doc = `${A}\n${B}\n${C}\n\nwords`
    expect(apply(doc, planTakeOut(doc, at(doc, A))!)).toBe(`${B}\n${C}\n\n${A}\n\nwords`)
    expect(apply(doc, planTakeOut(doc, at(doc, C))!)).toBe(`${A}\n${B}\n\n${C}\n\nwords`)
  })

  it('has nothing to take a lone photo out of', () => {
    expect(planTakeOut(`${A}\n\n${B}`, 0)).toBeNull()
  })

  it('moves a photo to the front, keeping the others in order', () => {
    const doc = `${A}\n${B}\n${C}`
    expect(apply(doc, planMakeFirst(doc, at(doc, C))!)).toBe(`${C}\n${A}\n${B}`)
    expect(planMakeFirst(doc, 0)).toBeNull()
  })

  it('removes a photo from a set without leaving a blank line to split it', () => {
    const doc = `${A}\n${B}\n${C}\n\nwords`
    const middle = planRemovePhoto(doc, at(doc, B), at(doc, B) + B.length)
    expect(apply(doc, middle)).toBe(`${A}\n${C}\n\nwords`)
    const last = planRemovePhoto(doc, at(doc, C), at(doc, C) + C.length)
    expect(apply(doc, last)).toBe(`${A}\n${B}\n\nwords`)
    expect(last.caret).toBe(apply(doc, last).indexOf(B) + B.length)
  })

  it('removes a lone photo exactly as before', () => {
    const doc = `words\n\n${A}\n\nmore`
    const edit = planRemovePhoto(doc, at(doc, A), at(doc, A) + A.length)
    expect(apply(doc, edit)).toBe('words\n\n\n\nmore')
  })
})

describe('moving a photo one place along', () => {
  const doc = `${A}\n${B}\n${C}`

  it('swaps it with its neighbour', () => {
    expect(apply(doc, planMoveWithin(doc, at(doc, B), -1)!)).toBe(`${B}\n${A}\n${C}`)
    expect(apply(doc, planMoveWithin(doc, at(doc, B), 1)!)).toBe(`${A}\n${C}\n${B}`)
  })

  it('has nowhere to go past either end', () => {
    expect(planMoveWithin(doc, at(doc, A), -1)).toBeNull()
    expect(planMoveWithin(doc, at(doc, C), 1)).toBeNull()
  })
})

describe('dropping a photo onto a photo', () => {
  const D = ref('d')

  it('reorders within a set, before or after the one it is dropped on', () => {
    const doc = `${A}\n${B}\n${C}`
    expect(apply(doc, planPlaceBeside(doc, at(doc, C), at(doc, A), false)!)).toBe(`${C}\n${A}\n${B}`)
    expect(apply(doc, planPlaceBeside(doc, at(doc, A), at(doc, C), true)!)).toBe(`${B}\n${C}\n${A}`)
    expect(apply(doc, planPlaceBeside(doc, at(doc, A), at(doc, C), false)!)).toBe(`${B}\n${A}\n${C}`)
  })

  it('does nothing when the photo would land where it already is', () => {
    const doc = `${A}\n${B}\n${C}`
    expect(planPlaceBeside(doc, at(doc, B), at(doc, A), true)).toBeNull()
    expect(planPlaceBeside(doc, at(doc, B), at(doc, C), false)).toBeNull()
    expect(planPlaceBeside(doc, at(doc, B), at(doc, B), true)).toBeNull()
  })

  it('makes a set of two lone photos and leaves no gap behind', () => {
    const doc = `words\n\n${A}\n\nmore words\n\n${B}\n\nend`
    const edit = planPlaceBeside(doc, at(doc, B), at(doc, A), true)!
    const next = apply(doc, edit)
    expect(next).toBe(`words\n\n${A}\n${B}\n\nmore words\n\nend`)
    expect(edit.caret).toBe(next.indexOf(B) + B.length)
  })

  it('carries a photo from one set into another', () => {
    const doc = `${A}\n${B}\n\nwords\n\n${C}\n${D}`
    expect(apply(doc, planPlaceBeside(doc, at(doc, D), at(doc, A), false)!)).toBe(
      `${D}\n${A}\n${B}\n\nwords\n\n${C}`,
    )
    expect(apply(doc, planPlaceBeside(doc, at(doc, A), at(doc, D), true)!)).toBe(
      `${B}\n\nwords\n\n${C}\n${D}\n${A}`,
    )
  })

  it('joins a lone photo sitting directly above or below a set', () => {
    const above = `${A}\n\n${B}\n${C}`
    expect(apply(above, planPlaceBeside(above, at(above, A), at(above, B), false)!)).toBe(`${A}\n${B}\n${C}`)
    const below = `${A}\n${B}\n\n${C}`
    expect(apply(below, planPlaceBeside(below, at(below, C), at(below, B), true)!)).toBe(`${A}\n${B}\n${C}`)
  })

  it('puts new photo lines beside the photo they were dropped on', () => {
    const doc = `words\n\n${A}\n\nend`
    expect(apply(doc, planInsertBeside(doc, at(doc, A), true, [B, C])!)).toBe(
      `words\n\n${A}\n${B}\n${C}\n\nend`,
    )
    expect(apply(doc, planInsertBeside(doc, at(doc, A), false, [PENDING])!)).toBe(
      `words\n\n${PENDING}\n${A}\n\nend`,
    )
    expect(planInsertBeside(doc, at(doc, A), true, [])).toBeNull()
  })
})

describe('captions', () => {
  it('reads the captions a writer gave, skipping camera filenames and blanks', () => {
    const doc = `${ref('a', 'The lighthouse steps')}\n${ref('b', 'IMG_4821')}\n${ref('c')}\n\n${ref('d', 'Lunch')}`
    expect(photoCaptions(doc)).toEqual(['The lighthouse steps', 'Lunch'])
    expect(photoCaptions(null)).toEqual([])
  })

  it('keeps a caption to what a photo line can hold', () => {
    expect(cleanCaption('  Micah [age 6]\non the steps ')).toBe('Micah age 6 on the steps')
  })
})

describe('photoRatio', () => {
  it('holds a screenshot and a panorama to the limits a lone photo crops at', () => {
    expect(photoRatio(900, 1950)).toBeCloseTo(2 / 3)
    expect(photoRatio(4000, 1000)).toBeCloseTo(16 / 9)
    expect(photoRatio(1200, 900)).toBeCloseTo(4 / 3)
  })

  it('stands in 4:3 until the size is known', () => {
    expect(photoRatio()).toBeCloseTo(4 / 3)
    expect(photoRatio(0, 0)).toBeCloseTo(4 / 3)
  })
})

describe('layoutPhotoRows', () => {
  const LANDSCAPE = 4 / 3
  const WIDE = 16 / 9
  const PORTRAIT = 3 / 4
  const PHONE = 333
  const MAC = 640

  /** Every justified row's tiles, plus gaps, come to the column width. */
  const fills = (ratios: number[], width: number) =>
    layoutPhotoRows(ratios, width)
      .filter((row) => row.justified)
      .every((row) => {
        const tiles = ratios.slice(row.start, row.start + row.count).reduce((a, r) => a + r * row.height, 0)
        return Math.abs(tiles + PHOTO_ROW_GAP * (row.count - 1) - width) < 0.01
      })

  it('aims rows at about a quarter of the column, within a floor and a ceiling', () => {
    expect(photoRowTarget(PHONE)).toBe(140)
    expect(photoRowTarget(MAC)).toBe(173)
    expect(photoRowTarget(830)).toBe(224)
    expect(photoRowTarget(1400)).toBe(240)
  })

  it('fills the column with two photos, however wide the column is', () => {
    // The report that started this: two photos spanning half a wide column.
    for (const width of [PHONE, MAC, 830, 1014]) {
      const [row, ...rest] = layoutPhotoRows([LANDSCAPE, LANDSCAPE], width)
      expect(rest).toEqual([])
      expect(row).toMatchObject({ count: 2, justified: true })
      expect(fills([LANDSCAPE, LANDSCAPE], width)).toBe(true)
    }
  })

  it('fills the column for every count of ordinary photos', () => {
    const shapes = [LANDSCAPE, WIDE, LANDSCAPE, 3 / 2, PORTRAIT, 1, 4 / 5]
    for (let n = 2; n <= 12; n++) {
      const ratios = Array.from({ length: n }, (_, i) => shapes[i % shapes.length]!)
      for (const width of [PHONE, MAC, 830, 1014]) {
        const rows = layoutPhotoRows(ratios, width)
        expect(rows.every((r) => r.justified), `${n} photos at ${width}`).toBe(true)
      }
    }
  })

  it('keeps every photo, in order, exactly once', () => {
    const ratios = [LANDSCAPE, WIDE, LANDSCAPE, 3 / 2, PORTRAIT, 1, PORTRAIT, WIDE, 1, LANDSCAPE, 4 / 5]
    for (const width of [PHONE, MAC, 900]) {
      const rows = layoutPhotoRows(ratios, width)
      expect(rows[0]!.start).toBe(0)
      rows.forEach((row, i) => {
        if (i > 0) expect(row.start).toBe(rows[i - 1]!.start + rows[i - 1]!.count)
      })
      const last = rows[rows.length - 1]!
      expect(last.start + last.count).toBe(ratios.length)
      expect(fills(ratios, width)).toBe(true)
    }
  })

  it('puts two landscape photos side by side and fills the column', () => {
    for (const width of [PHONE, MAC]) {
      const rows = layoutPhotoRows([LANDSCAPE, WIDE], width)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ start: 0, count: 2, justified: true })
    }
  })

  it('gives the first photo its own row rather than stranding the last one', () => {
    // Two fill a phone row; the third would be left alone at the end.
    const rows = layoutPhotoRows([LANDSCAPE, WIDE, LANDSCAPE], PHONE)
    expect(rows.map((r) => r.count)).toEqual([1, 2])
    expect(rows.every((r) => r.justified)).toBe(true)
  })

  it('never ends on a lone photo when there is another way', () => {
    const shapes = [LANDSCAPE, WIDE, PORTRAIT, 3 / 2, 1, 4 / 5]
    for (let n = 3; n <= 14; n++) {
      const ratios = Array.from({ length: n }, (_, i) => shapes[i % shapes.length]!)
      for (const width of [PHONE, MAC]) {
        const rows = layoutPhotoRows(ratios, width)
        const last = rows[rows.length - 1]!
        expect(last.count === 1 && !last.justified, `${n} photos at ${width}`).toBe(false)
      }
    }
  })

  it('splits five photos into two full rows instead of a short row and a loose one', () => {
    const rows = layoutPhotoRows([LANDSCAPE, WIDE, LANDSCAPE, 3 / 2, PORTRAIT], MAC)
    expect(rows.map((r) => r.count)).toEqual([2, 3])
    expect(rows.every((r) => r.justified)).toBe(true)
  })

  it('never runs a row of several photos below 70% of the target', () => {
    const shapes = [LANDSCAPE, WIDE, PORTRAIT, 3 / 2, 1, WIDE, WIDE]
    for (let n = 2; n <= 20; n++) {
      const ratios = Array.from({ length: n }, (_, i) => shapes[i % shapes.length]!)
      for (const width of [PHONE, MAC]) {
        const floor = photoRowTarget(width) * 0.7
        for (const row of layoutPhotoRows(ratios, width)) {
          if (row.count > 1) expect(row.height).toBeGreaterThanOrEqual(floor - 0.01)
        }
      }
    }
  })

  it('stops a row at the height cap rather than fill the column past it', () => {
    // Two portraits on a wide column: filling it would make them taller than a
    // lone photo is ever drawn. They stop at the cap, side by side, centred.
    const [row, ...rest] = layoutPhotoRows([PORTRAIT, PORTRAIT], 900)
    expect(rest).toEqual([])
    expect(row).toMatchObject({ count: 2, justified: false, height: 480 })
  })

  it('takes a lower cap from a short window', () => {
    const rows = layoutPhotoRows([LANDSCAPE, LANDSCAPE], 1014, 300)
    for (const row of rows) expect(row.height).toBeLessThanOrEqual(300)
  })

  it('caps a photo alone in its row at a lone photo’s height', () => {
    const rows = layoutPhotoRows([PORTRAIT, WIDE, WIDE, WIDE, WIDE], 900)
    for (const row of rows) if (row.count === 1) expect(row.height).toBeLessThanOrEqual(480)
  })

  it('has nothing to lay out without photos or a width', () => {
    expect(layoutPhotoRows([], MAC)).toEqual([])
    expect(layoutPhotoRows([LANDSCAPE], 0)).toEqual([])
  })
})

describe('formatPhotoSetLine', () => {
  it('counts the photos and says nothing more when no time is known', () => {
    expect(formatPhotoSetLine(3, [undefined, undefined, undefined])).toBe('3 photos')
  })

  it('gives the day and the span they were taken across', () => {
    const line = formatPhotoSetLine(3, ['2026-09-20T07:48:00', undefined, '2026-09-20T07:02:00'])
    expect(line.startsWith('3 photos · ')).toBe(true)
    expect(line).toContain('September 20')
    expect(line.indexOf('7:02')).toBeLessThan(line.indexOf('7:48'))
  })

  it('gives a range of days when the set spans more than one', () => {
    const line = formatPhotoSetLine(2, ['2026-09-20T22:00:00', '2026-09-22T09:00:00'])
    expect(line).toContain('September 20')
    expect(line).toContain('September 22')
    expect(line).not.toContain(':')
  })

  it('ignores a time it cannot read', () => {
    expect(formatPhotoSetLine(2, ['not a date', undefined])).toBe('2 photos')
  })
})

describe('planMoveTo', () => {
  const doc = `Before\n${A}\n${B}\n${C}\nAfter`

  it('moves a photo to any place in its set, in one change', () => {
    expect(apply(doc, planMoveTo(doc, at(doc, C), 0)!)).toBe(`Before\n${C}\n${A}\n${B}\nAfter`)
    expect(apply(doc, planMoveTo(doc, at(doc, A), 2)!)).toBe(`Before\n${B}\n${C}\n${A}\nAfter`)
  })

  it('holds the place to the set, and does nothing when it would not move', () => {
    expect(apply(doc, planMoveTo(doc, at(doc, A), 9)!)).toBe(`Before\n${B}\n${C}\n${A}\nAfter`)
    expect(planMoveTo(doc, at(doc, B), 1)).toBeNull()
  })
})

describe('setPhotoSetsApart', () => {
  it('sets a set apart from the writing it touches', () => {
    expect(setPhotoSetsApart(`Text\n${A}\n${B}\nMore`)).toBe(`Text\n\n${A}\n${B}\n\nMore`)
  })

  it('leaves a set that already stands apart, and a lone photo, as they were', () => {
    const apart = `Text\n\n${A}\n${B}\n\nMore`
    expect(setPhotoSetsApart(apart)).toBe(apart)
    const lone = `Text\n${A}\nMore`
    expect(setPhotoSetsApart(lone)).toBe(lone)
  })

  it('lifts a set out of the list item it was written under', () => {
    expect(setPhotoSetsApart(`- item\n  ${A}\n  ${B}`)).toBe(`- item\n\n${A}\n${B}`)
  })

  it('leaves photo markup inside a code fence alone', () => {
    const fenced = `\`\`\`\nText\n${A}\n${B}\n\`\`\``
    expect(setPhotoSetsApart(fenced)).toBe(fenced)
  })
})
