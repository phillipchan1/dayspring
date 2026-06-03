// Syncs settings between localStorage and the cloud (profiles.settings) so
// the user's preferences — font, size, appearance, etc — follow them across
// desktop and web.
//
// Strategy:
//   • On login: pull remote settings and apply them (remote wins — they
//     represent intentional choices made on another device).
//   • On every local change: debounce-save to remote (1.5 s after last change).
//
// localStorage is still written immediately for instant UI response.
// Remote load/save are both best-effort: a network failure is silent.

import { useEffect } from 'react'
import { useSession } from './useSession'
import { useSettings } from './useSettings'
import { settingsStore } from '@/lib/settings'
import { loadRemoteSettings, saveRemoteSettings } from '@/lib/profile'

export function useSettingsSync() {
  const { session } = useSession()
  const { settings } = useSettings()
  const userId = session?.user.id

  // Pull remote settings on login and apply. Remote is the cross-device
  // source of truth; local defaults are just a fallback.
  useEffect(() => {
    if (!userId) return
    loadRemoteSettings()
      .then((remote) => {
        if (remote) settingsStore.applyRemote(remote)
      })
      .catch(() => {
        // best-effort — network failure leaves local settings intact
      })
  }, [userId])

  // Debounce-save every settings change to the cloud.
  // 1.5 s delay: fast enough to feel real-time, slow enough to batch
  // slider drags without hammering the DB.
  useEffect(() => {
    if (!userId) return
    const timer = setTimeout(() => {
      saveRemoteSettings(settings).catch(() => {
        // best-effort — silently ignore network errors
      })
    }, 1500)
    return () => clearTimeout(timer)
  }, [settings, userId])
}
