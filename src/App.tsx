import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from './lib/env'
import { useSession } from './hooks/useSession'
import { useSettings } from './hooks/useSettings'
import { useSettingsSync } from './hooks/useSettingsSync'
import { useResolvedTheme } from './hooks/useResolvedTheme'
import { isLightTheme } from './lib/resolveTheme'
import { useSubscription } from './hooks/useSubscription'
import { EDITOR_FONT_VARS } from './lib/settings'
import { SetupNotice } from './components/SetupNotice'
import { SignIn } from './components/SignIn'
import { JournalScreen } from './features/journal/JournalScreen'
import { UpdateToast } from './components/UpdateToast'
import { FeedbackWidget } from './components/FeedbackWidget'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AppNavigationProvider, useAppNavigation } from './context/AppNavigation'
import { WelcomeProvider } from './features/welcome/WelcomeProvider'
import { PaywallScreen } from './features/paywall/PaywallScreen'
import { LockedScreen } from './features/paywall/LockedScreen'
import { TrialWelcome } from './features/paywall/TrialWelcome'
import { TrialBanner } from './features/paywall/TrialBanner'
import { OnboardingFlow } from './features/onboarding/OnboardingFlow'
import { ONBOARDING_REQUIRE_CARD } from './features/onboarding/flags'
import { ensureProfile } from './lib/onboarding'
import { fenceCacheToOwner } from './lib/localData'
import { registerEntryDerive } from './lib/entryDerive'
import { maybeBackfillOnLoad } from './lib/processingClient'
import { SurfaceLoader } from './components/SurfaceLoader'
import { initApplePurchases, isAppleIapAvailable } from './lib/appleIap'
import { isMobileTauri } from './lib/platform'

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
    // Family attribute: the single hook light-vs-dark chrome keys off of, so
    // every light palette gets light treatment (and vice versa) without each
    // surface needing to know the specific theme id.
    root.setAttribute('data-appearance', isLightTheme(resolvedTheme) ? 'light' : 'dark')
    root.style.colorScheme = isLightTheme(resolvedTheme) ? 'light' : 'dark'
    // Mobile status-bar / PWA chrome tracks the resolved surface color.
    const themeColor = getComputedStyle(root).getPropertyValue('--bg-elevated').trim()
    if (themeColor) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor)
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
// 'stalled' → paid, but the webhook hasn't landed within ~30s. Never leave this
//             one as a silent spinner: the user's card has been charged.
type CheckoutState = 'idle' | 'waiting' | 'ready' | 'stalled'

