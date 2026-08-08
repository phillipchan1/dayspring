import type { EntriesGroupBy } from './groupEntries'

const OPTIONS: { value: EntriesGroupBy; label: string }[] = [
  { value: 'flat', label: 'List' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

interface Props {
  value: EntriesGroupBy
  onChange: (mode: EntriesGroupBy) => void
}

/** How the entries panel is organized. */
export function EntriesGroupToggle({ value, onChange }: Props) {
  return (
    <div className="entry-list__view-switcher" role="group" aria-label="Organize entries">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="entry-list__view-btn"
          data-active={value === opt.value ? 'true' : undefined}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
