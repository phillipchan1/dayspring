import { useSyncExternalStore } from 'react'
import {
  checkForUpdate,
  getSnapshot,
  restartForUpdate,
  subscribe,
  type UpdateState,
} from '@/lib/appUpdate'

// Thin React binding over the shared desktop-update store. Subscribing also
// kicks off the background poll (idempotent). Both the toast and the Settings
// "Check for updates" button read the same state through this hook.
export function useAppUpdate(): {
  state: UpdateState
  check: () => Promise<void>
  restart: () => Promise<void>
} {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return {
    state,
    check: () => checkForUpdate(true),
    restart: restartForUpdate,
  }
}
