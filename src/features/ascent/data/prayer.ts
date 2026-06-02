/**
 * Prayer — PATTERN ONLY. MOCK adapter.
 *
 * This dimension shows the *shape* of what the user kept asking — never a list of
 * individual prayers or answers (those live on the Wall / Altar). The real source
 * is the prayer/Wall data object, which doesn't yet expose an "ask pattern +
 * forward evidence + confirmed stone" shape, so the UI is built fully against
 * these typed fixtures.
 *
 * // TODO: wire real data — replace the fixtures below with the Wall adapter.
 * The view-model contract (PrayerData) is the seam; swapping is a one-file change.
 */

import type { PrayerData, Resolution } from './types'

const PATTERN = 'to stop forcing — to receive instead of push'

const ASKS = [
  { dateLabel: 'Feb 9', text: 'asked again to hold things loosely' },
  { dateLabel: 'Mar 22', text: 'prayed to stop white-knuckling the outcome' },
  { dateLabel: 'Apr 15', text: 'asked for the grace to let go and trust' },
]

export function loadPrayer(resolution: Resolution): PrayerData | null {
  // Prayer-pattern begins at the Hillside — the Valley stays close to raw days.
  if (resolution === 'week') return null

  if (resolution === 'month') {
    return {
      resolution,
      pattern: 'what you kept asking: to stop forcing',
      asks: ASKS.slice(0, 2).map((a) => ({ entryId: null, ...a })),
      stoneSet: false,
    }
  }

  if (resolution === 'quarter') {
    return {
      resolution,
      pattern: PATTERN,
      asks: ASKS.map((a) => ({ entryId: null, ...a })),
      // The quarter is where first signs appear alongside the ask.
      stoneSet: false,
    }
  }

  // Year — the prayer + the Ebenezer (the stone the user set).
  return {
    resolution,
    pattern: PATTERN,
    asks: ASKS.map((a) => ({
      entryId: null,
      ...a,
      evidence: { entryId: null, dateLabel: 'May 6', text: 'it came when I quit pushing' },
    })),
    ebenezer: {
      ask: 'to stop forcing',
      stone: 'He met me when I let go',
      entryId: null,
    },
    stoneSet: true,
  }
}
