import { useEffect, useState } from 'react'
import { JournalShell } from '../components/JournalShell'
import { ScriptureBlock } from '../components/ScriptureBlock'
import {
  ENTRY_AFTER,
  ENTRY_BEFORE,
  ENTRY_DATE,
  JAMES_4_8,
  PASTED_VERSE,
} from '../corpus'
import { esvOrgChapter } from '../lib/esvOrg'

type Phase = 'idle' | 'prose' | 'recognize' | 'block'

export function LandScene() {
  const [phase, setPhase] = useState<Phase>('idle')
  const landed = phase === 'block'

  useEffect(() => {
    if (phase !== 'prose') return
    const a = window.setTimeout(() => setPhase('recognize'), 700)
    return () => window.clearTimeout(a)
  }, [phase])

  useEffect(() => {
    if (phase !== 'recognize') return
    const a = window.setTimeout(() => setPhase('block'), 850)
    return () => window.clearTimeout(a)
  }, [phase])

  return (
    <div className="paper paper--journal">
      <JournalShell lampLit={landed} lampLabel="James 4:8">
        <header className="journal__head">
          <time className="journal__date">{ENTRY_DATE}</time>
        </header>
        <div className="journal__body">
          <p>{ENTRY_BEFORE}</p>
          {phase === 'idle' && <p className="journal__pasted journal__pasted--ghost">{PASTED_VERSE}</p>}
          {(phase === 'prose' || phase === 'recognize') && (
            <p className="journal__pasted journal__pasted--warming">{PASTED_VERSE}</p>
          )}
          {phase === 'block' && (
            <div className="scripture-block-wrap scripture-block-wrap--land">
              <ScriptureBlock text={JAMES_4_8} readMoreHref={esvOrgChapter('James', 4)} />
            </div>
          )}
          <p>{ENTRY_AFTER}</p>
        </div>
        {phase === 'idle' && (
          <div className="journal__hint">
            <button type="button" className="journal__cmd" onClick={() => setPhase('prose')}>
              Paste a verse from a Bible app
            </button>
          </div>
        )}
        {phase === 'recognize' && (
          <p className="recognize-whisper" aria-live="polite">
            James 4:8
          </p>
        )}
      </JournalShell>
    </div>
  )
}
