import { useEffect } from 'react'
import { isSupabaseConfigured } from './lib/env'
import { useSession } from './hooks/useSession'
import { useSettings } from './hooks/useSettings'
import { useResolvedTheme } from './hooks/useResolvedTheme'
import { EDITOR_FONT_VARS } from './lib/settings'
import { SetupNotice } from './components/SetupNotice'
import { SignIn } from './components/SignIn'
import { JournalScreen } from './features/journal/JournalScreen'
import { UpdateToast } from './components/UpdateToast'
import { AppNavigationProvider } from './context/AppNavigation'

export function App() {
  const { session, loading } = useSession()
  const { settings } = useSettings()
  const resolvedTheme = useResolvedTheme(settings)

  // Apply per-device appearance (theme + editor typography) to CSS custom props.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', resolvedTheme)
    root.style.setProperty('--editor-font-size', `${settings.fontSize}px`)
    root.style.setProperty('--editor-line-height', String(settings.lineHeight))
    root.style.setProperty('--editor-max-width', `${settings.maxWidth}rem`)
    // The writing/reading face — one token reskins both editor and reader.
    // Reflections keeps Fraunces/Newsreader regardless (don't touch those tokens).
    root.style.setProperty('--font-editor', EDITOR_FONT_VARS[settings.editorFont])
  }, [resolvedTheme, settings.fontSize, settings.lineHeight, settings.maxWidth, settings.editorFont])

  // Before keys exist, the app still boots and tells you what to configure.
  if (!isSupabaseConfigured) return <SetupNotice />

  if (loading) {
    return <div className="center-screen" style={{ color: 'var(--text-dim)' }}>Loading…</div>
  }

  if (!session) return <SignIn />

  return (
    <AppNavigationProvider>
      <AuthenticatedApp userEmail={session.user.email ?? ''} />
    </AppNavigationProvider>
  )
}

function AuthenticatedApp({ userEmail }: { userEmail: string }) {
  return (
    <>
      <JournalScreen userEmail={userEmail} />
      <UpdateToast />
    </>
  )
}
