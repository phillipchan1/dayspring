import { useEffect } from 'react'
import { isSupabaseConfigured } from './lib/env'
import { useSession } from './hooks/useSession'
import { useSettings } from './hooks/useSettings'
import { useResolvedTheme } from './hooks/useResolvedTheme'
import { useSubscription } from './hooks/useSubscription'
import { EDITOR_FONT_VARS } from './lib/settings'
import { SetupNotice } from './components/SetupNotice'
import { SignIn } from './components/SignIn'
import { JournalScreen } from './features/journal/JournalScreen'
import { UpdateToast } from './components/UpdateToast'
import { AppNavigationProvider } from './context/AppNavigation'
import { WelcomeProvider } from './features/welcome/WelcomeProvider'
import { PaywallScreen } from './features/paywall/PaywallScreen'
import { LockedScreen } from './features/paywall/LockedScreen'
import { TrialBanner } from './features/paywall/TrialBanner'

export function App() {
  const { session, loading } = useSession()
  const { settings } = useSettings()
  const resolvedTheme = useResolvedTheme(settings)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', resolvedTheme)
    root.style.setProperty('--editor-font-size', `${settings.fontSize}px`)
    root.style.setProperty('--editor-line-height', String(settings.lineHeight))
    root.style.setProperty('--editor-max-width', `${settings.maxWidth}rem`)
    root.style.setProperty('--font-editor', EDITOR_FONT_VARS[settings.editorFont])
  }, [resolvedTheme, settings.fontSize, settings.lineHeight, settings.maxWidth, settings.editorFont])

  if (!isSupabaseConfigured) return <SetupNotice />

  if (loading) {
    return <div className="center-screen" style={{ color: 'var(--text-dim)' }}>Loading…</div>
  }

  if (!session) return <SignIn />

  return (
    <AppNavigationProvider>
      <WelcomeProvider>
        <AuthenticatedApp userEmail={session.user.email ?? ''} />
      </WelcomeProvider>
    </AppNavigationProvider>
  )
}

function AuthenticatedApp({ userEmail }: { userEmail: string }) {
  const { subscription, entitled, loading, refetch } = useSubscription()

  if (loading) {
    return <div className="center-screen" style={{ color: 'var(--text-dim)' }}>Loading…</div>
  }

  // No subscription yet — prompt to start a trial.
  if (!subscription || subscription.plan === 'none') {
    return <PaywallScreen />
  }

  // Trial or payment problem — subscription exists but access is revoked.
  if (!entitled) {
    return <LockedScreen plan={subscription.plan} onRefetch={refetch} />
  }

  return (
    <>
      {subscription.plan === 'trialing' && <TrialBanner subscription={subscription} />}
      <JournalScreen userEmail={userEmail} />
      <UpdateToast />
    </>
  )
}
