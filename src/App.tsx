import { useEffect } from 'react'
import { isSupabaseConfigured } from './lib/env'
import { useSession } from './hooks/useSession'
import { isAllowedEmail } from './lib/auth'
import { useSettings } from './hooks/useSettings'
import { SetupNotice } from './components/SetupNotice'
import { SignIn } from './components/SignIn'
import { NotAllowed } from './components/NotAllowed'
import { JournalScreen } from './features/journal/JournalScreen'

export function App() {
  const { session, loading } = useSession()
  const { settings } = useSettings()

  // Apply per-device appearance (theme + editor typography) to CSS custom props.
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', settings.theme)
    root.style.setProperty('--editor-font-size', `${settings.fontSize}px`)
    root.style.setProperty('--editor-line-height', String(settings.lineHeight))
    root.style.setProperty('--editor-max-width', `${settings.maxWidth}rem`)
  }, [settings.theme, settings.fontSize, settings.lineHeight, settings.maxWidth])

  // Before keys exist, the app still boots and tells you what to configure.
  if (!isSupabaseConfigured) return <SetupNotice />

  if (loading) {
    return <div className="center-screen" style={{ color: 'var(--text-dim)' }}>Loading…</div>
  }

  if (!session) return <SignIn />

  // Single-user lock: reject any account that isn't the allowlisted one.
  if (!isAllowedEmail(session.user.email)) {
    return <NotAllowed email={session.user.email ?? null} />
  }

  return <JournalScreen userEmail={session.user.email ?? ''} />
}
