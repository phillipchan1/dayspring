import { formatDate, type Entry, type Subject } from './corpus'
import { Highlight } from './Highlight'

export function EntrySheet({
  entry,
  subject,
  onClose,
}: {
  entry: Entry
  subject: Subject | null
  onClose: () => void
}) {
  return (
    <div className="sheet-scrim" onClick={onClose} role="presentation">
      <article
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={formatDate(entry.date)}
      >
        <button type="button" className="sheet__close" onClick={onClose}>
          Close
        </button>
        <p className="row__date">{formatDate(entry.date)}</p>
        {entry.paragraphs.map((p, i) => (
          <p key={i}>
            <Highlight text={p} subject={subject} />
          </p>
        ))}
      </article>
    </div>
  )
}