function AuthenticatedApp({ userEmail, ownerId }: { userEmail: string; ownerId: string }) {
  useSettingsSync() // pull remote settings on login, push changes on edit
  const { subscription, entitled, featureFlags, loading, unreachable, refetch } = useSubscription()

  // Initialize the account once on entry. initReady only gates on the privacy
  // fence (fast for a returning user — no network) so the app can paint from
  // useSubscription's cached value immediately. ensureProfile — which grants
  // the 14-day reverse trial for a brand-new user and is otherwise an
  // idempotent no-op — runs in the background and reconciles via refetch();
  // a brand-new user still has no cached subscription, so useSubscription
  // stays in `loading` (and this screen stays up) until that reconcile lands.
  const [initReady, setInitReady] = useState(false)
  useEffect(() => {
    let alive = true
    // Before anything can flush: `derive` ops drain as no-ops without this.
    registerEntryDerive()
    void (async () => {
      // Privacy fence FIRST — scrub any other owner's cached content before the
      // journal (and its sync) ever reads the cache.
      try {
        await fenceCacheToOwner(ownerId)
      } catch { /* idb unavailable — proceed */ }
      if (!alive) return
      setInitReady(true)

      void (async () => {
        try {
          await ensureProfile()
        } catch { /* offline / not-yet-migrated — fall through to refetch */ }
        if (alive) void refetch()
      })()

      // Catch-up backfill for accounts with history but no processing yet.
      void maybeBackfillOnLoad()

      // StoreKit out-of-band updates (Ask to Buy, renewals) → re-verify + refetch.
      if (isAppleIapAvailable()) {
        void initApplePurchases(() => {
          if (alive) void refetch()
        })
      }
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

    // Webhook not yet fired — poll every 2s, then stop and SAY SO. Silently
    // clearing the interval left "Setting up your account…" on screen forever
    // for anyone whose webhook was slow or failed: they had paid, and the app
    // gave them a spinner with no way out.
    let attempts = 0
    const id = setInterval(() => {
      attempts++
      if (attempts > 15) {
        clearInterval(id)
        setCheckoutState('stalled')
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

  // We have never managed to read this account's plan. Do not fall through to
  // the paywall — telling a paying subscriber their trial ended because their
  // wifi dropped is a lie, and every button on that screen would fail too.
  if (unreachable && !subscription?.onboarded_at) {
    return (
      <div className="center-screen" style={{ flexDirection: 'column', gap: '1rem' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-dim)', fontSize: '1rem', textAlign: 'center', maxWidth: '26rem' }}>
          We couldn’t reach your account. Your journal is safe — this is just the
          connection.
        </p>
        <button className="btn" onClick={() => void refetch()}>
          Try again
        </button>
      </div>
    )
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

  // Paid, but the webhook is late. They have been charged, so this must offer a
  // way forward rather than spinning: Stripe replays failed webhooks, and the
  // refresh below picks it up the moment it lands.
  if (checkoutState === 'stalled' && !entitled) {
    return (
      <div className="center-screen" style={{ flexDirection: 'column', gap: '1rem', padding: '1.5rem' }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--text-dim)', fontSize: '1rem', textAlign: 'center', maxWidth: '28rem' }}>
          Your payment went through, but we’re still hearing back from Stripe. This
          usually clears within a minute or two — nothing was lost.
        </p>
        <button className="btn" onClick={() => void refetch()}>
          Check again
        </button>
        <button className="btn btn--ghost" onClick={() => setCheckoutState('idle')}>
          Continue anyway
        </button>
      </div>
    )
  }

  // ONBOARDING_REQUIRE_CARD (card-first) only: a brand-new account with no plan
  // sees the trial/Checkout step BEFORE Welcome. In the default app-managed model
  // ensureProfile() has already granted the trial, so plan is never 'none' here.
  // Never enable card-first on iOS — App Store requires StoreKit IAP.
  if (
    ONBOARDING_REQUIRE_CARD &&
    !isMobileTauri() &&
    (!subscription || subscription.plan === 'none')
  ) {
    return <PaywallScreen onPurchased={refetch} />
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
    return (
      <LockedScreen
        plan={subscription?.plan ?? 'none'}
        subscription={subscription}
        canExtend={
          subscription?.plan === 'trialing' && !subscription.featureFlags.includes('trial_extended')
        }
        userEmail={userEmail}
        onRefetch={refetch}
      />
    )
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
        <TrialBanner
          subscription={subscription}
          onDismiss={() => setBannerDismissed(true)}
          onPurchased={refetch}
        />
      )}
      <SurfaceErrorBoundary>
        <JournalScreen userEmail={userEmail} featureFlags={featureFlags} />
      </SurfaceErrorBoundary>
      <UpdateToast />
      <FeedbackWidget featureFlags={featureFlags} />
    </WelcomeProvider>
  )
}

/**
 * Thin wrapper so the ErrorBoundary can call useAppNavigation (class components
 * can't use hooks directly). On "Go Home" it navigates back to the journal
 * surface without a full page reload, preserving any outbox state.
 */
function SurfaceErrorBoundary({ children }: { children: React.ReactNode }) {
  const { state, go } = useAppNavigation()
  const goHome = () =>
    go(
      {
        surface: 'journal',
        entryId: null,
        settings: null,
        help: false,
        scriptureBook: null,
        scriptureVerse: null,
        entryReturn: null,
        ascentAltitude: 0,
        ascentDrill: null,
      },
      { replace: true },
    )
  return (
    <ErrorBoundary variant="surface" surface={state.surface} onGoHome={goHome}>
      {children}
    </ErrorBoundary>
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
