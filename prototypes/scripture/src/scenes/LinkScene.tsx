import { useState } from 'react'
import { EsvOrgSheet } from '../components/EsvOrgSheet'
import { JournalShell } from '../components/JournalShell'
import { ScriptureBlock } from '../components/ScriptureBlock'
import {
  ENTRY_AFTER,
  ENTRY_BEFORE,
  ENTRY_DATE,
  JAMES_4_8,
  JAMES_CH4,
} from '../corpus'

export function LinkScene() {
  const [open, setOpen] = useState(false)

  return (
    <div className="paper paper--journal">
      <JournalShell lampLit={true} lampLabel="James 4:8">
        <header className="journal__head">
          <time className="journal__date">{ENTRY_DATE}</time>
        </header>
        <div className={`journal__body${open ? ' journal__body--dim' : ''}`}>
          <p>{ENTRY_BEFORE}</p>
          <ScriptureBlock
            text={JAMES_4_8}
            onOpen={() => setOpen(true)}
            linkLabel="read chapter on ESV.org"
          />
          <p>{ENTRY_AFTER}</p>
        </div>
      </JournalShell>
      {open && (
        <EsvOrgSheet chapter={JAMES_CH4} highlightVerse={8} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}
