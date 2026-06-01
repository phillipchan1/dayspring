import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

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

      if (event !== 'INITIAL_SESSION') return

      if (next) {
        settle(next)
        return
      }

      // Stored refresh token may still be valid even when access session is empty.
      void sb.auth.refreshSession().then(({ data: { session: refreshed } }) => {
        settle(refreshed)
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
