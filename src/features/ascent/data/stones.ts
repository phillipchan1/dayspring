/**
 * Summit stones — the markers the user has set on the Wall, rendered as points of
 * light along the climbed mountainside. MOCK adapter.
 *
 * The real source is the Wall's set/answered stones. The existing Altar adapter
 * (`@/lib/altar/query` listThreads → lit encounters) could back this later — it
 * stays behind this seam so the swap is one file. These are the user's OWN marks,
 * arranged and lit; the app never narrates what they meant.
 *
 * // TODO: wire real data — replace fixtures with the Wall's set stones.
 */

import type { SummitStone } from './types'

const STONES: SummitStone[] = [
  { month: 2, label: 'he met me in the waiting', entryId: null },
  { month: 4, label: 'the trade I didn’t force', entryId: null },
  { month: 5, label: 'homeschool, softened', entryId: null },
  { month: 7, label: 'provision, unlooked for', entryId: null },
  { month: 9, label: 'he changed how I see it', entryId: null },
  { month: 11, label: 'it came when I let go', entryId: null },
]

export function loadStones(year: number): SummitStone[] {
  // year is accepted so the real adapter can scope to the year in view.
  void year
  return STONES
}
