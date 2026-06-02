import type { EntriesGroupBy } from './groupEntries'

const OPTIONS: { value: EntriesGroupBy; label: string; title: string }[] = [
  { value: 'flat', label: 'List', title: 'Flat list, newest first' },
  { value: 'month', label: 'Month', title: 'Group by month' },
  { value: 'year', label: 'Year', title: 'Group by year' },
]

interface Props {
  value: EntriesGroupBy
  onChange: (mode: EntriesGroupBy) => void
}

export function EntriesGroupToggle({ value, onChange }: Props) {
  return (
    <div className="segmented entry-list__view-toggle" role="group" aria-label="Organize entries">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className="segmented__btn"
          data-active={value === opt.value}
          title={opt.title}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
