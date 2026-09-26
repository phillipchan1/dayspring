import { useEffect, useSyncExternalStore } from 'react'
import {
  getSessionState,
  startSessionStore,
  subscribeSession,
  type SessionState,
} from '@/lib/sessionStore'

export type { SessionState }

/**
 * The current Supabase auth session. Every caller reads the same shared store
 * (lib/sessionStore.ts), so a component mounting mid-session sees the session
 * on its first render instead of starting from null.
 */
export function useSession(): SessionState {
  useEffect(() => {
    void startSessionStore()
  }, [])
  return useSyncExternalStore(subscribeSession, getSessionState)
}
