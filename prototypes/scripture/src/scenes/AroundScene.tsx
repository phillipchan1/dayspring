import { useState } from 'react'
import { ChapterPane } from '../components/ChapterPane'
import { JournalShell } from '../components/JournalShell'
import { ScriptureBlock } from '../components/ScriptureBlock'
import {
  ENTRY_AFTER,
  ENTRY_BEFORE,
  ENTRY_DATE,
  JAMES_4_8,
  JAMES_CH4,
} from '../corpus'
import { esvOrgChapter } from '../lib/esvOrg'

export function AroundScene() {
  const [open, setOpen] = useState(false)

  return (
    <div className={`paper paper--split${open ? ' paper--with-pane' : ''}`}>
      <JournalShell lampLit={true} lampLabel="James 4:8">
        <header className="journal__head">
          <time className="journal__date">{ENTRY_DATE}</time>
        </header>
        <div className="journal__body">
          <p>{ENTRY_BEFORE}</p>
          <ScriptureBlock
            text={JAMES_4_8}
            onOpen={() => setOpen(true)}
            readMoreHref={esvOrgChapter('James', 4)}
          />
          <p>{ENTRY_AFTER}</p>
        </div>
      </JournalShell>
      {open && (
        <ChapterPane
          chapter={JAMES_CH4}
          highlightVerse={8}
          onClose={() => setOpen(false)}
          label="This chapter"
          readMore
        />
      )}
    </div>
  )
}
