import { DIMENSION_COPY } from '../ascent.config'
import type { LearningData } from '../data/types'

interface Props {
  data: LearningData | null
  onDrill: () => void
}

/**
 * Learning — a QUESTION, never an answer, and never persisted. The app surfaces a
 * thread it noticed forming across lenses and hands it back as a question; the
 * drill-in shows the cross-lens convergence. What it means is the user's to name.
 */
export function LearningDimension({ data, onDrill }: Props) {
  if (!data) return null
  const resolution = data.resolution
  const eyebrow =
    resolution === 'year'
      ? DIMENSION_COPY.learning.year
      : resolution === 'quarter'
        ? DIMENSION_COPY.learning.quarter
        : DIMENSION_COPY.learning.month

  return (
    <section className="ascent-dim ascent-dim--learning">
      <span className="ascent-dim__eyebrow">{eyebrow}</span>
      <button type="button" className="ascent-learning__q" onClick={onDrill}>
        {data.question}
      </button>
      <button type="button" className="ascent-dim__open" onClick={onDrill}>
        {DIMENSION_COPY.learning.open}
      </button>
      <span className="ascent-dim__note">{DIMENSION_COPY.learning.note}</span>
    </section>
  )
}
