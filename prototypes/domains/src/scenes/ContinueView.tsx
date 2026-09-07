import { useState } from 'react'
import { ENTRIES, TODAY } from '../corpus'
import { formatDate, headingLabel, lastLineIn } from '../lib'

/**
 * The last thing he said here.
 *
 * He writes `## family`, and the sentence he wrote under that heading the last
 * time is in the margin. Not a summary. Not a prompt. His own words, with the
 * date, and a way to make it go away.
 *
 * It never inserts itself into the document. The blank line stays blank — the
 * only thing that changed is that it is no longer a blank page.
 */
export function ContinueView() {
  const today = ENTRIES[ENTRIES.length - 1]!
  const written = today.paragraphs.slice(0, 2)
  const domain = 'family'
  const last = lastLineIn(domain, TODAY)

  const [dismissed, setDismissed] = useState(false)
  const [typed, setTyped] = useState('')

  return (
    <div className="desk">
      <article className="leaf">
        <div className="leaf__date">{formatDate(TODAY)}</div>

        <div className="doc">
          {written.map((p, i) => {
            const label = headingLabel(p)
            return label ? <h2 key={i}>{label}</h2> : <p key={i}>{p}</p>
          })}

          <h2>{domain}</h2>

          {!dismissed && last && (
            <aside className="margin">
              <p className="margin__quote said">{last.text}</p>
              <div className="margin__foot">
                <span className="stamp">{formatDate(last.date)}</span>
                <button className="margin__dismiss" onClick={() => setDismissed(true)}>
                  dismiss
                </button>
              </div>
            </aside>
          )}

          <p>
            <input
              className="doc__input doc__input--wide"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </p>
        </div>
      </article>
    </div>
  )
}
