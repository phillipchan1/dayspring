/**
 * Device-local owner for a guest journal.
 *
 * The IndexedDB cache and `fenceCacheToOwner` key rows by an owner string.
 * Signed-in users use the Supabase auth UUID. A guest needs a stable id that:
 *
 *   1. Survives cold launches on this device (same journal tomorrow).
 *   2. Cannot collide with a real auth UUID, so fencing a later sign-in is an
 *      explicit guest → account transition rather than a silent same-id match.
 *   3. Is never sent to the server — it is not an account.
 */

export const GUEST_OWNER_KEY = 'dayspring.guest_owner_id'
export const GUEST_OWNER_PREFIX = 'local:'

export function isGuestOwnerId(id: string): boolean {
  return id.startsWith(GUEST_OWNER_PREFIX)
}

export function readGuestOwnerId(): string | null {
  try {
    const raw = localStorage.getItem(GUEST_OWNER_KEY)
    if (raw && isGuestOwnerId(raw)) return raw
    return null
  } catch {
    return null
  }
}

/** Persist-or-create the device-local guest owner. Stable across launches. */
export function getOrCreateGuestOwnerId(): string {
  const existing = readGuestOwnerId()
  if (existing) return existing
  const id = `${GUEST_OWNER_PREFIX}${crypto.randomUUID()}`
  try {
    localStorage.setItem(GUEST_OWNER_KEY, id)
  } catch {
    /* private mode — still return a usable id for this session */
  }
  return id
}
