import { useState } from 'react'
import { JournalShell } from '../components/JournalShell'
import { ScripturePopover } from '../components/ScripturePopover'
import {
  ENTRY_AFTER,
  ENTRY_BEFORE,
  ENTRY_DATE,
  PASTED_VERSE,
} from '../corpus'

export function Today() {
  const [popover, setPopover] = useState(false)

  return (
    <div className="paper paper--journal">
      <JournalShell lampLit={false}>
        <header className="journal__head">
          <time className="journal__date">{ENTRY_DATE}</time>
        </header>
        <div className="journal__body">
          <p>{ENTRY_BEFORE}</p>
          <p className="journal__pasted">{PASTED_VERSE}</p>
          <p>{ENTRY_AFTER}</p>
        </div>
        <div className="journal__hint">
          <button type="button" className="journal__cmd" onClick={() => setPopover(true)}>
            /scripture Colossians
          </button>
        </div>
      </JournalShell>
      {popover && <ScripturePopover query="Colossians" onClose={() => setPopover(false)} />}
    </div>
  )
}
