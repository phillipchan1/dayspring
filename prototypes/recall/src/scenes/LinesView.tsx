import { useMemo, useState } from 'react'
import { SUBJECTS, entryById, formatDateShort, type Subject } from '../corpus'
import { EntrySheet } from '../EntrySheet'
import { Highlight } from '../Highlight'
import { matchingLines, wordSubject } from '../match'

export function LinesView({ initial }: { initial?: Subject }) {
  const seed = initial ?? SUBJECTS[0]!
  const [q, setQ] = useState(seed.label)
  const [openId, setOpenId] = useState<string | null>(null)

  const subject = useMemo(() => {
    const known = SUBJECTS.find((s) => s.label.toLowerCase() === q.trim().toLowerCase())
    return known ?? wordSubject(q)
  }, [q])

  const lines = subject ? matchingLines(subject) : []
  const open = openId ? entryById(openId) : undefined

  return (
    <div className="paper">
      <div className="strand">
        <input
          className="keep__field"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          spellCheck={false}
          aria-label="A word"
        />
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
