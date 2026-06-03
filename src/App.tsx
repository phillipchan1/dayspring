import { useEffect, useState } from 'react'
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
import { FeedbackWidget } from './components/FeedbackWidget'
import { AppNavigationProvider } from './context/AppNavigation'
import { WelcomeProvider } from './features/welcome/WelcomeProvider'
import { PaywallScreen } from './features/paywall/PaywallScreen'
import { LockedScreen } from './features/paywall/LockedScreen'
import { TrialWelcome } from './features/paywall/TrialWelcome'
import { SurfaceLoader } from './components/SurfaceLoader'

// localStorage key used by useHasSeenWelcome — set before WelcomeProvider
// mounts so the first-run flow is suppressed for users coming through checkout.
const LS_WELCOME_KEY = 'dayspring.has_seen_welcome'

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
    return <div className="app-shell"><SurfaceLoader /></div>
  }

  if (!session) return <SignIn />

  return (
    <AppNavigationProvider>
      <AuthenticatedApp userEmail={session.user.email ?? ''} />
    </AppNavigationProvider>
  )
}

// Three-state machine for post-checkout flow.
// 'idle'    → normal app
// 'waiting' → just returned from Stripe, polling for webhook to fire
// 'ready'   → webhook confirmed, show "You're in!" screen
type CheckoutState = 'idle' | 'waiting' | 'ready'

function AuthenticatedApp({ userEmail }: { userEmail: string }) {
  const { subscription, entitled, featureFlags, loading, refetch } = useSubscription()

  const [checkoutState, setCheckoutState] = useState<CheckoutState>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'success') {
      // Clean the URL immediately so a refresh doesn't re-trigger.
      window.history.replaceState({}, '', window.location.pathname)
      return 'waiting'
    }
    return 'idle'
  })

  // Poll after checkout until the Stripe webhook updates the subscription.
  useEffect(() => {
    if (checkoutState !== 'waiting') return
    if (loading) return

    if (subscription && subscription.plan !== 'none') {
      setCheckoutState('ready')
      return
    }

    // Webhook not yet fired — poll every 2s (give up after ~30s).
    let attempts = 0
    const id = setInterval(() => {
      attempts++
      if (attempts > 15) {
        clearInterval(id)
        return
      }
      void refetch()
    }, 2000)

    return () => clearInterval(id)
  }, [checkoutState, loading, subscription?.plan, refetch])

  function handleTrialWelcomeDismiss() {
    // Mark welcome seen before WelcomeProvider mounts, so the first-run
    // flow is suppressed — TrialWelcome already served that purpose.
    try { localStorage.setItem(LS_WELCOME_KEY, 'true') } catch { /* ignore */ }
    setCheckoutState('idle')
  }

  if (loading) {
    return <div className="app-shell"><SurfaceLoader /></div>
  }

  // Waiting for the Stripe webhook — subscription hasn't updated yet.
  if (checkoutState === 'waiting') {
    return (
      <div className="center-screen">
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-dim)', fontSize: '1rem' }}>
          Setting up your account…
        </p>
      </div>
    )
  }

  // No subscription yet — welcome flow first (first-run only), then paywall.
  if (!subscription || subscription.plan === 'none') {
    return (
      <WelcomeProvider>
        <PaywallScreen />
      </WelcomeProvider>
    )
  }

  // Entitled but trial/payment lapsed — show locked screen.
  if (!entitled) {
    return <LockedScreen plan={subscription.plan} onRefetch={refetch} />
  }

  // Post-checkout celebration — shown once after returning from Stripe.
  if (checkoutState === 'ready') {
    const variant = subscription.plan === 'trialing' ? 'trial' : 'resubscribed'
    return <TrialWelcome variant={variant} onDismiss={handleTrialWelcomeDismiss} />
  }

  // Full app — WelcomeProvider only mounts once the user is entitled.
  return (
    <WelcomeProvider>
      <JournalScreen userEmail={userEmail} featureFlags={featureFlags} />
      <UpdateToast />
      <FeedbackWidget featureFlags={featureFlags} />
    </WelcomeProvider>
  )
}
