// How close you're standing to the wall.
//
// This replaced three buttons labelled Wall / Shelf / Open. They were never
// three things — they were three samples of one continuous act, and naming the
// samples made you pick a mode instead of just moving closer. There is one
// number now, and everything on screen is a function of it.
//
// ── The slider does ONE thing, and that took a deletion ─────────────────────
//
// It used to span three renderings with two hard thresholds: rows, then cards,
// then — above 0.82 — whole pages two-up, paginated into leaves. That top band
// was not more zoom, it was a different app reached by dragging a slider, and
// it is why there were two full-page renderers in this directory (`Leaf` on the
// wall, `PageReader` over it) drifting apart from each other.
//
// Opening a page is already its own view. So the wall does not also need to be
// a reader, and the ramp now runs from many small cards to few large ones —
// which is the only thing "standing closer" ever honestly meant. `Leaf.tsx` and
// `leaves.ts` (with its canvas line-measuring) went with the band.
//
// One source of truth for the geometry: the windowing math and the CSS both read
// these numbers, so a card can never be a different height than the scroller
// thinks it is.

/**
 * Furthest back: the pages as rows.
 *
 * D-018 deleted the entries list on the reasoning that the wall beats a 30px
 * row at every job the row does. That was wrong in one narrow, real way —
 * browsing for a half-remembered entry got slower, because a row shows ~30 a
 * screen and the wall at its densest shows fewer. D-018's own kill note said
 * what to do about it: "an argument for a LIST-TIGHT END OF THE ZOOM rather
 * than for a second surface."
 *
 * So the list is not a surface and not a mode. It is standing very far back —
 * same wall, same `look for`, same lighting, same windowing, at 30 rows a
 * screen. 25px + 3px of gap puts 32 on a 900px viewport.
 *
 * ── Why it runs in columns ──────────────────────────────────────────────────
 *
 * `maxCols` was 1, which meant one 25px row stretched the full width of the
 * window: on a wide display, a date and a single line of prose with three feet
 * of nothing after them. A list is the one band that exists purely for density,
 * and a line of text has a readable measure past which extra width buys
 * nothing — so past that measure the band spends the width on MORE ROWS
 * instead. Three columns of 32 is 96 pages a screen, which is the number the
 * band was added to hit.
 */
const ROWS = { minWidth: 360, cardHeight: 25, gap: 3, maxCols: 3, lines: 1 }

/**
 * A phone gets ONE rendering, and no slider at all.
 *
 * ── Why the control went, rather than being re-measured again ───────────────
 *
 * It was re-measured first. The desktop ramp is widths in pixels and a phone has
 * 335 of them, so the bands were rebuilt for that width — three cards across at
 * the far end, one at the near end — and every part of the slider's travel did
 * change something. It still did not earn its place, for a reason no amount of
 * re-measuring reaches.
 *
 * On a 27" display, standing back is a real act: 96 pages at once is a shape you
 * can read — thin years, dense winters, where your marks fall. That is what the
 * control is FOR. A phone cannot show you a shape at any setting. Its ends are
 * thirteen pages and three, and both of those are a list; all the slider moves
 * is how big the type is. So it was asking the reader to choose between two
 * things that are not different, in the most valuable strip of a 390pt screen,
 * on the surface that is now their entries list.
 *
 * The shape of the archive is still on the phone — it is the Stretch band, which
 * shows eleven years in 10px and can be brushed. That band is the honest answer
 * to the question the slider was pretending to answer.
 *
 * So the phone renders rows, always, and the whole control comes off the header.
 *
 * ── The row, with the space that bought ─────────────────────────────────────
 *
 * 25px is a pointer's row; on a phone it is under half of Apple's 44pt floor.
 * And height is only half of a tap target — the other half is a row that says
 * enough to be worth aiming at. The old one gave a fixed 4.3rem date column and
 * the year rail 3.4rem more, leaving the writer's own sentence about 26
 * characters before the ellipsis: "back home now. really strugg…". A list of
 * those is a list of dates with decoration.
 *
 * So the date moves ONTO ITS OWN LINE, with the markings and today's marker —
 * facts about the page, in mono, together — and the prose gets the full width
 * beneath them, two lines of it. That is around 70 characters instead of 26,
 * which is the difference between recognising an entry and having to open it.
 *
 * 76px, so eight to a screen rather than thirteen. Fewer, and every one of them
 * legible: recognition beats density the moment density stops being readable,
 * which is the trade Mail and Notes both make at almost exactly this height.
 *
 * The number is arithmetic, not taste, and the CSS has to keep agreeing with
 * it: a 0.66rem date line, 0.28rem of gap, two lines of 0.95rem prose at 1.32,
 * and 0.5rem of padding top and bottom comes to 73px. The slack is for a root
 * font size larger than 16px, which scales all of that and none of this — and
 * `.pgr` clips on narrow so that even a reader who has scaled past the slack
 * gets a tidy row rather than one bleeding into the next.
 */
const NARROW_ROWS = { minWidth: 260, cardHeight: 76, gap: 1, maxCols: 1, lines: 2 }

