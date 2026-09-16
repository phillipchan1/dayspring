import { track } from './analytics'

// Fires `first_entry_created` the first time THIS DEVICE creates an entry.
// Same one-shot, device-local semantics as the Return-surface embers
// (surfaceEmbers.ts): a returning user's second device fires it again, which
// is the same known trade-off `surface_opened`'s `first` flag already makes.
// The flag is owner-scoped in lib/localData.ts's OWNER_SCOPED_FLAGS, so it
// resets on a genuine account change but survives sign-out/in as the same user.

const KEY = 'dayspring.first_entry_tracked'

/** Call after a successful local entry creation. No-op after the first call. */
export function markFirstEntryIfNeeded(): void {
  try {
    if (localStorage.getItem(KEY)) return
    localStorage.setItem(KEY, '1')
  } catch {
    return // private mode — skip rather than risk double-counting
  }
  track('first_entry_created')
}
