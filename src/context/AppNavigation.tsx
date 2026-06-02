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
  isLegacyScripturePath,
  mergeAppHistory,
  normalizePathname,
  pathForSurface,
  pushAppHistory,
  readAppHistoryState,
  replaceAppHistory,
  stripAuthUrlNoise,
  surfaceFromPath,
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
      let next = isAppHistoryState(event.state)
        ? event.state
        : readAppHistoryState()
      if (!next) {
        const fromPath = surfaceFromPath(window.location.pathname)
        if (!fromPath) return
        next = mergeAppHistory(DEFAULT_APP_HISTORY, { surface: fromPath })
      }
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

    const pathSurface = surfaceFromPath(window.location.pathname)
    let current = readAppHistoryState()

    if (isLegacyScripturePath(window.location.pathname)) {
      current = mergeAppHistory(current ?? DEFAULT_APP_HISTORY, {
        surface: 'scripture',
        entryId: null,
        settings: null,
        help: false,
        sidebar: false,
        scriptureBook: null,
        scriptureVerse: null,
      })
    } else if (pathSurface) {
      current = mergeAppHistory(current ?? DEFAULT_APP_HISTORY, {
        surface: pathSurface,
        entryId: null,
        settings: null,
        help: false,
        sidebar: false,
        scriptureBook: null,
        scriptureVerse: null,
      })
    }

    if (!current) {
      replaceAppHistory(stateRef.current)
      return
    }

    stateRef.current = current
    setState(current)

    const expectedPath = pathForSurface(current.surface)
    if (normalizePathname(window.location.pathname) !== expectedPath) {
      replaceAppHistory(current)
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
