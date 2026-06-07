import './SurfaceLoader.css'

/**
 * The shared "first light" loading state for full surfaces (Altar, Lamp, …).
 * A single ember→gold mark that breathes, with a quiet contemplative line —
 * never a spinner. Sits inside a surface container so the dawn glow shows behind.
 *
 * Pass `progress` to show honest backfill counts ("…1,200 / 2,825") while the
 * processing engine builds an imported archive.
 */
export function SurfaceLoader({
  label = 'Gathering…',
  progress,
}: {
  label?: string
  progress?: { completed: number; total: number } | undefined
}) {
  const showCount = progress && progress.total > 0
  return (
    <div className="surface-loader" role="status" aria-live="polite">
      <span className="surface-loader__mark" aria-hidden />
      <span className="surface-loader__label">{label}</span>
      {showCount ? (
        <span className="surface-loader__count">
          {progress!.completed.toLocaleString()} / {progress!.total.toLocaleString()}
        </span>
      ) : null}
    </div>
  )
}
