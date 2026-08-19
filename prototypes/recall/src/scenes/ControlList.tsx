import { useMemo, useState } from 'react'
import { ENTRIES, SUBJECTS, entryById, formatDate, type Subject } from '../corpus'
import { EntrySheet } from '../EntrySheet'
import { matchingEntries, wordSubject } from '../match'

export function ControlList({ initial }: { initial?: Subject }) {
  const seed = initial ?? SUBJECTS[0]!
  const [q, setQ] = useState(seed.label)
  const [openId, setOpenId] = useState<string | null>(null)

  const subject = useMemo(() => {
    const known = SUBJECTS.find((s) => s.label.toLowerCase() === q.trim().toLowerCase())
    return known ?? wordSubject(q)
  }, [q])

  const entries = subject ? matchingEntries(subject) : ENTRIES
  const open = openId ? entryById(openId) : undefined

  return (
    <div className="paper">
      <div className="list">
        <input
          className="list__field"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          spellCheck={false}
          aria-label="Find"
        />
        {entries.map((e) => (
          <button type="button" className="row" key={e.id} onClick={() => setOpenId(e.id)}>
            <div className="row__date">{formatDate(e.date)}</div>
            <div className="row__lede">{e.paragraphs[0]}</div>
          </button>
        ))}
      </div>
      {open && <EntrySheet entry={open} subject={subject} onClose={() => setOpenId(null)} />}
    </div>
  )
}
