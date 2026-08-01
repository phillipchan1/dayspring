// Syncs settings between localStorage and the cloud (profiles.settings) so
// the user's preferences — font, size, appearance, etc — follow them across
// desktop, web and phone.
//
// Strategy:
//   • On login: pull remote settings and apply them (remote wins — they
//     represent intentional choices made on another device).
//   • On every local change AFTER that pull has settled: debounce-save to remote.
//
// localStorage is still written immediately for instant UI response.
//
// The push waits for the pull deliberately. It used to fire unconditionally 1.5s
// after mount, without regard for whether the pull had returned — and
// loadRemoteSettings answered null for a failed fetch as readily as for "nothing
// saved yet". So signing in on a new device with a slow or briefly-broken
// connection pushed that device's DEFAULTS over the settings the user had chosen
// on their other one. There are no per-field timestamps here; the write is
// whole-object, so getting the order right is the whole defence.

import { useEffect, useRef, useState } from 'react'
import { useSession } from './useSession'
import { useSettings } from './useSettings'
import { settingsStore } from '@/lib/settings'
import { loadRemoteSettings, saveRemoteSettings } from '@/lib/profile'

export function useSettingsSync() {
  const { session } = useSession()
  const { settings } = useSettings()
  const userId = session?.user.id
  // Null until the initial pull for THIS user resolves; holds the user id it
  // resolved for, so switching accounts re-arms the gate.
  const [pulledFor, setPulledFor] = useState<string | null>(null)
  const lastPushedRef = useRef<string | null>(null)

  // Pull remote settings on login and apply. Remote is the cross-device source
  // of truth; local values are a fallback.
  useEffect(() => {
    if (!userId) return
    let alive = true
    void (async () => {
      try {
        const remote = await loadRemoteSettings()
        if (!alive) return
        if (remote) {
          settingsStore.applyRemote(remote)
          // Remote just won; don't immediately push the same thing back.
          lastPushedRef.current = JSON.stringify(settingsStore.get())
        }
        // Reached the server: this account has no saved settings, so this
        // device's are worth uploading. Open the gate.
        setPulledFor(userId)
      } catch {
        // Could NOT reach the server. Leave the gate shut: pushing now would
        // overwrite whatever is really up there with local defaults. The next
        // sign-in (or reload) tries again.
      }
    })()
    return () => {
      alive = false
    }
  }, [userId])

  // Debounce-save changes to the cloud, but only once the pull has settled.
  // 1.5s: fast enough to feel immediate, slow enough to batch a slider drag.
  useEffect(() => {
    if (!userId || pulledFor !== userId) return
    const serialized = JSON.stringify(settings)
    if (serialized === lastPushedRef.current) return
    const timer = setTimeout(() => {
      lastPushedRef.current = serialized
      saveRemoteSettings(settings).catch(() => {
        // Best-effort. Clear the marker so the next change retries this state
        // rather than assuming it landed.
        lastPushedRef.current = null
      })
    }, 1500)
    return () => clearTimeout(timer)
  }, [settings, userId, pulledFor])
}
