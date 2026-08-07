import type { EntriesGroupBy } from './groupEntries'

const OPTIONS: { value: EntriesGroupBy; label: string }[] = [
  { value: 'flat', label: 'List' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

interface Props {
  value: EntriesGroupBy
  onChange: (mode: EntriesGroupBy) => void
  /** Leave the panel for the Pages wall. Absent when the flag is off. */
  onPages?: (() => void) | undefined
}

/**
 * How the entries panel is organized — plus the way out to Pages.
 *
 * One control, two kinds of thing. The first three are grouping values and
 * persist in `settings.entriesGroupBy`; **Pages is a navigation action, not a
 * fourth grouping.** Adding it to `EntriesGroupBy` would put a value in the
 * panel's own state that the panel cannot render, and the grouping the user
 * chose would be lost every time they went to read.
 */
export function EntriesGroupToggle({ value, onChange, onPages }: Props) {
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
      {onPages ? (
        <button
          type="button"
          className="entry-list__view-btn entry-list__view-btn--go"
          onClick={onPages}
          title="Read your pages side by side"
        >
          Pages
        </button>
      ) : null}
    </div>
  )
}
