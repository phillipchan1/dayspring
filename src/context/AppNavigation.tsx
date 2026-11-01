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
  keyboardHistoryAction,
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
import { isTypingContext } from '@/features/journal/keyboard'

/**
 * How long a coalesced replace waits for the stepping to pause. WebKit throws a
 * SecurityError past ~100 history writes in 30 seconds, and a held ⌥← steps the
 * Ascent's period thirty times a second — so the state moves at once and the
 * frame catches up when the reader stops.
 */
const COALESCE_MS = 200

/** A replace the host may refuse: the frame is a convenience for Back, never worth a crash. */
function writeFrame(state: AppHistoryState): void {
  try {
    replaceAppHistory(state)
  } catch {
    addBreadcrumb('navigation', 'history replace refused')
  }
}

interface AppNavigationValue {
  state: AppHistoryState
  /**
   * Navigate forward in app state; pushes a browser history entry unless `replace`.
   * `coalesce` (with `replace`) is for a position changed many times a second —
   * the state moves now, the frame is written once the changes pause.
   */
  go: (patch: Partial<AppHistoryState>, opts?: { replace?: boolean; coalesce?: boolean }) => void
  /** Pop one in-app history frame (mouse back, Android back, overlay close). */
  back: () => void
  /** Hold a history pop until the active editor has flushed its latest text. */
  setHistoryPopBarrier: (barrier: (() => Promise<void>) | null) => void
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
  const historyPopBarrierRef = useRef<(() => Promise<void>) | null>(null)
  const popSequenceRef = useRef(0)
  const pendingWriteRef = useRef<number | null>(null)

  const dropPendingWrite = useCallback(() => {
    if (pendingWriteRef.current === null) return
    window.clearTimeout(pendingWriteRef.current)
    pendingWriteRef.current = null
  }, [])

  /** Write a deferred replace now, if there is one. Before anything that pushes:
   *  what sits beneath the new frame is where Back lands. */
  const flushPendingWrite = useCallback(() => {
    if (pendingWriteRef.current === null) return
    dropPendingWrite()
    writeFrame(stateRef.current)
  }, [dropPendingWrite])

  const setHistoryPopBarrier = useCallback(
    (barrier: (() => Promise<void>) | null) => {
      historyPopBarrierRef.current = barrier
    },
    [],
  )

  const commit = useCallback((next: AppHistoryState, replace: boolean, coalesce: boolean) => {
    const prev = stateRef.current
    if (!replace) flushPendingWrite()
    stateRef.current = next
    setState(next)
    if (replace && coalesce) {
      dropPendingWrite()
      pendingWriteRef.current = window.setTimeout(() => {
        pendingWriteRef.current = null
        writeFrame(stateRef.current)
      }, COALESCE_MS)
    } else if (replace) {
      dropPendingWrite()
      writeFrame(next)
    } else {
      pushAppHistory(next)
    }
    // Breadcrumb for crash reports — log surface changes and settings opens.
    if (prev.surface !== next.surface) {
      addBreadcrumb('navigation', `opened ${next.surface}`)
    } else if (!prev.settings && next.settings) {
      addBreadcrumb('navigation', `opened settings:${next.settings.tab}`)
    }
  }, [flushPendingWrite, dropPendingWrite])

  const go = useCallback(
    (patch: Partial<AppHistoryState>, opts?: { replace?: boolean; coalesce?: boolean }) => {
      const next = mergeAppHistory(stateRef.current, patch)
      if (appHistoryEqual(next, stateRef.current)) return
      commit(next, Boolean(opts?.replace), Boolean(opts?.coalesce))
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
      // The stack has moved: a replace still waiting would land on the frame we
      // arrived at, not the one it was meant for.
      dropPendingWrite()
      const sequence = ++popSequenceRef.current
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
      const commitPop = async () => {
        // history.back()/forward() moves the browser stack before popstate.
        // Hold the React transition for the editor's flush so rapid side-button
        // navigation cannot reset the autosave session out from under its last
        // keystrokes. If another pop arrives while saving, only the newest
        // destination commits.
        try {
          await historyPopBarrierRef.current?.()
        } catch {
          // The editor owns the visible save error. Navigation must not become
          // a dead end because persistence failed.
          addBreadcrumb('navigation', 'history flush failed')
        }
        if (sequence !== popSequenceRef.current) return
        stateRef.current = next
        setState(next)
      }
      void commitPop()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [dropPendingWrite])

  // A reload or a closed window must not lose the last few steps.
  useEffect(() => {
    const flush = () => flushPendingWrite()
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flushPendingWrite])

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

  // ⌘[ / ⌘] — the same stack, from the keyboard. Most Mac mouse drivers send
  // their Back button as this chord rather than as button 3, and the app has no
  // browser chrome to catch it, so the side button was simply dead. Not while
  // typing: in the editor ⌘[ is "outdent" (Esc and the Back control still leave).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const action = keyboardHistoryAction(event)
      if (!action || event.repeat) return
      if (isTypingContext(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      if (action === 'back') history.back()
      else history.forward()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
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
        ascentOffset: 0,
        ascentSeat: null,
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
        ascentOffset: 0,
        ascentSeat: null,
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

  const value = useMemo(
    () => ({ state, go, back, setHistoryPopBarrier, closeSettings }),
    [state, go, back, setHistoryPopBarrier, closeSettings],
  )

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
