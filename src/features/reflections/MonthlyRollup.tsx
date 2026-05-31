import type { RollupPayload } from '@/lib/insights'

interface Props {
  payload: RollupPayload
  /** Open a single entry in the journal reader. */
  onOpenEntry: (entryId: string) => void
  /** Filter the journal's entry list to a set of entries (topic navigation). */
  onFilterEntries: (entryIds: string[]) => void
}

function fmtDay(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function fmtPeriodTitle(start: string, type: string): string {
  const d = new Date(`${start}T00:00:00Z`)
  if (type === 'monthly') {
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
  return fmtDay(start)
}

export function MonthlyRollup({ payload, onOpenEntry, onFilterEntries }: Props) {
  const { period, quotes, facts, observation, topics } = payload
  const title = fmtPeriodTitle(period.start, period.type)

  return (
    <article className="rollup">
      <header className="rollup__header">
        <div className="rollup__glow" aria-hidden="true" />
        <p className="rollup__eyebrow">{title}</p>
        <h1 className="rollup__title">In your own words</h1>
      </header>

      {/* You wrote — the heart. Verbatim, validated. */}
      {quotes.length > 0 && (
        <section className="rollup__section">
          <h2 className="rollup__h2">You wrote</h2>
          <div className="rollup__quotes">
            {quotes.map((q, i) => (
              <blockquote key={`${q.entry_id}-${i}`} className="rollup-quote">
                <p className="rollup-quote__text">{q.text}</p>
                <div className="rollup-quote__meta">
                  <span className="rollup-quote__date">{fmtDay(q.date)}</span>
                  <button
                    type="button"
                    className="rollup-quote__open"
                    onClick={() => onOpenEntry(q.entry_id)}
                  >
                    → open entry
                  </button>
                </div>
              </blockquote>
            ))}
          </div>
        </section>
      )}

      {/* By the numbers — computed in code. */}
      <section className="rollup__section">
        <h2 className="rollup__h2">The month, by the numbers</h2>
        <div className="rollup__stats">
          <Stat value={`${facts.days_written}/${facts.days_in_period}`} label="days written" />
          <Stat value={facts.words.toLocaleString()} label="words" />
          <Stat value={`${facts.longest_streak}`} label="day streak" />
          {facts.weeks_reflected !== null && (
            <Stat value={`${facts.weeks_reflected}`} label="weeks reflected" />
          )}
        </div>
      </section>

      {/* One hedged note — hidden entirely if empty. */}
      {observation && observation.text.trim().length > 0 && (
        <section className="rollup__section">
          <h2 className="rollup__h2">One thing I noticed</h2>
          <aside className="rollup-observation">{observation.text}</aside>
        </section>
      )}

      {/* Topics you returned to — navigation, not insight. */}
      {topics.length > 0 && (
        <section className="rollup__section">
          <h2 className="rollup__h2">Topics you returned to</h2>
          <div className="rollup__topics">
            {topics.map((t) => (
              <button
                key={t.label}
                type="button"
                className="topic-chip"
                onClick={() => onFilterEntries(t.entry_ids)}
                title={`Show the ${t.count} ${t.count === 1 ? 'entry' : 'entries'} about ${t.label}`}
              >
                {t.label}
                <span className="topic-chip__count">{t.count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className="rollup__footer">
        Built from {facts.days_written} {facts.days_written === 1 ? 'day' : 'days'} of writing
        {facts.weeks_reflected !== null && ` across ${facts.weeks_reflected} ${facts.weeks_reflected === 1 ? 'week' : 'weeks'}`}
        {' → rolls up into your year-in-review.'}
      </footer>
    </article>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat-card">
      <div className="stat-card__value">{value}</div>
      <div className="stat-card__label">{label}</div>
    </div>
  )
}
