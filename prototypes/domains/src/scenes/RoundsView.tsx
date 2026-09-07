import { useState } from 'react'
import { TODAY } from '../corpus'
import { domainsByLastWritten, formatDate, lastLineIn } from '../lib'

/**
 * The sit-down. Saturday.
 *
 * His own headings, laid out with a blank line under each. The app supplies the
 * order and nothing else — and the order is by when he last wrote in each one,
 * so the quiet ones settle to the bottom on their own.
 *
 * That ordering is the ONLY thing here that says a domain has gone quiet. No
 * date, no count, no "it has been a while". D-017 forbids a days-since and any
 * copy about not having written, and the point of doing it by order is that the
 * information arrives without a single word that could be read as a scolding.
 */
export function RoundsView({ onOpen }: { onOpen: (domain: string) => void }) {
  const domains = domainsByLastWritten(undefined, TODAY)
  const [showLast, setShowLast] = useState(false)

  return (
    <div className="desk">
      <div className="toggles" style={{ maxWidth: '52rem', margin: '0 auto 1rem' }}>
        <button
          className="toggle"
          data-on={showLast ? 'true' : undefined}
          onClick={() => setShowLast((v) => !v)}
        >
          what I said last time
        </button>
      </div>

      <article className="leaf">
        <div className="leaf__date">{formatDate(TODAY)}</div>

        <div className="rounds">
          {domains.map((d) => {
            const last = showLast ? lastLineIn(d.label, TODAY) : null
            return (
              <section className="round" key={d.label}>
                <div className="round__head">
                  <h2 className="dom dom--hash" style={{ margin: 0 }}>
                    {d.label}
                  </h2>
                  <button className="round__open" onClick={() => onOpen(d.label)}>
                    all of it
                  </button>
                </div>
                <div className="round__blank" />
                {last && <p className="round__last said">{last.text}</p>}
              </section>
            )
          })}
        </div>
      </article>
    </div>
  )
}
