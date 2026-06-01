import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_APP_HISTORY,
  appHistoryEqual,
  isAppHistoryState,
  mergeAppHistory,
  pushAppHistory,
  readAppHistoryState,
  replaceAppHistory,
  stripAuthUrlNoise,
  type AppHistoryState,
} from '@/lib/appHistory'

interface AppNavigationValue {
  state: AppHistoryState
  /** Navigate forward in app state; pushes a browser history entry unless `replace`. */
  go: (patch: Partial<AppHistoryState>, opts?: { replace?: boolean }) => void
  /** Pop one in-app history frame (mouse back, Android back, overlay close). */
  back: () => void
}

const AppNavigationContext = createContext<AppNavigationValue | null>(null)

export function AppNavigationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppHistoryState>(
    () => readAppHistoryState() ?? DEFAULT_APP_HISTORY,
  )
  const stateRef = useRef(state)
  stateRef.current = state
  const seededRef = useRef(false)

  const commit = useCallback((next: AppHistoryState, replace: boolean) => {
    stateRef.current = next
    setState(next)
    if (replace) replaceAppHistory(next)
    else pushAppHistory(next)
  }, [])

  const go = useCallback(
    (patch: Partial<AppHistoryState>, opts?: { replace?: boolean }) => {
      const next = mergeAppHistory(stateRef.current, patch)
      if (!opts?.replace && appHistoryEqual(next, stateRef.current)) return
      commit(next, Boolean(opts?.replace))
    },
    [commit],
  )

  const back = useCallback(() => {
    history.back()
  }, [])

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const next = isAppHistoryState(event.state)
        ? event.state
        : readAppHistoryState()
      if (!next) return
      stateRef.current = next
      setState(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // One baseline frame so the first Back closes an overlay instead of leaving the app.
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    stripAuthUrlNoise()
    const current = readAppHistoryState()
    if (!current) replaceAppHistory(stateRef.current)
    else {
      stateRef.current = current
      setState(current)
    }
  }, [])

  const value = useMemo(() => ({ state, go, back }), [state, go, back])

  return (
    <AppNavigationContext.Provider value={value}>
      {children}
    </AppNavigationContext.Provider>
  )
}

export function useAppNavigation(): AppNavigationValue {
  const ctx = useContext(AppNavigationContext)
  if (!ctx) throw new Error('useAppNavigation must be used within AppNavigationProvider')
  return ctx
}
