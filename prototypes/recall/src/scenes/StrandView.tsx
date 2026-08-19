import { useState } from 'react'
import { SUBJECTS, entryById, formatDate, formatDateShort, type Subject } from '../corpus'
import { EntrySheet } from '../EntrySheet'
import { HeatBand } from '../HeatBand'
import { Highlight } from '../Highlight'
import { coOccurs, matchingLines, monthBand, occurrenceCount } from '../match'

const CARRIED = SUBJECTS

export function StrandView({ initialKey }: { initialKey?: string }) {
  const start = CARRIED.find((s) => s.key === initialKey) ?? CARRIED[0]!
  const [subject, setSubject] = useState<Subject>(start)
  const [openId, setOpenId] = useState<string | null>(null)

  const lines = matchingLines(subject)
  const first = lines[0]
  const last = lines[lines.length - 1]
  const also = coOccurs(subject, CARRIED)
  const open = openId ? entryById(openId) : undefined

  return (
    <div className="paper paper--split">
      <nav className="rail" aria-label="Names">
        {CARRIED.map((s) => (
          <button
            type="button"
            className="rail__name"
            key={s.key}
            data-on={s.key === subject.key ? 'true' : undefined}
            onClick={() => setSubject(s)}
          >
            {s.label}
            <span className="rail__meta">{occurrenceCount(s)}</span>
          </button>
        ))}
      </nav>
      <div className="strand">
        <h1 className="strand__title">{subject.label}</h1>
        <div className="strand__facts">
          {first && (
            <span>
              First <strong>{formatDate(first.date)}</strong>
            </span>
          )}
          {last && (
            <span>
              Most recent <strong>{formatDate(last.date)}</strong>
            </span>
          )}
          <span>
            <strong>{lines.length}</strong> {lines.length === 1 ? 'line' : 'lines'}
          </span>
        </div>
        <HeatBand cells={monthBand(subject)} />
        {also.length > 0 && (
          <p className="also">
            Named in the same entries:{' '}
            {also.map((a, i) => (
              <span key={a.label}>
                {i > 0 ? ', ' : ''}
                <button
                  type="button"
                  onClick={() => {
                    const next = CARRIED.find((s) => s.label === a.label)
                    if (next) setSubject(next)
                  }}
                >
                  {a.label}
                </button>
              </span>
            ))}
          </p>
        )}
        {lines.map((line) => (
          <button
            type="button"
            className="line"
            key={`${line.entryId}-${line.index}`}
            onClick={() => setOpenId(line.entryId)}
          >
            <div className="line__date">{formatDateShort(line.date)}</div>
            <div>
              <p className="line__text">
                <Highlight text={line.text} subject={subject} />
              </p>
              {line.capture === 'car' && <span className="line__car">from the car</span>}
            </div>
          </button>
        ))}
      </div>
      {open && <EntrySheet entry={open} subject={subject} onClose={() => setOpenId(null)} />}
    </div>
  )
}
