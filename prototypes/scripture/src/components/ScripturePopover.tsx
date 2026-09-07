import { COLOSSIANS_HITS } from '../corpus'

interface Props {
  query: string
  onClose: () => void
  onPick?: (reference: string) => void
}

export function ScripturePopover({ query, onClose, onPick }: Props) {
  const hits = query.toLowerCase().includes('coloss') ? COLOSSIANS_HITS : []

  return (
    <div className="popover-scrim" onClick={onClose} role="presentation">
      <div className="popover" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Scripture search">
        <header className="popover__head">
          <span className="popover__label">scripture · search by topic</span>
          <button type="button" className="popover__close" onClick={onClose}>
            esc
          </button>
        </header>
        <input className="popover__input" value={query} readOnly aria-label="Search query" />
        {hits.length === 0 ? (
          <p className="popover__empty">
            No chapter browse for &ldquo;{query}&rdquo; — only popular verses for this book.
          </p>
        ) : (
          <ul className="popover__list">
            {hits.map((h) => (
              <li key={h.reference}>
                <button
                  type="button"
                  className="popover__hit"
                  onClick={() => onPick?.(h.reference)}
                >
                  <span className="popover__ref">{h.reference}</span>
                  {h.reason && <span className="popover__reason">{h.reason}</span>}
                  <span className="popover__text">{h.text}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <footer className="popover__foot">↑↓ to choose · enter to set</footer>
      </div>
    </div>
  )
}
