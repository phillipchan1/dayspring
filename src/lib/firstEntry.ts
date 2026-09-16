import { track } from './analytics'

// Fires `first_entry_created` the first time THIS DEVICE creates an entry.
// Same one-shot, device-local semantics as the Return-surface embers
// (surfaceEmbers.ts): a returning user's second device fires it again, which
// is the same known trade-off `surface_opened`'s `first` flag already makes.
// The flag is owner-scoped in lib/localData.ts's OWNER_SCOPED_FLAGS, so it
// resets on a genuine account change but survives sign-out/in as the same user.

const TRACKED_KEY = 'dayspring.first_entry_tracked'
const FIRST_SEEN_KEY = 'dayspring.first_seen_at'

/**
 * Call once at bootstrap (src/main.tsx), alongside `app_open`. Stamps this
 * device's earliest known moment — never overwritten once set. Read back by
 * `markFirstEntryIfNeeded` below to compute `minutes_to_first_entry_bucket`.
 * A device-local proxy for "trial start": the offline-first repo layer that
 * fires `first_entry_created` has no cheap, synchronous way to read the
 * account's real trial-start time.
 */
export function markDeviceFirstSeen(): void {
  try {
    if (localStorage.getItem(FIRST_SEEN_KEY)) return
    localStorage.setItem(FIRST_SEEN_KEY, String(Date.now()))
  } catch {
    /* private mode — the bucket below just won't compute */
  }
}

type MinutesBucket = '0_5' | '5_30' | '30_1440' | '1440_plus'

function minutesToFirstEntryBucket(): MinutesBucket | null {
  try {
    const raw = localStorage.getItem(FIRST_SEEN_KEY)
    if (!raw) return null
    const minutes = (Date.now() - Number(raw)) / 60_000
    if (!Number.isFinite(minutes) || minutes < 0) return null
    if (minutes <= 5) return '0_5'
    if (minutes <= 30) return '5_30'
    if (minutes <= 1440) return '30_1440'
    return '1440_plus'
  } catch {
    return null
  }
}

/** Call after a successful local entry creation. No-op after the first call. */
export function markFirstEntryIfNeeded(): void {
  try {
    if (localStorage.getItem(TRACKED_KEY)) return
    localStorage.setItem(TRACKED_KEY, '1')
  } catch {
    return // private mode — skip rather than risk double-counting
  }
  track('first_entry_created')
  const bucket = minutesToFirstEntryBucket()
  if (bucket) track('minutes_to_first_entry_bucket', { bucket })
}
