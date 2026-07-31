import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { isAuthInvalidation, forceReauth } from '@/lib/authError'
import { rememberAuthProvider } from '@/lib/lastAuthProvider'

/**
 * Validate a locally-cached session against the server. getSession() only reads
 * the stored JWT, so a deleted/disabled account would otherwise linger showing
 * stale cached data as 'offline'. getUser() hits the server; on a definitive
 * auth rejection (not a network blip) we sign out → drop to login.
 */
function validateUser(sb: NonNullable<typeof supabase>): void {
  void sb.auth.getUser().then(({ error }) => {
    if (error && isAuthInvalidation(error)) void forceReauth()
  })
}

export interface SessionState {
  session: Session | null
  loading: boolean
}

/** Tracks the current Supabase auth session and keeps it in sync. */
export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = supabase
    if (!sb) {
      setLoading(false)
      return
    }

    let settled = false
    const settle = (next: Session | null) => {
      if (settled) return
      settled = true
      setSession(next)
      setLoading(false)
    }

    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((event, next) => {
      setSession(next)

      // Remember which button worked, so the sign-in screen can remind this
      // device next time instead of letting it start a second account.
      // app_metadata.provider is the most recent sign-in's provider.
      if (next) rememberAuthProvider(next.user?.app_metadata?.provider)

      if (event !== 'INITIAL_SESSION') return

      if (next) {
        settle(next)
        validateUser(sb) // confirm the user still exists server-side
        return
      }

      // Stored refresh token may still be valid even when access session is empty.
      void sb.auth.refreshSession().then(({ data: { session: refreshed } }) => {
        settle(refreshed)
        if (refreshed) validateUser(sb)
      })
    })

    // Safety net if INITIAL_SESSION never fires (shouldn't happen on current auth-js).
    const fallback = window.setTimeout(() => {
      if (settled) return
      void sb.auth.getSession().then(({ data: { session: s } }) => settle(s))
    }, 5000)

    return () => {
      clearTimeout(fallback)
      subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}
