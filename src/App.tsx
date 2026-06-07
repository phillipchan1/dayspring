import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from './lib/env'
import { useSession } from './hooks/useSession'
import { useSettings } from './hooks/useSettings'
import { useSettingsSync } from './hooks/useSettingsSync'
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
import { TrialBanner } from './features/paywall/TrialBanner'
import { OnboardingFlow } from './features/onboarding/OnboardingFlow'
import { ONBOARDING_REQUIRE_CARD } from './features/onboarding/flags'
import { ensureProfile } from './lib/onboarding'
import { fenceCacheToOwner } from './lib/localData'
import { maybeBackfillOnLoad } from './lib/processingClient'
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
      <AuthenticatedApp userEmail={session.user.email ?? ''} ownerId={session.user.id} />
    </AppNavigationProvider>
  )
}

// Three-state machine for post-checkout flow.
// 'idle'    → normal app
// 'waiting' → just returned from Stripe, polling for webhook to fire
// 'ready'   → webhook confirmed, show "You're in!" screen
type CheckoutState = 'idle' | 'waiting' | 'ready'

function AuthenticatedApp({ userEmail, ownerId }: { userEmail: string; ownerId: string }) {
  useSettingsSync() // pull remote settings on login, push changes on edit
  const { subscription, entitled, featureFlags, loading, refetch } = useSubscription()

  // Initialize the account once on entry: ensures a profile row and, in the
  // default app-managed model, grants the 14-day reverse trial in Supabase (no
  // Stripe, no card). Idempotent. We gate routing on this so a brand-new user
  // never flashes a "no plan" state before the trial lands.
  const [initReady, setInitReady] = useState(false)
  useEffect(() => {
    let alive = true
    void (async () => {
      // Privacy fence FIRST — scrub any other owner's cached content before the
      // journal (and its sync) ever reads the cache. Then init the account.
      try {
        await fenceCacheToOwner(ownerId)
      } catch { /* idb unavailable — proceed */ }
      try {
        await ensureProfile()
      } catch { /* offline / not-yet-migrated — fall through to refetch */ }
      if (!alive) return
      setInitReady(true)
      void refetch()
      // Catch-up backfill for accounts with history but no processing yet.
      void maybeBackfillOnLoad()
    })()
    return () => { alive = false }
  }, [refetch, ownerId])

  const [bannerDismissed, setBannerDismissed] = useState(false)

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

  if (loading || !initReady) {
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

  // ONBOARDING_REQUIRE_CARD (card-first) only: a brand-new account with no plan
  // sees the trial/Checkout step BEFORE Welcome. In the default app-managed model
  // ensureProfile() has already granted the trial, so plan is never 'none' here.
  if (ONBOARDING_REQUIRE_CARD && (!subscription || subscription.plan === 'none')) {
    return <PaywallScreen />
  }

  // First-run: route into the welcome / import flow ahead of the editor,
  // regardless of entry count. Completing either path (or "Skip for now") stamps
  // onboarded_at, so it never reappears. Nothing here gates on entitlement — the
  // whole flow runs inside the already-active trial. The localStorage flag is a
  // belt-and-braces guard so an offline existing user is never misrouted here.
  const onboarded =
    subscription?.onboarded_at != null || hasLocalWelcomeFlag()
  if (!onboarded) {
    return <OnboardingFlow onFinish={refetch} />
  }

  // Entitled but trial/payment lapsed — show locked screen.
  if (!entitled || !subscription) {
    return <LockedScreen plan={subscription?.plan ?? 'none'} onRefetch={refetch} />
  }

  // Post-checkout celebration — shown once after returning from Stripe.
  if (checkoutState === 'ready') {
    const variant = subscription.plan === 'trialing' ? 'trial' : 'resubscribed'
    return <TrialWelcome variant={variant} onDismiss={handleTrialWelcomeDismiss} />
  }

  // Full app — WelcomeProvider only mounts once the user is entitled. The trial
  // banner appears ONLY here (never during onboarding), dismissible per session.
  const showTrialBanner = subscription.plan === 'trialing' && !bannerDismissed
  return (
    <WelcomeProvider>
      {showTrialBanner && (
        <TrialBanner subscription={subscription} onDismiss={() => setBannerDismissed(true)} />
      )}
      <JournalScreen userEmail={userEmail} featureFlags={featureFlags} />
      <UpdateToast />
      <FeedbackWidget featureFlags={featureFlags} />
    </WelcomeProvider>
  )
}

/** True when this device has already recorded the first-run flow as seen. */
function hasLocalWelcomeFlag(): boolean {
  try {
    return localStorage.getItem(LS_WELCOME_KEY) === 'true'
  } catch {
    return false
  }
}