/** Far end: many pages at once. You read shape, dates, and where your marks fall. */
const FAR = { minWidth: 150, cardHeight: 190, gap: 12, maxCols: 8, lines: 6 }
/**
 * Near end: the largest a card gets, and still a card.
 *
 * Not a reader. This used to be `minWidth: 460, cardHeight: 620, maxCols: 2` —
 * two whole pages side by side, which was unreadable for a reason that had
 * nothing to do with size: at two columns a long page's second leaf sits beside
 * its first, but a short page's neighbour is a different day entirely, so half
 * of what you were reading was someone else's morning.
 *
 * Three across at this end, holding twenty lines of prose — enough to read a
 * page's substance and decide, which is what the near end of a WALL is for. To
 * read the whole of one, open it.
 *
 * `lines` is not a taste call at either end: a card is `colWidth × 4/3` tall,
 * its body is what the date and padding leave, and a line of `.pgc__line` costs
 * `0.79rem × 1.5` plus `0.4rem` of margin — about 25px. FAR's card is ~200px
 * tall and holds six; NEAR's is ~575 and holds twenty. Ask for fewer and every
 * card carries a band of empty paper; ask for more and the overflow clips under
 * the fade, which reads as "there is more here" and is true. So it errs high
 * rather than low.
 */
const NEAR = { minWidth: 320, cardHeight: 430, gap: 20, maxCols: 3, lines: 20 }

/**
 * Where a card stops being a card and becomes a row.
 *
 * The one threshold left, and it earns itself: an excerpt in a box and a single
 * line with a date are genuinely different renderings, and interpolating
 * between them gives you a squashed card rather than a list.
 */
export const ROWS_ZOOM = 0.16

/**
 * Rows rather than cards.
 *
 * On a phone, always — there is no slider there and no card band to reach (see
 * `NARROW_ROWS`). The zoom argument is still taken so that one call answers for
 * both form factors and no caller has to remember which rule it is under.
 */
export const isRows = (zoom: number, narrow = false): boolean =>
  narrow || clampZoom(zoom) < ROWS_ZOOM

/**
 * What the slider is doing, for the label beside it.
 *
 * A COUNT, not a name. The old labels — "a list", "the years", "the pages",
 * "reading" — named four stops on a control that has none, and the last of them
 * named a mode that no longer exists. Everything else on this surface states a
 * number counted in code rather than a word we chose, and the slider is not an
 * exception. It also says the true thing about what the control is for: the
 * whole question is how much of the archive you can see at once.
 */
export function densityLabel(perScreen: number): string {
  if (!Number.isFinite(perScreen) || perScreen <= 0) return ''
  return `${Math.round(perScreen)} a screen`
}

/**
 * The most lines any card can want.
 *
 * Excerpts are built once at this budget and sliced per card, because the
 * budget changes on every frame of a pinch and rebuilding 3,500 excerpts at
 * 60fps is the one thing that would make this surface feel slow.
 */
/**
 * A card is a portrait: `colWidth × 4/3` is what makes it read as a page rather
 * than a tile.
 *
 * Cards are a pointer's rendering only — a phone is rows at every setting, so
 * this is never reached there and the phone's one-column exception it used to
 * carry went with the bands it was correcting for.
 */
export function cardHeightFor(spec: ZoomSpec, colWidth: number): number {
  if (colWidth <= 0) return spec.cardHeight
  return Math.round((colWidth * 4) / 3)
}

export const EXCERPT_MAX_LINES = NEAR.lines

export interface ZoomSpec {
  /** Narrowest a page may get before dropping a column. */
  minWidth: number
  cardHeight: number
  gap: number
  /** Never more than this many columns, however wide the screen. */
  maxCols: number
  /** Excerpt lines this size can hold. A budget, not a promise. */
  lines: number
}

/** Where a fresh install stands, and where ⌘0 returns you to. */
export const PAGES_ZOOM_DEFAULT = 0.45
export const ZOOM_MIN = 0
export const ZOOM_MAX = 1
/** One press of ⌘= / ⌘−, and one notch of the slider. */
export const ZOOM_STEP = 0.08

export function clampZoom(z: number): number {
  if (!Number.isFinite(z)) return PAGES_ZOOM_DEFAULT
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
}

const lerp = (a: number, b: number, t: number): number => Math.round(a + (b - a) * t)

/**
 * Geometry for a zoom level.
 *
 * Every field is rounded to an integer. The row height derived from
 * `cardHeight + gap` is what the windowing math divides scrollTop by, and a
 * fractional row height accumulates error down a 3,500-page wall until the
 * rendered window and the scroll position disagree by a whole row.
 */
export function specForZoom(zoom: number, narrow = false): ZoomSpec {
  const z = clampZoom(zoom)
  if (narrow) return { ...NARROW_ROWS }
  if (isRows(z)) return { ...ROWS }
  const far = FAR
  const near = NEAR
  // The card bands own what is left of the slider, renormalised — otherwise
  // adding a band at the bottom would silently shift every card size above it.
  const t = (z - ROWS_ZOOM) / (ZOOM_MAX - ROWS_ZOOM)
  return {
    minWidth: lerp(far.minWidth, near.minWidth, t),
    cardHeight: lerp(far.cardHeight, near.cardHeight, t),
    gap: lerp(far.gap, near.gap, t),
    maxCols: lerp(far.maxCols, near.maxCols, t),
    lines: lerp(far.lines, near.lines, t),
  }
}

/**
 * A pinch or ⌘-scroll, as a zoom delta.
 *
 * Trackpad pinch arrives as a wheel event with `ctrlKey` set — the same shape a
 * deliberate ⌘/Ctrl-scroll has — so one handler serves both. `deltaY` is
 * unbounded and its units differ per device and per `deltaMode`, so it is
 * damped and clamped rather than trusted.
 */
export function wheelZoomDelta(deltaY: number, deltaMode = 0): number {
  // deltaMode 1 is lines, 2 is pages; normalize both to something pixel-ish.
  const px = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * 400 : deltaY
  return Math.max(-0.1, Math.min(0.1, -px / 900))
}
