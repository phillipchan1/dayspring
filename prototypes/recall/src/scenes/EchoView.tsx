import { useEffect, useState } from 'react'
import { ECHO, entryById, formatDate } from '../corpus'
import { Highlight } from '../Highlight'
import { SUBJECTS } from '../corpus'

export function EchoView() {
  const entry = entryById(ECHO.afterEntryId)
  const mom = SUBJECTS[0]!
  const [show, setShow] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setShow(true), 1100)
    return () => window.clearTimeout(t)
  }, [])

  if (!entry) return null

  return (
    <div className="paper">
      <div className="echo-page">
        <div className="echo-page__date">{formatDate(entry.date)}</div>
        <div className="echo-page__body">
          {entry.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {show && (
          <aside className="echo">
            <div className="echo__date">{formatDate('2025-04-27')}</div>
            <p className="echo__line">
              <Highlight text={ECHO.line} subject={mom} />
            </p>
          </aside>
        )}
      </div>
    </div>
  )
}
