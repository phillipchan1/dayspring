import { HAS_REAL, type Source } from '../lib/source'

/**
 * The source toggle lives on every data screen rather than in a settings
 * corner, because the distance between the two archives IS the finding. A
 * prototype that only ever showed the invented one would be arguing for a
 * surface on evidence that does not exist.
 */
export function Masthead({
  label,
  source,
  onSource,
  onBack,
}: {
  label: string
  source: Source
  onSource: (s: Source) => void
  onBack?: () => void
}) {
  return (
    <div className="masthead">
      {onBack ? (
        <button type="button" className="masthead__back" onClick={onBack}>
          ← {label}
        </button>
      ) : (
        <span>{label}</span>
      )}
      <div className="source">
        <button
          type="button"
          className="source__btn"
          aria-pressed={source === 'invented'}
          onClick={() => onSource('invented')}
        >
          A writer’s five months
        </button>
        {/* Absent on any machine without the local extract — which is every
            machine except the one that ran it. See lib/source.ts. */}
        <button
          type="button"
          className="source__btn"
          aria-pressed={source === 'real'}
          disabled={!HAS_REAL}
          title={HAS_REAL ? undefined : 'Run npm run extract:rituals to load a real archive'}
          onClick={() => onSource('real')}
        >
          The real archive
        </button>
      </div>
    </div>
  )
}
