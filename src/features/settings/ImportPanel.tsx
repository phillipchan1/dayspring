import { IMPORT_SOURCES, type ImportSourceDef } from '@/lib/import/sources'
import { ImportRunner } from './ImportRunner'

interface Props {
  selectedId: string | null
  onSelectSource: (sourceId: string) => void
  onBack: () => void
}

/** Settings → Import: pick a source, follow its export steps, then drop the file. */
export function ImportPanel({ selectedId, onSelectSource, onBack }: Props) {
  const selected = selectedId ? IMPORT_SOURCES.find((s) => s.id === selectedId) ?? null : null

  if (selected) {
    return <SourceDetail source={selected} onBack={onBack} />
  }

  return (
    <div>
      <p className="settings-section__intro">
        Bring your history with you. Everything is parsed privately in your browser — your entries
        never pass through another service.
      </p>
      <div className="import-grid">
        {IMPORT_SOURCES.map((s) => {
          const soon = s.status === 'coming-soon'
          return (
            <button
              key={s.id}
              type="button"
              className="import-card"
              disabled={soon}
              onClick={() => onSelectSource(s.id)}
            >
              <span className="import-card__badge" style={{ background: s.tint }}>
                {s.monogram || s.name.slice(0, 2)}
              </span>
              <span className="import-card__body">
                <span className="import-card__name">{s.name}</span>
                <span className="import-card__tagline">{s.tagline}</span>
              </span>
              {soon ? (
                <span className="import-card__soon">Soon</span>
              ) : (
                <span className="import-card__go" aria-hidden="true">→</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SourceDetail({ source, onBack }: { source: ImportSourceDef; onBack: () => void }) {
  return (
    <div>
      <button type="button" className="settings-back" onClick={onBack}>
        ← All sources
      </button>

      <div className="import-detail__head">
        <span className="import-card__badge" style={{ background: source.tint }}>
          {source.monogram || source.name.slice(0, 2)}
        </span>
        <div>
          <h3 className="import-detail__name">{source.name}</h3>
          <p className="import-detail__tagline">{source.tagline}</p>
        </div>
      </div>

      {source.instructions && (
        <ol className="import-steps">
          {source.instructions.map((step, i) => (
            <li key={i}>
              <span className="import-steps__num">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      )}

      {source.note && <p className="import-detail__note">{source.note}</p>}

      {source.status === 'available' ? (
        <ImportRunner source={source} />
      ) : (
        <div className="import-soon-banner">
          We’re polishing this importer. Keep your export handy — it’ll land here soon.
        </div>
      )}
    </div>
  )
}
