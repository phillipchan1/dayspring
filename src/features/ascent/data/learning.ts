/**
 * Learning — a QUESTION, never an answer. MOCK adapter. RENDER-TIME ONLY.
 *
 * The payoff is cross-lens convergence: the same thread surfacing in scripture,
 * trading, family, and work. The app gathers the threads; what they mean is the
 * user's to name — so this is phrased as a question and is NEVER persisted (no
 * id, no save action, no write-back). The real source is a synthesis output that
 * emits a learning plus its source moments across lenses.
 *
 * // TODO: wire real data — replace fixtures with the cross-lens synthesis output.
 * Keep it render-time only: do not add a table, a save, or any write-back.
 */

import type { LearningData, Resolution } from './types'

// Mirrors the attached prototype (dayspring_learning_threads_drilldown.html):
// one thread woven from four life-domains, each a verbatim fragment.
const FRAGMENTS = [
  { lens: 'scripture', text: 'apart from you, nothing.', dateLabel: 'Feb 9' },
  { lens: 'trading', text: 'i stopped forcing the trade.', dateLabel: 'Mar 22' },
  { lens: 'family', text: 'homeschool softened when i let go.', dateLabel: 'Apr 15' },
  { lens: 'work', text: 'it came when i quit pushing.', dateLabel: 'May 6' },
]

export function loadLearning(resolution: Resolution): LearningData | null {
  // Learning begins at the Hillside; the Valley stays with the raw days.
  if (resolution === 'week') return null

  const question =
    resolution === 'month'
      ? 'you started to see something about receiving over forcing…'
      : resolution === 'quarter'
        ? 'is presence coming before outcome?'
        : 'what did this year teach you about letting go?'

  // Fewer fragments at the month (just beginning to see); all of them by the year.
  const take = resolution === 'month' ? 2 : 4

  return {
    resolution,
    question,
    fragments: FRAGMENTS.slice(0, take).map((f) => ({ entryId: null, ...f })),
  }
}
