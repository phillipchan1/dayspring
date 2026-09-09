import { formatNewEntryShortcut } from '@/features/shortcuts/shortcuts'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRowDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

interface Props {
  dateIso: string
  wallKey: string
  tabIndex: number
  onFocus: (wallKey: string) => void
  onKeyDown: (wallKey: string, e: React.KeyboardEvent) => void
  onNew: () => void
}

/**
 * The unwritten next page.
 *
 * Same object at both distances — a card among cards, a row among rows — so
 * the journal has one place to begin. Unlike written pages, this one has an
 * explicit plus and action label: it should read as the door to a new page,
 * not as another empty-looking entry in the archive.
 */
export function BlankPageCard({
  dateIso,
  wallKey,
  tabIndex,
  onFocus,
  onKeyDown,
  onNew,
}: Props) {
  return (
    <button
      type="button"
      className="pgc"
      data-blank="true"
      data-wall-key={wallKey}
      aria-label="New entry"
      title={`New entry (${formatNewEntryShortcut()})`}
      tabIndex={tabIndex}
      onFocus={() => onFocus(wallKey)}
      onKeyDown={(e) => onKeyDown(wallKey, e)}
      onClick={onNew}
    >
      <time className="pgc__date" dateTime={dateIso}>
        {formatDate(dateIso)}
      </time>
      <div className="pgc__body">
        <span className="pgc__new-mark" aria-hidden="true">
          +
        </span>
        <span className="pgc__blank">Start a new page</span>
      </div>
    </button>
  )
}

export function BlankPageRow({
  dateIso,
  wallKey,
  tabIndex,
  onFocus,
  onKeyDown,
  onNew,
}: Props) {
  return (
    <button
      type="button"
      className="pgr"
      data-blank="true"
      data-current-week="true"
      data-wall-key={wallKey}
      aria-label="New entry"
      title={`New entry (${formatNewEntryShortcut()})`}
      tabIndex={tabIndex}
      onFocus={() => onFocus(wallKey)}
      onKeyDown={(e) => onKeyDown(wallKey, e)}
      onClick={onNew}
    >
      <time className="pgr__date" dateTime={dateIso}>
        {formatRowDate(dateIso)}
      </time>
      <span className="pgr__line">
        <span className="pgr__new-mark" aria-hidden="true">
          +
        </span>
        Start a new page
      </span>
    </button>
  )
}
