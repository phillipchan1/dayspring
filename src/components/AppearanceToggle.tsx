import type { Appearance } from '@/lib/settings'

const OPTIONS: { value: Appearance; label: string; title: string }[] = [
  { value: 'light', label: 'Light', title: 'Light appearance' },
  { value: 'dark', label: 'Dark', title: 'Dark appearance' },
  { value: 'auto', label: 'Auto', title: 'Match system light / dark' },
]

interface Props {
  appearance: Appearance
  onChange: (mode: Appearance) => void
  /** Compact styling for the floating writing bar. */
  compact?: boolean
}

export function AppearanceToggle({ appearance, onChange, compact = false }: Props) {
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
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
