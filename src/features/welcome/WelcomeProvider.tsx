import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAppNavigation } from '@/context/AppNavigation'
import { useSettings } from '@/hooks/useSettings'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'
import { isLightTheme } from '@/lib/resolveTheme'
import { useHasSeenWelcome } from './useHasSeenWelcome'
import { WelcomeFlow } from './WelcomeFlow'

interface WelcomeValue {
  /** Re-open the Welcome flow as a one-off overlay (does NOT reset the flag). */
  replay: () => void
}

const WelcomeContext = createContext<WelcomeValue | null>(null)

/**
 * Owns the first-run Welcome flow and its replay entry point. Renders the
 * overlay (via the flow's own portal) when it's a confirmed first run, or when
 * replay() is called from Settings. Must live inside AppNavigationProvider so
 * "Begin" can route into a fresh entry.
 */
export function WelcomeProvider({ children }: { children: ReactNode }) {
  const { ready, shouldShow, markSeen } = useHasSeenWelcome()
  const { go } = useAppNavigation()
  const { settings, update: updateSettings } = useSettings()
  const isLight = isLightTheme(useResolvedTheme(settings))
  const [replaying, setReplaying] = useState(false)

  // The welcome's theme toggle sets the app's appearance, so the choice the user
  // makes here carries straight through to the app when they Begin.
  const toggleTheme = useCallback(() => {
    updateSettings({ appearance: isLight ? 'dark' : 'light' })
  }, [isLight, updateSettings])

  const mode: 'hidden' | 'first-run' | 'replay' = replaying
    ? 'replay'
    : ready && shouldShow
      ? 'first-run'
      : 'hidden'

  // Skip / Esc. First-run records the flag; replay is a one-off view.
  const handleClose = useCallback(() => {
    if (mode === 'replay') setReplaying(false)
    else markSeen()
  }, [mode, markSeen])

  // Begin. First-run records the flag and drops the user into a fresh entry;
  // replay just closes (the user is mid-session and shouldn't lose their place).
  const handleBegin = useCallback(() => {
    if (mode === 'replay') {
      setReplaying(false)
      return
    }
    markSeen()
    go({ surface: 'journal', entryId: null })
  }, [mode, markSeen, go])

  const value = useMemo<WelcomeValue>(() => ({ replay: () => setReplaying(true) }), [])

  return (
    <WelcomeContext.Provider value={value}>
      {children}
      {mode !== 'hidden' && (
        <WelcomeFlow
          onClose={handleClose}
          onBegin={handleBegin}
          isLight={isLight}
          onToggleTheme={toggleTheme}
        />
      )}
    </WelcomeContext.Provider>
  )
}

export function useWelcome(): WelcomeValue {
  const ctx = useContext(WelcomeContext)
  if (!ctx) throw new Error('useWelcome must be used within WelcomeProvider')
  return ctx
}
