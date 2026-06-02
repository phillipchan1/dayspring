import { useCallback, useEffect, useState } from 'react'
import { getWelcomeSeen, setWelcomeSeen } from '@/lib/profile'

const LS_KEY = 'dayspring.has_seen_welcome'

interface HasSeenWelcome {
  /** False until we've resolved local + server state (avoids a first-paint flash). */
  ready: boolean
  /** True only on a confirmed first run — mount the flow. */
  shouldShow: boolean
  /** Mark seen everywhere (localStorage now, Supabase best-effort). */
  markSeen: () => void
}

/**
 * Resolves whether to show the first-run Welcome flow.
 *
 * localStorage is the offline-first source of truth so a brand-new or offline
 * first session still shows the flow exactly once. The Supabase `profiles` flag
 * is the cross-device backstop: if you saw it on another device, you won't see
 * it again here even though this device's localStorage is empty.
 */
export function useHasSeenWelcome(): HasSeenWelcome {
  // null = still resolving.
  const [seen, setSeen] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    // If this device already recorded it, trust that and skip the network.
    if (localStorage.getItem(LS_KEY) === 'true') {
      setSeen(true)
      return
    }

    // Otherwise ask the server — the flag may be true from another device.
    getWelcomeSeen()
      .then((serverSeen) => {
        if (cancelled) return
        if (serverSeen) {
          try {
            localStorage.setItem(LS_KEY, 'true')
          } catch {
            /* private mode / quota — fine, server still knows */
          }
        }
        setSeen(serverSeen)
      })
      .catch(() => {
        // Offline, or the profiles table isn't migrated yet: treat as a first run.
        // localStorage keeps it to exactly once after the user dismisses.
        if (!cancelled) setSeen(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(LS_KEY, 'true')
    } catch {
      /* ignore */
    }
    setSeen(true)
    void setWelcomeSeen().catch(() => {
      // Non-fatal — localStorage already prevents a re-show on this device.
    })
  }, [])

  return { ready: seen !== null, shouldShow: seen === false, markSeen }
}
