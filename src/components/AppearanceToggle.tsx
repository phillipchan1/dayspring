import type { Appearance } from '@/lib/settings'

const OPTIONS: { value: Appearance; label: string; title: string }[] = [
  { value: 'light', label: 'Light', title: 'Light appearance' },
  { value: 'dark', label: 'Dark', title: 'Dark appearance' },
  { value: 'auto', label: 'Auto', title: 'Match system light / dark' },
]

const CYCLE: Appearance[] = ['light', 'dark', 'auto']

const CYCLE_HINT: Record<Appearance, string> = {
  light: 'Light — click for dark',
  dark: 'Dark — click for auto (system)',
  auto: 'Auto — follows system — click for light',
}

interface Props {
  appearance: Appearance
  onChange: (mode: Appearance) => void
  /** Compact text pills for settings. */
  compact?: boolean
  /** Single icon that cycles light → dark → auto (floating bar). */
  icon?: boolean
  /** When false, keep out of the Tab order while writing (mouse still works). */
  tabFocus?: boolean
}

export function AppearanceToggle({
  appearance,
  onChange,
  compact = false,
  icon = false,
  tabFocus = true,
}: Props) {
  if (icon) {
    const next = CYCLE[(CYCLE.indexOf(appearance) + 1) % CYCLE.length]!
    return (
      <button
        type="button"
        className="appearance-icon-btn"
        data-mode={appearance}
        aria-label={`Appearance: ${OPTIONS.find((o) => o.value === appearance)!.label}`}
        title={CYCLE_HINT[appearance]}
        tabIndex={tabFocus ? 0 : -1}
        onClick={() => onChange(next)}
      >
        <AppearanceIcon mode={appearance} />
      </button>
    )
  }

  return (
    <div
      className={compact ? 'segmented segmented--compact' : 'segmented'}
      role="group"
      aria-label="Appearance"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="segmented__btn"
          data-active={appearance === opt.value}
          title={opt.title}
          tabIndex={tabFocus ? 0 : -1}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function AppearanceIcon({ mode }: { mode: Appearance }) {
  switch (mode) {
    case 'light':
      return <IconSun />
    case 'dark':
      return <IconMoon />
    case 'auto':
      return <IconAuto />
  }
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20 14.3A8 8 0 1 1 9.7 4a6.3 6.3 0 0 0 10.3 10.3Z" />
    </svg>
  )
}

/** Half disc — "follows system" (same convention as Control Center / many apps). */
function IconAuto() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3a9 9 0 1 0 0 18V3Z" />
      <circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.45" />
    </svg>
  )
}
