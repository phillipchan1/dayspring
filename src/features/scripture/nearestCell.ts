/**
 * A finger on the chapter strip, resolved to the chapter it meant.
 *
 * The strip's cells are drawn at ~26px on a phone — the size the picture
 * needs, and about half a fingertip. Padding each cell out to 44pt would push
 * the grid apart and break the picture, so the target is padded instead of the
 * glyph: on touch, a tap goes to the nearest LIT cell within 44pt of it.
 * Unlit cells are not targets at all (there is nothing to filter to), so a
 * tap that lands on an unlit square beside a lit one still finds the lit one.
 */

/** The touch target floor, in CSS px (DESIGN_PRINCIPLES N2). */
export const TOUCH_TARGET = 44

export interface CellBox {
  chapter: number
  left: number
  top: number
  width: number
  height: number
  lit: boolean
}

/**
 * The lit cell a tap at (x, y) belongs to, or null.
 *
 * A tap squarely inside a lit cell is that cell, whatever is near it. Past
 * that, the nearest lit cell whose centre is within `reach` of the tap — far
 * enough that a tap on the unlit square next door still finds its lit
 * neighbour, near enough that a tap two squares off is nothing.
 */
export function nearestLit(x: number, y: number, cells: readonly CellBox[], reach = TOUCH_TARGET): number | null {
  let best: number | null = null
  let bestD = Infinity
  for (const c of cells) {
    if (!c.lit) continue
    if (x >= c.left && x <= c.left + c.width && y >= c.top && y <= c.top + c.height) return c.chapter
    const d = Math.hypot(x - (c.left + c.width / 2), y - (c.top + c.height / 2))
    if (d <= reach && d < bestD) {
      bestD = d
      best = c.chapter
    }
  }
  return best
}
