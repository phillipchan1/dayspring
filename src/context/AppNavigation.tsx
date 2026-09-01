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
  mouseHistoryAction,
  mouseHistoryNeedsFallback,
  normalizeAppHistory,
  normalizePathname,
  pathForSurface,
  pushAppHistory,
  readAppHistoryState,
  replaceAppHistory,
  stripAuthUrlNoise,
  surfaceFromPath,
  type AppHistoryState,
} from '@/lib/appHistory'
import { addBreadcrumb } from '@/lib/crashReport'

interface AppNavigationValue {
  state: AppHistoryState
  /** Navigate forward in app state; pushes a browser history entry unless `replace`. */
  go: (patch: Partial<AppHistoryState>, opts?: { replace?: boolean }) => void
  /** Pop one in-app history frame (mouse back, Android back, overlay close). */
  back: () => void
  /** Close settings, including an open Import source detail if one is on the stack. */
  closeSettings: () => void
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
    const prev = stateRef.current
    stateRef.current = next
    setState(next)
    if (replace) replaceAppHistory(next)
    else pushAppHistory(next)
    // Breadcrumb for crash reports — log surface changes and settings opens.
    if (prev.surface !== next.surface) {
      addBreadcrumb('navigation', `opened ${next.surface}`)
    } else if (!prev.settings && next.settings) {
      addBreadcrumb('navigation', `opened settings:${next.settings.tab}`)
    }
  }, [])

  const go = useCallback(
    (patch: Partial<AppHistoryState>, opts?: { replace?: boolean }) => {
      const next = mergeAppHistory(stateRef.current, patch)
      if (appHistoryEqual(next, stateRef.current)) return
      commit(next, Boolean(opts?.replace))
    },
    [commit],
  )

  const back = useCallback(() => {
    history.back()
  }, [])

  const closeSettings = useCallback(() => {
    const s = stateRef.current
    if (!s.settings) return
    const delta = s.settings.importSource ? -2 : -1
    history.go(delta)
  }, [])

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      let next = isAppHistoryState(event.state)
        ? event.state
        : isAppHistoryState(history.state)
          ? history.state
          : readAppHistoryState()
      if (!next) {
        const fromPath = surfaceFromPath(window.location.pathname)
        if (!fromPath) {
          // Mouse / swipe Back landed on a frame we never tagged (the original
          // document load, or a leftover `replaceState({}, …)`). Stay in the
          // app rather than ignoring the pop and leaving UI and history split.
          replaceAppHistory(stateRef.current)
          return
        }
        next = mergeAppHistory(DEFAULT_APP_HISTORY, { surface: fromPath })
      }
      next = normalizeAppHistory(next)
      stateRef.current = next
      setState(next)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Mouse Back / Forward — the same stack as the in-app Back button, Esc, and
  // Android back. Capture so CodeMirror never swallows the side buttons.
  useEffect(() => {
    const block = (event: MouseEvent) => {
      if (!mouseHistoryAction(event.button)) return
      event.preventDefault()
      event.stopPropagation()
    }
    const onUp = (event: MouseEvent) => {
      const action = mouseHistoryAction(event.button)
      if (!action) return
      block(event)
      const before = history.state
      window.setTimeout(() => {
        if (!mouseHistoryNeedsFallback(before, history.state)) return
        if (action === 'back') history.back()
        else history.forward()
      }, 0)
    }
    window.addEventListener('mousedown', block, true)
    window.addEventListener('mouseup', onUp, true)
    window.addEventListener('auxclick', block, true)
    return () => {
      window.removeEventListener('mousedown', block, true)
      window.removeEventListener('mouseup', onUp, true)
      window.removeEventListener('auxclick', block, true)
    }
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
        scriptureBook: null,
        scriptureVerse: null,
        entryReturn: null,
        ascentAltitude: 0,
        ascentDrill: null,
      })
    } else if (pathSurface) {
      current = mergeAppHistory(current ?? DEFAULT_APP_HISTORY, {
        surface: pathSurface,
        entryId: null,
        settings: null,
        help: false,
        scriptureBook: null,
        scriptureVerse: null,
        entryReturn: null,
        ascentAltitude: 0,
        ascentDrill: null,
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

  const value = useMemo(() => ({ state, go, back, closeSettings }), [state, go, back, closeSettings])

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
