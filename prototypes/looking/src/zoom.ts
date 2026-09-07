/**
 * How close you are standing.
 *
 * ── One continuous move, not four named stops ───────────────────────────────
 *
 * Pages already frames zoom this way: "Wall / Shelf / Open were three samples
 * of the same act, and naming them made you pick a mode instead of simply
 * standing closer." This extends the same move in one direction — far enough
 * back that a card stops being a card and becomes a row.
 *
 * ── Why that matters ────────────────────────────────────────────────────────
 *
 * D-018 deleted the entries list on the reasoning that the wall beats a 30px
 * row at every job the row does. D-022 reversed it three days later, and the
 * thing that fired was narrow and real: "browsing for a half-remembered entry
 * becomes reliably slower." A row shows ~25 entries per screen; the wall at its
 * densest shows fewer.
 *
 * D-018's own kill note said what to do about it and nobody did it: "an
 * argument for a LIST-TIGHT END OF THE ZOOM rather than for a second surface."
 *
 * So the list is not a surface and not a mode. It is standing very far back.
 * Same wall, same `look for`, same chapters, same everything — at 25 rows a
 * screen.
 */

export type Stand = 'rows' | 'far' | 'near' | 'reading'

/** Where the four bands sit on a 0–1 slider. */
export function standAt(zoom: number): Stand {
  if (zoom < 0.2) return 'rows'
  if (zoom < 0.52) return 'far'
  if (zoom < 0.86) return 'near'
  return 'reading'
}

/** Columns for the card bands. Rows and reading do not use it. */
export function colsAt(zoom: number, room: 'full' | 'shared' = 'full'): number {
  const wide = room === 'full'
  if (zoom < 0.52) return wide ? 8 : 5
  return wide ? 5 : 3
}

export function linesAt(zoom: number): number {
  return zoom < 0.52 ? 4 : 8
}

/** What the slider says it is doing, for the label beside it. */
export const STAND_LABEL: Record<Stand, string> = {
  rows: 'a list',
  far: 'the years',
  near: 'the pages',
  reading: 'reading',
}
