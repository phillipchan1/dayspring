import './SurfaceLoader.css'

/**
 * The shared "first light" / forming state for full surfaces (Altar, Ascent,
 * Lamp). A single ember→gold mark that breathes, a quiet contemplative line, and
 * — while an archive is being built — a calm progress reading (percent + count +
 * a thin gold bar). Never a spinner. Sits inside a surface container so the dawn
 * glow shows behind.
 */
export function SurfaceLoader({
  label = 'Gathering…',
  progress,
}: {
  label?: string
  progress?: { completed: number; total: number } | undefined
}) {
  const showProgress = progress && progress.total > 0
  const pct = showProgress ? Math.min(100, Math.round((progress!.completed / progress!.total) * 100)) : 0

  return (
    <div className="surface-loader" role="status" aria-live="polite">
      <span className="surface-loader__mark" aria-hidden />
      <span className="surface-loader__label">{label}</span>
      {showProgress ? (
        <div className="surface-loader__progress">
          <div className="surface-loader__bar" aria-hidden>
            <div className="surface-loader__bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="surface-loader__count">
            {pct}% · {progress!.completed.toLocaleString()} / {progress!.total.toLocaleString()}
          </span>
        </div>
      ) : null}
    </div>
  )
}
