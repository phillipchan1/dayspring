import './SurfaceLoader.css'

/**
 * The shared "first light" loading state for full surfaces (Altar, Lamp, …).
 * A single ember→gold mark that breathes, with a quiet contemplative line —
 * never a spinner. Sits inside a surface container so the dawn glow shows behind.
 */
export function SurfaceLoader({ label = 'Gathering…' }: { label?: string }) {
  return (
    <div className="surface-loader" role="status" aria-live="polite">
      <span className="surface-loader__mark" aria-hidden />
      <span className="surface-loader__label">{label}</span>
    </div>
  )
}
