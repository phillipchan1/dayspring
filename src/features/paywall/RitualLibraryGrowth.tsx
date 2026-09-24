import { LIBRARY_CADENCE, formatLibraryGrowth, latestLibraryUpdate } from '@/editor/practices/practicesData'
import './RitualLibraryGrowth.css'

/**
 * Proof the rituals library grows — not just a sentence that says it does.
 * Used on purchase surfaces so a reviewer can see the shelf count and the
 * most recent addition without opening the library.
 */
export function RitualLibraryGrowth({ className }: { className?: string }) {
  const latest = latestLibraryUpdate()
  return (
    <p className={className ?? 'ritual-growth'} data-testid="ritual-library-growth">
      <span className="ritual-growth__count">{formatLibraryGrowth()}</span>
      <span className="ritual-growth__cadence">{LIBRARY_CADENCE}</span>
      <span className="ritual-growth__latest">Latest: {latest.name}</span>
    </p>
  )
}
