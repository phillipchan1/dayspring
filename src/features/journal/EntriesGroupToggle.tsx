import type { EntriesGroupBy } from './groupEntries'

const GROUPINGS: { value: EntriesGroupBy; label: string }[] = [
  { value: 'flat', label: 'All' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

interface Props {
  value: EntriesGroupBy
  onChange: (mode: EntriesGroupBy) => void
  /** True when the wall has the canvas. */
  pagesMode: boolean
  onPagesMode: (on: boolean) => void
}

/**
 * How you're reading — and then, if you're reading the list, how it's grouped.
 *
 * Two levels, because there are two questions and they aren't the same size.
 * **List and Pages are siblings**: one shows you titles and dates, the other
 * shows you the pages themselves, and both are ways of reading the same
 * archive. Pages was a fourth segment bolted onto the grouping control at
 * first, which made it look like a fourth way to sort a list — a navigation
 * action wearing a radio button's clothes.
 *
 * Grouping is a property of the list and appears only when the list is showing.
 * It persists in `settings.entriesGroupBy`; the mode does not, because which
 * way you're reading belongs to where you are, not to your preferences.
 */
export function EntriesGroupToggle({ value, onChange, pagesMode, onPagesMode }: Props) {
  return (
    <div className="entry-list__modes">
      <div className="entry-list__view-switcher" role="group" aria-label="How to read">
        <button
          type="button"
          className="entry-list__view-btn"
          data-active={!pagesMode ? 'true' : undefined}
          aria-pressed={!pagesMode}
          onClick={() => onPagesMode(false)}
        >
          List
        </button>
        <button
          type="button"
          className="entry-list__view-btn"
          data-active={pagesMode ? 'true' : undefined}
          aria-pressed={pagesMode}
          title="Your pages, side by side (⇧⌘1)"
          onClick={() => onPagesMode(true)}
        >
          Pages
        </button>
      </div>

      {!pagesMode && (
        <div className="entry-list__group-by" role="group" aria-label="Group entries">
          {GROUPINGS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="entry-list__group-btn"
              data-active={value === opt.value ? 'true' : undefined}
              aria-pressed={value === opt.value}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
