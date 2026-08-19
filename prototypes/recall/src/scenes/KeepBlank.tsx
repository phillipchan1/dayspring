import { useMemo, useState } from 'react'
import { formatDateShort } from '../corpus'
import { Highlight } from '../Highlight'
import { matchingLines, wordSubject } from '../match'

export function KeepBlank() {
  const [q, setQ] = useState('')
  const subject = useMemo(() => wordSubject(q), [q])
  const lines = subject ? matchingLines(subject) : []

  return (
    <div className="paper">
      <div className="keep">
        <input
          className="keep__field"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          spellCheck={false}
          aria-label="A word"
        />
        {subject &&
          lines.map((line) => (
            <div className="line" key={`${line.entryId}-${line.index}`}>
              <div className="line__date">{formatDateShort(line.date)}</div>
              <p className="line__text">
                <Highlight text={line.text} subject={subject} />
              </p>
            </div>
          ))}
      </div>
    </div>
  )
}
