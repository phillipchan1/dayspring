import { useEffect, useState, type ReactNode } from 'react'
import { AppearanceToggle } from '@/components/AppearanceToggle'
import { ShortcutsGuide } from '@/features/shortcuts/ShortcutsGuide'
import { useAppUpdate } from '@/hooks/useAppUpdate'
import { loadChangelog, isMinor, type ChangelogEntry } from '@/lib/changelog'
import { useSubscription } from '@/hooks/useSubscription'
import { signOut } from '@/lib/auth'
import { isTauri } from '@/lib/platform'
import { useWelcome } from '@/features/welcome/WelcomeProvider'
import type { SettingsTab } from '@/lib/appHistory'
import type { Settings } from '@/lib/settings'
import { FONT_SIZE_MAX, FONT_SIZE_MIN, settingsStore } from '@/lib/settings'
import { fetchPortalUrl, trialDaysRemaining } from '@/lib/subscription'
import { ImportPanel } from './ImportPanel'
import { WritingFontPicker } from './WritingFontPicker'

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
}: Props) {
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

  const active = TABS.find((t) => t.id === tab)!

  return (
    <div className="scrim settings-scrim glass-scrim" onClick={onClose}>
      <div
        className="settings-modal glass-surface"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-surface__glow" aria-hidden />
        <nav className="settings-nav" aria-label="Settings sections">
          <div className="settings-nav__brand">Dayspring</div>
          {TABS.map((t) => (
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

          <div key={tab} className="settings-main__body">
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
            {tab === 'about' && <AboutTab userEmail={userEmail} onClose={onClose} />}
          </div>
        </div>
      </div>
    </div>
  )
}

function AppearanceTab({ settings, update }: { settings: Settings; update: Props['update'] }) {
  return (
    <div className="settings-stack">
      <Field label="Theme" hint="Match your system, or lock it light or dark.">
        <AppearanceToggle appearance={settings.appearance} onChange={(appearance) => update({ appearance })} />
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

function AboutTab({ userEmail, onClose }: { userEmail: string; onClose: () => void }) {
  const { replay } = useWelcome()
  return (
    <div className="settings-about">
      <div className="settings-about__mark">Dayspring</div>
      <p className="settings-about__tagline">A quiet place to write, every day.</p>
      <dl className="settings-about__meta">
        <div>
          <dt>Version</dt>
          <dd>{__APP_VERSION__}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>Private to you · synced</dd>
        </div>
      </dl>
      {isTauri() && <UpdateChecker />}
      {isTauri() && <ReleaseHistory />}
      <div className="settings-divider" />
      <div className="settings-field__head settings-field__head--row">
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
      <div className="settings-divider" />
      <div className="settings-field__head settings-field__head--row">
        <span className="settings-field__label">Account</span>
        {userEmail && <span className="settings-field__value">{userEmail}</span>}
      </div>
      <div className="settings-actions">
        <button className="btn btn--ghost" onClick={() => void signOut()}>
          Sign out
        </button>
        <button className="btn btn--ghost" onClick={() => settingsStore.reset()}>
          Reset all settings to defaults
        </button>
      </div>
    </div>
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
    'up-to-date': 'You’re on the latest version.',
    downloading: `Downloading v${state.version ?? ''}…`,
    ready: `Version ${state.version ?? ''} is ready.`,
    error: state.error
      ? `Couldn’t check — ${state.error}. Try again.`
      : 'Couldn’t check right now — try again.',
  }[state.status]

  return (
    <>
      <div className="settings-divider" />
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
            <summary>What’s new in v{state.version}</summary>
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
function ReleaseHistory() {
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

  return (
    <>
      <div className="settings-divider" />
      <details className="settings-changelog">
        <summary className="settings-changelog__summary">What’s new</summary>
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
      const url = await fetchPortalUrl()
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      setPortalError(e instanceof Error ? e.message : 'Could not open billing portal.')
    } finally {
      setPortalLoading(false)
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
    active:   { label: 'Active',           color: 'var(--success)',    detail: 'Your subscription is current.' },
    cancelled:{ label: 'Cancelled',        color: 'var(--text-faint)', detail: 'Your subscription has ended.' },
    past_due: { label: 'Payment issue',    color: 'var(--danger)',     detail: 'Update your payment method to restore access.' },
  }[plan] ?? { label: plan, color: 'var(--text-faint)', detail: null }

  const hasPortal = plan !== 'none'
  const showPlans = plan === 'none' || plan === 'cancelled'

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
              title="Sync with Stripe"
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

      {/* Manage billing portal */}
      {hasPortal && (
        <>
          <div className="settings-divider" />
          <div className="settings-field">
            <div className="settings-field__head">
              <span className="settings-field__label">Manage billing</span>
              <span className="settings-field__hint">
                Update your payment method, switch plans, or cancel via Stripe.
              </span>
            </div>
            <div className="settings-actions">
              <button className="btn" onClick={() => void openPortal()} disabled={portalLoading}>
                {portalLoading ? 'Opening…' : 'Open billing portal →'}
              </button>
              {portalError && (
                <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: 0 }}>{portalError}</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Pricing — only when user needs to make a purchasing decision */}
      {showPlans && (
        <>
          <div className="settings-divider" />
          <div className="settings-field">
            <div className="settings-field__head">
              <span className="settings-field__label">Plans</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
              {[
                { label: 'Annual', price: '$64 / yr', note: '~$5.33 / mo' },
                { label: 'Monthly', price: '$7 / mo', note: 'Cancel anytime' },
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
                </div>
              ))}
            </div>
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
