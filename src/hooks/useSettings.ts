import { useSyncExternalStore } from 'react'
import { settingsStore, type Settings } from '@/lib/settings'

/** Reactive access to per-device settings. */
export function useSettings(): {
  settings: Settings
  update: (patch: Partial<Settings>) => void
} {
  const settings = useSyncExternalStore(settingsStore.subscribe, settingsStore.get)
  return { settings, update: settingsStore.update }
}
