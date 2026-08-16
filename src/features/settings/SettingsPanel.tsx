import { useEffect, useState, type ReactNode } from 'react'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useSheetDismiss } from '@/hooks/useSheetDismiss'
import { AppearanceToggle } from '@/components/AppearanceToggle'
import { ShortcutsGuide } from '@/features/shortcuts/ShortcutsGuide'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import { loadChangelog, isMinor, type ChangelogEntry } from '@/lib/changelog'
import { useSubscription } from '@/hooks/useSubscription'
import { linkProvider, listSignInMethods, signOut } from '@/lib/auth'
import { PROVIDER_LABEL, SIGN_IN_PROVIDERS, type AuthProvider } from '@/lib/lastAuthProvider'
import { isDesktopTauri, isTauri } from '@/lib/platform'
import { HELP_URL, HELP_CONTACT_URL } from '@/lib/support'
import { useWelcome } from '@/features/welcome/WelcomeProvider'
import { useSettings } from '@/hooks/useSettings'
import type { SettingsTab } from '@/lib/appHistory'
import type { Settings } from '@/lib/settings'
import { EDITOR_FONT_VARS, FONT_SIZE_MAX, FONT_SIZE_MIN, settingsStore } from '@/lib/settings'
import {
  billingDestination,
  fetchPortalUrl,
  hasBillingRelationship,
  isAppleRelationship,
  purchaseRoute,
  startCheckout,
  trialDaysRemaining,
} from '@/lib/subscription'
import { openExternal } from '@/lib/openExternal'
import {
  describeRestore,
  fetchAppleProducts,
  isAppleIapAvailable,
  manageAppleSubscriptions,
  purchaseApple,
  restoreApplePurchases,
} from '@/lib/appleIap'
import { displayPrice } from '@/features/paywall/prices'
import { ConcordanceDrawer } from '@/features/concordance/ConcordanceDrawer'
import { DeleteAccountFlow } from '@/features/account/DeleteAccountFlow'
import { ImportPanel } from './ImportPanel'
import { WritingFontPicker } from './WritingFontPicker'
import { ThemePicker } from './ThemePicker'
import { useResolvedTheme } from '@/hooks/useResolvedTheme'

interface Props {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  onClose: () => void
  tab: SettingsTab
  importSourceId: string | null
  onTabChange: (tab: SettingsTab) => void
  onImportSourceChange: (sourceId: string) => void
  /** Pop one settings history frame (e.g. import source detail → list). */
  onImportSourceBack: () => void
  /** Signed-in account, shown alongside Sign out in the About tab. */
  userEmail: string
  featureFlags: string[]
}

const TABS: { id: SettingsTab; label: string; icon: ReactNode }[] = [
  { id: 'appearance', label: 'Appearance', icon: <IconSun /> },
  { id: 'writing', label: 'Writing', icon: <IconPen /> },
  { id: 'import', label: 'Import & backup', icon: <IconImport /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: <IconKey /> },
  { id: 'billing', label: 'Billing', icon: <IconSubscription /> },
  { id: 'about', label: 'About', icon: <IconSpark /> },
]

