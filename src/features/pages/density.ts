// How close you're standing to the wall.
//
// One source of truth for the geometry: the windowing math and the CSS both read
// these numbers, so a card can never be a different height than the scroller
// thinks it is. `lines` is a budget, not a promise — a short entry uses fewer.

// The union itself lives in lib/settings, which is where it's persisted — one
// definition, so a new step can't exist in the picker but not in storage.
import type { PagesDensity } from '@/lib/settings'

export type { PagesDensity }

export interface DensitySpec {
  /** Narrowest a page may get before dropping a column. */
  minWidth: number
  cardHeight: number
  gap: number
  /** Never more than this many columns, however wide the screen. */
  maxCols: number
  /** Excerpt lines this size can hold. */
  lines: number
  label: string
  hint: string
}

export const DENSITY: Record<PagesDensity, DensitySpec> = {
  // Many pages at once. You read shape, dates, and where your marks fall —
  // not sentences. This is the view a notebook can never give you.
  wall: { minWidth: 150, cardHeight: 190, gap: 12, maxCols: 8, lines: 6, label: 'Wall', hint: 'Many pages at once' },
  // The middle, and the default: enough of each page to catch a thought.
  shelf: { minWidth: 232, cardHeight: 288, gap: 16, maxCols: 5, lines: 11, label: 'Shelf', hint: 'Enough to catch a thought' },
  // Few pages, nearly readable. One step short of the Spread.
  open: { minWidth: 340, cardHeight: 404, gap: 20, maxCols: 3, lines: 18, label: 'Open', hint: 'Few pages, nearly readable' },
}

export const DENSITY_ORDER: PagesDensity[] = ['wall', 'shelf', 'open']