export function SettingsPanel({
  settings,
  update,
  onClose,
  tab,
  importSourceId,
  onTabChange,
  onImportSourceChange,
  onImportSourceBack,
  userEmail,
  featureFlags,
}: Props) {
  const isMobile = useIsMobile()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // Capture + preventDefault: with fullscreen keyboard lock, Esc closes modal first.
      e.preventDefault()
      e.stopPropagation()
      if (importSourceId) onImportSourceBack()
      else onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [importSourceId, onClose, onImportSourceBack])

  // Keyboard shortcuts are irrelevant on a touch phone (no hardware keys); the
  // tab only earns its place on desktop and keyboard-equipped tablets. The 767px
  // boundary keeps it for iPad, which behaves like desktop here.
  const visibleTabs = isMobile ? TABS.filter((t) => t.id !== 'shortcuts') : TABS
  const active = visibleTabs.find((t) => t.id === tab) ?? visibleTabs[0]!

  // Drag-to-dismiss for the mobile bottom sheet. It slid up to open, so a pull
  // down is the way back out — and the whole sheet is the handle, not just the
  // grabber, which was a target most thumbs never found. useSheetDismiss yields
  // the gesture back to the body whenever that body still has somewhere to
  // scroll, so the two never fight.
  const { handlers: sheetDrag, dragY, dragging } = useSheetDismiss({
    onDismiss: onClose,
    enabled: isMobile,
  })

  return (
    <div className="scrim settings-scrim glass-scrim" onClick={onClose}>
      <div
        className="settings-modal glass-surface"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
        {...sheetDrag}
        style={
          dragging || dragY
            ? {
                transform: `translateY(${dragY}px)`,
                // Suppressed only while the finger is down; on release the
                // class's transition returns and snaps the sheet home.
                ...(dragging ? { transition: 'none' } : {}),
              }
            : undefined
        }
      >
        <div className="glass-surface__glow" aria-hidden />
        {isMobile && (
          <button
            type="button"
            className="settings-grabber"
            aria-label="Close settings"
            onClick={onClose}
          >
            <span className="settings-grabber__bar" aria-hidden />
          </button>
        )}
        <nav className="settings-nav" aria-label="Settings sections">
          <div className="settings-nav__brand">Dayspring</div>
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className="settings-nav__item"
              data-active={t.id === tab}
              onClick={() => onTabChange(t.id)}
            >
              <span className="settings-nav__icon">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div className="settings-main">
          <header className="settings-main__head">
            <h2 className="settings-main__title">{active.label}</h2>
            <button className="btn btn--ghost" onClick={onClose} aria-label="Close settings">
              ✕
            </button>
          </header>

          {/* data-sheet-scroll: useSheetDismiss checks this element's scrollTop
              to decide whether a downward drag belongs to the scroll or to the
              sheet. */}
          <div key={tab} className="settings-main__body" data-sheet-scroll>
            {tab === 'appearance' && <AppearanceTab settings={settings} update={update} />}
            {tab === 'writing' && <WritingTab settings={settings} update={update} />}
            {tab === 'import' && (
              <ImportPanel
                selectedId={importSourceId}
                onSelectSource={onImportSourceChange}
                onBack={onImportSourceBack}
              />
            )}
            {tab === 'shortcuts' && <ShortcutsTab />}
            {tab === 'billing' && <BillingTab />}
            {tab === 'about' && <AboutTab userEmail={userEmail} onClose={onClose} featureFlags={featureFlags} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function AppearanceTab({ settings, update }: { settings: Settings; update: Props['update'] }) {
  const active = useResolvedTheme(settings)
  return (
    <div className="settings-stack">
      <Field label="Mode" hint="Match your system, or lock it light or dark.">
        <AppearanceToggle appearance={settings.appearance} onChange={(appearance) => update({ appearance })} />
      </Field>
      <Field label="Theme" hint="Your light and dark palettes. Pick one to switch to it now.">
        <ThemePicker settings={settings} update={update} active={active} />
      </Field>
      <Field label="Writing font" hint="The face you read and write in.">
        <WritingFontPicker value={settings.editorFont} onChange={(editorFont) => update({ editorFont })} />
      </Field>
      <Toggle
        label="Navigation labels"
        hint="Show names beside the sidebar icons. Press [ to toggle."
        checked={settings.railLabels}
        onChange={(railLabels) => update({ railLabels })}
      />
    </div>
  )
}

function WritingTab({ settings, update }: { settings: Settings; update: Props['update'] }) {
  return (
    <div className="settings-stack">
      {/* On mobile the settings panel covers the journal full-screen, so a
          slider drag here has nothing to show its effect against — this
          mirrors the actual writing surface's font, size, and line height. */}
      <div
        className="settings-preview"
        style={{
          fontFamily: EDITOR_FONT_VARS[settings.editorFont],
          fontSize: settings.fontSize,
          lineHeight: settings.lineHeight,
        }}
      >
        Grace and peace to you this morning.
      </div>
      <Slider
        label="Font size"
        value={settings.fontSize}
        min={FONT_SIZE_MIN}
        max={FONT_SIZE_MAX}
        step={1}
        suffix="px"
        onChange={(v) => update({ fontSize: v })}
      />
      <Slider
        label="Line height"
        value={settings.lineHeight}
        min={1.3}
        max={2.1}
        step={0.05}
        onChange={(v) => update({ lineHeight: v })}
      />
      <Slider
        label="Column width"
        value={settings.maxWidth}
        min={32}
        max={60}
        step={1}
        suffix="rem"
        onChange={(v) => update({ maxWidth: v })}
      />
      <div className="settings-divider" />
      <Toggle
        label="First line as title"
        hint="Style each entry's first line as its title. Off keeps it as plain text."
        checked={settings.firstLineTitle}
        onChange={(v) => update({ firstLineTitle: v })}
      />
      <Toggle
        label="Show markdown syntax"
        hint="Show the raw *, **, and == characters. Off hides them until your cursor is inside — the text itself never changes."
        checked={settings.showMarkdownSyntax}
        onChange={(v) => update({ showMarkdownSyntax: v })}
      />
      <Toggle
        label="Ritual previews"
        hint="Preview a ritual’s questions before you begin. Off jumps straight into writing."
        checked={!settings.skipRitualPreview}
        onChange={(v) => update({ skipRitualPreview: !v })}
      />
      <div className="settings-divider" />
      <Toggle
        label="Typewriter scrolling"
        hint="Keep the active line centered (focus mode)"
        checked={settings.typewriter}
        onChange={(v) => update({ typewriter: v })}
      />
      <Toggle
        label="Paragraph dimming"
        hint="Fade all but the current paragraph (focus mode)"
        checked={settings.dimming}
        onChange={(v) => update({ dimming: v })}
      />
      <div className="settings-divider" />
      <Field label="Scripture" hint="Passages are looked up word-for-word from the ESV.">
        <p className="settings-attribution">
          Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®),
          © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission.
          All rights reserved.
        </p>
      </Field>
    </div>
  )
}

function ShortcutsTab() {
  return (
    <div>
      <p className="settings-section__intro">
        Dayspring is built to keep your hands on the keys. Press <kbd className="kbd">?</kbd> anywhere
        to summon this guide.
      </p>
      <ShortcutsGuide />
    </div>
  )
}

function AboutTab({ userEmail, onClose, featureFlags }: { userEmail: string; onClose: () => void; featureFlags: string[] }) {
  const { replay } = useWelcome()
  const { settings, update } = useSettings()
  // Only for the delete flow, which has to warn an App Store subscriber before
  // they get as far as typing. Safe to read here: the Billing tab holds the
  // other instance and the two tabs are never mounted at once.
  const { subscription } = useSubscription()
  const [showConcordance, setShowConcordance] = useState(false)
  // Two-step sign-out. Signing out is one tap from being locked out of your own
  // journal until you can get back to an email inbox — too easy to hit by
  // accident in a danger zone whose other button only resets preferences.
  const [confirmSignOut, setConfirmSignOut] = useState(false)
  return (
    <div className="settings-about">
      {/* App identity: title + tagline + metadata */}
      <div className="settings-about__header">
        <div className="settings-about__mark">Dayspring</div>
        <p className="settings-about__tagline">A journal built for spiritual growth.</p>
        <dl className="settings-about__meta">
          <div>
            <dt>Version</dt>
            <dd>
              {__APP_VERSION__}
              {import.meta.env.VITE_RELEASE_CHANNEL === 'alpha' && (
                <span className="settings-about__channel-badge">alpha</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>Private to you · synced</dd>
          </div>
        </dl>
      </div>

      {/* Help — opens the support site. Deliberately above Updates: someone in
          Settings looking for an answer should meet this before a changelog. */}
      <div className="settings-about__section">
        <div className="settings-about__section-title">Help</div>
        <div className="settings-about__group">
          <div className="settings-about__row">
            <span className="settings-field__label">Guides</span>
            <a
              className="btn btn--ghost"
              href={HELP_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              How to use Dayspring
            </a>
          </div>
          <div className="settings-about__row">
            <span className="settings-field__label">Questions</span>
            <a
              className="btn btn--ghost"
              href={HELP_CONTACT_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              Get in touch
            </a>
          </div>
        </div>
      </div>

      {/* Updates — desktop: update checker + history; web/iOS: history only
          (mobile updates ship through the App Store, not the in-app updater) */}
      {isDesktopTauri() ? (
        <div className="settings-about__section">
          <div className="settings-about__section-title">Updates</div>
          <div className="settings-about__group">
            <UpdateChecker />
          </div>
          <ReleaseHistory />
        </div>
      ) : (
        <ReleaseHistory withSection />
      )}

      {/* Account & preferences section */}
      <div className="settings-about__section">
        <div className="settings-about__section-title">Account</div>
        <div className="settings-about__group">
          <div className="settings-about__row">
            <span className="settings-field__label">Email</span>
            {userEmail && <span className="settings-field__value">{userEmail}</span>}
          </div>
          <SignInMethods />
          <div className="settings-about__row">
            <span className="settings-field__label">Welcome</span>
            <button
              className="btn btn--ghost"
              onClick={() => {
                onClose()
                replay()
              }}
            >
              Replay the welcome
            </button>
          </div>
          {/* The fidelity record's inspectable list — names and spellings the
              app has learned, with confirm/edit/forget. Quiet by design, and
              gated behind the `concordance` flag (off by default) so the
              background-collected data stays invisible until we choose to reveal
              it. Flip via profiles.feature_flags to audit what it has learned. */}
          {featureFlags.includes('concordance') && (
            <div className="settings-about__row">
              <span className="settings-field__label">Concordance</span>
              <button className="btn btn--ghost" onClick={() => setShowConcordance(true)}>
                Names &amp; spellings
              </button>
            </div>
          )}
          {showConcordance && <ConcordanceDrawer onClose={() => setShowConcordance(false)} />}
          {isTauri() && featureFlags.includes('beta') && (
            <div className="settings-about__row-toggle">
              <Toggle
                label="Developer mode"
                checked={settings.devMode}
                onChange={(devMode) => update({ devMode })}
              />
            </div>
          )}
        </div>
      </div>

      {/* Privacy */}
      <div className="settings-about__section">
        <div className="settings-about__section-title">Privacy</div>
        <div className="settings-about__group">
          <div className="settings-about__row-toggle">
            <Toggle
              label="Share anonymous usage"
              hint="Counts which features are used — never your entries, prayers, or any words you write."
              checked={settings.shareUsage}
              onChange={(shareUsage) => update({ shareUsage })}
            />
          </div>
        </div>
      </div>

      {/* Danger zone: account actions */}
      <div className="settings-about__danger">
        <div className="settings-about__danger-title">Account Actions</div>
        {confirmSignOut ? (
          <div className="settings-about__confirm">
            <span className="settings-about__confirm-text">Sign out of {userEmail}?</span>
            <div className="settings-about__confirm-actions">
              <button className="btn btn--danger" onClick={() => void signOut()}>
                Sign out
              </button>
              <button className="btn btn--ghost" onClick={() => setConfirmSignOut(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn--ghost" onClick={() => setConfirmSignOut(true)}>
            Sign out
          </button>
        )}
        <button className="btn btn--ghost" onClick={() => settingsStore.reset()}>
          Reset all settings to defaults
        </button>
        <DeleteAccountFlow userEmail={userEmail} subscription={subscription} />
      </div>
    </div>
  )
}

/**
 * Which sign-in buttons reach this account, and a way to attach the other one.
 *
 * Without this, a user who signed up with Google and later taps "Continue with
 * Apple" gets a second, empty account. Supabase merges the two automatically
 * only when both providers report the same verified email — and Apple's "Hide
 * My Email" hands out a relay address that never matches, so the common case is
 * the one that silently splits. Linking goes through the current session rather
 * than the email, so it works either way.
 *
 * Stays silent when it can't help: no session, or a project without manual
 * linking enabled, renders nothing rather than a dead button.
 */
function SignInMethods() {
  const [linked, setLinked] = useState<AuthProvider[] | null>(null)
  const [busy, setBusy] = useState<AuthProvider | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const load = () => {
      void listSignInMethods()
        .then((providers) => alive && setLinked(providers))
        .catch(() => alive && setLinked(null))
    }
    load()
    // Native opens the provider in the system browser, so we come back to an
    // already-mounted panel — re-read on return instead of showing stale state.
    // Clearing busy here is what un-sticks the button when they backed out.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (alive) setBusy(null)
      load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!linked?.length) return null

  const missing = SIGN_IN_PROVIDERS.filter((p) => !linked.includes(p))

  async function connect(provider: AuthProvider) {
    setError(null)
    setBusy(provider)
    try {
      await linkProvider(provider)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect that account.')
      setBusy(null)
    }
  }

  return (
    <>
      <div className="settings-about__row">
        <span className="settings-field__label">Sign-in</span>
        <span className="settings-field__value">
          {linked.map((p) => PROVIDER_LABEL[p]).join(' · ')}
        </span>
      </div>
      {missing.map((provider) => (
        <div className="settings-about__row" key={provider}>
          <span className="settings-field__label">Add {PROVIDER_LABEL[provider]}</span>
          <button
            className="btn btn--ghost"
            onClick={() => void connect(provider)}
            disabled={busy !== null}
          >
            {busy === provider ? 'Opening…' : 'Connect'}
          </button>
        </div>
      ))}
      {missing.length > 0 && (
        <div className="settings-about__row">
          <span className="settings-field__hint">
            Connect both and either button opens this same journal.
          </span>
        </div>
      )}
      {error && (
        <div className="settings-about__row">
          <span className="settings-field__hint">{error}</span>
        </div>
      )}
    </>
  )
}

// Desktop-only: manually check for an update and, when one is staged, restart
// into it. Mirrors the background poll but on demand. Shares state with the
// bottom-left toast via the update store, so the two never disagree.
function UpdateChecker() {
  const { state, check, restart } = useAppUpdate()
  const busy = state.status === 'checking' || state.status === 'downloading'

  const message = {
    idle: '',
    checking: 'Checking…',
    'up-to-date': "You're on the latest version.",
    downloading: `Downloading v${state.version ?? ''}…`,
    ready: `Version ${state.version ?? ''} is ready.`,
    // A failed update check is harmless — the current build keeps working — so
    // keep it gentle and never surface the raw request error / URL to the user.
    error: "Couldn't check for updates right now. Try again later.",
  }[state.status]

  return (
    <>
      <div className="settings-update">
        <div className="settings-update__row">
          <span className="settings-field__label">Updates</span>
          {state.status === 'ready' ? (
            <button className="btn btn--accent" onClick={() => void restart()}>
              Restart to update
            </button>
          ) : (
            <button className="btn btn--ghost" onClick={() => void check()} disabled={busy}>
              {busy ? 'Checking…' : 'Check for updates'}
            </button>
          )}
        </div>
        {message && (
          <p className="settings-update__status" data-status={state.status}>
            {message}
          </p>
        )}
        {state.status === 'ready' && state.notes && (
          <details className="settings-update__notes">
            <summary>What's new in v{state.version}</summary>
            <div className="settings-update__notes-body">{state.notes}</div>
          </details>
        )}
      </div>
    </>
  )
}

// Desktop-only: the cumulative version history bundled into the app by CI. Lets
// someone who's been away a while catch up on everything that changed, not just
// the single hop they last auto-updated through. Notable releases are listed
// individually; runs of minor/internal builds collapse into a count so the major
// changes stand out. Hides itself when no changelog is bundled (web/dev).
//
// withSection=true (web): wraps in a settings-about__section with its own title,
// and returns null entirely when empty so no orphaned section header appears.
// withSection=false (desktop, default): bare fragment with a leading divider,
// nested inside the Updates section that UpdateChecker already owns.
function ReleaseHistory({ withSection = false }: { withSection?: boolean }) {
  const [entries, setEntries] = useState<ChangelogEntry[] | null>(null)
  useEffect(() => {
    void loadChangelog().then(setEntries)
  }, [])

  if (!entries || entries.length === 0) return null

  // Walk newest-first, emitting notable releases and folding consecutive
  // minor/internal builds into a single muted "N smaller updates" row.
  type Row = { kind: 'release'; entry: ChangelogEntry } | { kind: 'minor'; count: number }
  const rows: Row[] = []
  let minorRun = 0
  for (const entry of entries) {
    if (isMinor(entry.notes)) {
      minorRun += 1
      continue
    }
    if (minorRun) {
      rows.push({ kind: 'minor', count: minorRun })
      minorRun = 0
    }
    rows.push({ kind: 'release', entry })
  }
  if (minorRun) rows.push({ kind: 'minor', count: minorRun })

  const list = (
    <details className="settings-changelog">
      <summary className="settings-changelog__summary">What's new</summary>
      <ul className="settings-changelog__list">
        {rows.map((row, i) =>
          row.kind === 'release' ? (
            <li key={row.entry.version} className="settings-changelog__item">
              <div className="settings-changelog__head">
                <span className="settings-changelog__ver">
                  v{row.entry.version}
                  {row.entry.version === __APP_VERSION__ && (
                    <span className="settings-changelog__current"> · current</span>
                  )}
                </span>
                <span className="settings-changelog__date">{formatReleaseDate(row.entry.date)}</span>
              </div>
              <div className="settings-changelog__notes">{row.entry.notes}</div>
            </li>
          ) : (
            <li key={`minor-${i}`} className="settings-changelog__minor">
              + {row.count} smaller update{row.count > 1 ? 's' : ''}
            </li>
          ),
        )}
      </ul>
    </details>
  )

  if (withSection) {
    return (
      <div className="settings-about__section">
        <div className="settings-about__section-title">What's new</div>
        {list}
      </div>
    )
  }

  return (
    <>
      <div className="settings-divider" />
      {list}
    </>
  )
}

function formatReleaseDate(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="settings-field">
      <div className="settings-field__head">
        <span className="settings-field__label">{label}</span>
        {hint && <span className="settings-field__hint">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Slider({
  label, value, min, max, step, suffix = '', onChange,
}: {
  label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (v: number) => void
}) {
  return (
    <div className="settings-field">
      <div className="settings-field__head settings-field__head--row">
        <span className="settings-field__label">{label}</span>
        <span className="settings-field__value">
          {Number.isInteger(value) ? value : value.toFixed(2)}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="settings-range"
      />
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="settings-toggle">
      <span>
        <span className="settings-field__label">{label}</span>
        {hint && <span className="settings-toggle__hint">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="switch"
        data-on={checked}
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" />
      </button>
    </label>
  )
}

function BillingTab() {
  const { subscription, loading, refetch } = useSubscription()
  const [syncing, setSyncing] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)
  const [iapLoading, setIapLoading] = useState<'annual' | 'monthly' | 'restore' | null>(null)
  /** Non-failure feedback, e.g. a restore that found only expired purchases. */
  const [notice, setNotice] = useState<string | null>(null)

  const onIos = isAppleIapAvailable()
  // Two different questions, and conflating them is what stranded lapsed Apple
  // subscribers on the web: where the relationship is *managed* (survives
  // cancellation) vs. where a new purchase has to *go*.
  const appleRelationship = isAppleRelationship(subscription)
  const route = purchaseRoute(subscription, { onAppleDevice: onIos })

  // StoreKit-supplied, storefront-correct prices. Empty until Apple answers;
  // the plan cards render the cadence rather than a wrong figure until then.
  const [applePrices, setApplePrices] = useState<{ annual: string | null; monthly: string | null }>(
    { annual: null, monthly: null },
  )
  useEffect(() => {
    if (!onIos) return
    let alive = true
    fetchAppleProducts().then((products) => {
      if (!alive) return
      setApplePrices({
        annual: displayPrice('annual', { useApple: true, products }),
        monthly: displayPrice('monthly', { useApple: true, products }),
      })
    }, () => {})
    return () => { alive = false }
  }, [onIos])

  async function handleSync() {
    setSyncing(true)
    try {
      await refetch()
    } finally {
      setSyncing(false)
    }
  }

  async function openPortal() {
    setPortalError(null)
    setPortalLoading(true)
    try {
      // Routed by who bills the account, not by the device — a Stripe
      // subscriber on an iPhone still manages in Stripe. See billingDestination.
      switch (billingDestination(subscription, { onAppleDevice: onIos })) {
        case 'apple-native':
          await manageAppleSubscriptions()
          return
        case 'apple-web':
          await openExternal('https://apps.apple.com/account/subscriptions')
          return
        case 'stripe':
          await openExternal(await fetchPortalUrl())
          return
      }
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : 'Could not open billing portal.')
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleApplePurchase(plan: 'annual' | 'monthly') {
    setPortalError(null)
    setIapLoading(plan)
    try {
      const { outcome, warning } = await purchaseApple(plan)
      if (outcome === 'purchased') {
        if (warning) setNotice(warning)
        await refetch()
      } else if (outcome === 'pending') {
        setPortalError('Purchase is pending approval.')
      }
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : 'Purchase failed.')
    } finally {
      setIapLoading(null)
    }
  }

  async function handleAppleRestore() {
    setPortalError(null)
    setNotice(null)
    setIapLoading('restore')
    try {
      const outcome = await restoreApplePurchases()
      // Reconcile regardless: a non-entitling restore can still correct the
      // recorded plan, and the server is the authority on what happens next.
      await refetch()
      const message = describeRestore(outcome)
      if (message?.kind === 'error') setPortalError(message.text)
      else if (message) setNotice(message.text)
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : 'Could not restore purchases.')
    } finally {
      setIapLoading(null)
    }
  }

  /** Web/desktop purchase. Only reachable when Apple isn't still charging them
   *  — see purchaseRoute; the server enforces the same rule. */
  async function handleStripePurchase(plan: 'annual' | 'monthly') {
    setPortalError(null)
    setIapLoading(plan)
    try {
      await openExternal(await startCheckout(plan), { sameTab: true })
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : 'Could not open checkout.')
      setIapLoading(null)
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-sans)', fontSize: '0.88rem' }}>Loading…</p>
  }

  const plan = subscription?.plan ?? 'none'
  const trialDays = subscription ? trialDaysRemaining(subscription) : 0
  const trialEnd = subscription?.trial_ends_at
    ? new Date(subscription.trial_ends_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null

  type StatusInfo = { label: string; color: string; detail: string | null }
  const statusInfo: StatusInfo = {
    none:     { label: 'No subscription',  color: 'var(--text-faint)', detail: null },
    trialing: {
      label:  `Free trial — ${trialDays} ${trialDays === 1 ? 'day' : 'days'} remaining`,
      color:  'var(--accent)',
      detail: trialEnd ? `Ends ${trialEnd} · No charge until then.` : null,
    },
    active:   {
      label:  'Active',
      color:  'var(--success)',
      // Always name who takes the money. It's the one fact that tells you where
      // to go to cancel, and getting it wrong is what sent Stripe subscribers
      // hunting through an empty App Store subscription list.
      detail: appleRelationship
        ? 'Billed through the App Store.'
        : subscription?.plan_source === 'stripe'
          ? 'Billed on the web through Stripe.'
          : 'Your subscription is current.',
    },
    cancelled:{ label: 'Cancelled',        color: 'var(--text-faint)', detail: 'Your subscription has ended.' },
    past_due: { label: 'Payment issue',    color: 'var(--danger)',     detail: 'Update your payment method to restore access.' },
  }[plan] ?? { label: plan, color: 'var(--text-faint)', detail: null }

  // Not just `plan !== 'none'`: the app-managed first-run trial has no card and
  // no customer at either store, so a portal link would 404 on both paths.
  const hasPortal = hasBillingRelationship(subscription)
  const showPlans = plan === 'none' || plan === 'cancelled'
  // Never offer Stripe purchase UI on iOS (App Store rules), nor while Apple may
  // still charge this account (double billing).
  const canStripePurchase = route === 'stripe'

  return (
    <div className="settings-stack">

      {/* Status */}
      <div className="settings-field">
        <div className="settings-field__head settings-field__head--row">
          <span className="settings-field__label">Status</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="settings-field__value" style={{ color: statusInfo.color }}>
              {statusInfo.label}
            </span>
            <button
              className="btn btn--ghost"
              style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', lineHeight: 1 }}
              onClick={() => void handleSync()}
              disabled={syncing}
              title="Refresh subscription status"
            >
              {syncing ? '…' : '↻'}
            </button>
          </div>
        </div>
        {statusInfo.detail && (
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: 'var(--text-faint)', lineHeight: 1.55 }}>
            {statusInfo.detail}
          </p>
        )}
      </div>

      {/* Manage billing */}
      {hasPortal && (
        <>
          <div className="settings-divider" />
          <div className="settings-field">
            <div className="settings-field__head">
              <span className="settings-field__label">Manage billing</span>
              <span className="settings-field__hint">
                {appleRelationship
                  ? 'Update your payment method, switch plans, or cancel in the App Store.'
                  : 'Update your payment method, switch plans, or cancel via Stripe.'}
              </span>
            </div>
            <div className="settings-actions">
              <button className="btn" onClick={() => void openPortal()} disabled={portalLoading}>
                {portalLoading
                  ? 'Opening…'
                  : appleRelationship
                    ? 'Manage in App Store →'
                    : 'Open billing portal →'}
              </button>
              {portalError && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: 0 }}>{portalError}</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Pricing / purchase */}
      {showPlans && (
        <>
          <div className="settings-divider" />
          <div className="settings-field">
            <div className="settings-field__head">
              <span className="settings-field__label">Plans</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              {[
                {
                  label: 'Annual',
                  // On iOS the App Store is the only truthful source: its tiers
                  // are .99-based and localised, so the Stripe figure would be
                  // wrong. Fall back to the plan cadence, never a stale price.
                  price: onIos ? (applePrices.annual ?? 'Yearly') : '$64 / yr',
                  note: onIos ? 'Billed yearly' : '~$5.33 / mo',
                  plan: 'annual' as const,
                },
                {
                  label: 'Monthly',
                  price: onIos ? (applePrices.monthly ?? 'Monthly') : '$7 / mo',
                  note: 'Cancel anytime',
                  plan: 'monthly' as const,
                },
              ].map((p) => (
                <div key={p.label} style={{
                  padding: '0.7rem 0.8rem',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius)',
                }}>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.78rem', color: 'var(--text-faint)', marginBottom: '0.15rem' }}>{p.label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--text-bright)', letterSpacing: '-0.02em' }}>{p.price}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.1rem' }}>{p.note}</div>
                  {/* Web used to render these cards with no button at all, so a
                      cancelled subscriber opening Settings saw two prices and no
                      way to pay. Both routes get a Subscribe button now; which
                      one is decided by purchaseRoute, not by the device alone. */}
                  {(onIos || canStripePurchase) && (
                    <button
                      className="btn"
                      style={{ marginTop: '0.55rem', width: '100%', fontSize: '0.78rem' }}
                      disabled={iapLoading !== null}
                      onClick={() =>
                        void (onIos ? handleApplePurchase(p.plan) : handleStripePurchase(p.plan))
                      }
                    >
                      {iapLoading === p.plan
                        ? onIos
                          ? 'Confirming…'
                          : 'Redirecting…'
                        : 'Subscribe'}
                    </button>
                  )}
                </div>
              ))}
            </div>
            {onIos && (
              <button
                className="btn btn--ghost"
                style={{ marginTop: '0.75rem' }}
                disabled={iapLoading !== null}
                onClick={() => void handleAppleRestore()}
              >
                {iapLoading === 'restore' ? 'Restoring…' : 'Restore purchases'}
              </button>
            )}
            {route === 'apple-elsewhere' && (
              <p style={{ margin: '0.6rem 0 0', fontSize: '0.8rem', color: 'var(--text-faint)' }}>
                The App Store still bills this account. Settle it there first — on your iPhone or
                iPad, or at apps.apple.com/account/subscriptions in any browser.
              </p>
            )}
            {notice && (
              <p style={{ margin: '0.6rem 0 0', fontSize: '0.8rem', color: 'var(--text-faint)' }}>
                {notice}
              </p>
            )}
            {portalError && showPlans && (
              <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: '0.5rem 0 0' }}>{portalError}</p>
            )}
          </div>
        </>
      )}

    </div>
  )
}

/* ── Inline section icons (1.25rem, currentColor stroke) ──────────────────── */

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function IconPen() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

function IconImport() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  )
}

function IconKey() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8" />
    </svg>
  )
}

function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8a4 4 0 0 0 4 4 4 4 0 0 0-4 4 4 4 0 0 0-4-4 4 4 0 0 0 4-4Z" />
    </svg>
  )
}

function IconSubscription() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  )
}
