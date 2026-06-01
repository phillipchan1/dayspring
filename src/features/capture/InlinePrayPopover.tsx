import { useState } from 'react'
import { createSpiritualItem } from '@/lib/spiritual'
import { formatSpiritualBlock } from '@/lib/spiritualBlocks'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import type { PrayerType } from '@/lib/types'
import { CommandPopover, CommandPopoverHint } from './CommandPopover'
import { CommandProseField } from './CommandProseField'
import './Capture.css'

const PRAYER_TYPES: { id: PrayerType; label: string }[] = [
  { id: 'intercession', label: 'Intercession' },
  { id: 'gratitude', label: 'Gratitude' },
  { id: 'petition', label: 'Petition' },
  { id: 'praise', label: 'Praise' },
]

interface Props {
  entryId: string | null
  anchor: InlinePanelAnchor
  onInsert: (text: string) => void
  onClose: () => void
}

export function InlinePrayPopover({ entryId, anchor, onInsert, onClose }: Props) {
  const [text, setText] = useState('')
  const [prayerType, setPrayerType] = useState<PrayerType | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleCommit() {
    const content = text.trim()
    if (!content) return
    setError(null)
    const id = crypto.randomUUID()
    onInsert(formatSpiritualBlock('prayer', id, content))
    void createSpiritualItem({
      id,
      entry_id: entryId,
      type: 'prayer',
      content,
      metadata: prayerType ? { prayer_type: prayerType } : null,
    }).catch((e) => {
      setError(e instanceof Error ? e.message : 'Could not save')
    })
  }

  return (
    <CommandPopover
      anchor={anchor}
      onDismiss={onClose}
      ariaLabel="Prayer"
      variant="pray"
      footer={<CommandPopoverHint>⌘ enter to keep · esc to cancel</CommandPopoverHint>}
    >
      <p className="command-popover__label">prayer</p>
      <CommandProseField
        value={text}
        onChange={setText}
        onCommit={handleCommit}
        onDismiss={onClose}
        placeholder="What are you bringing…"
        variant="pray"
        aria-label="Prayer"
      />
      <div className="command-popover__chips" role="group" aria-label="Prayer type (optional)">
        {PRAYER_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="command-popover__chip"
            data-active={prayerType === t.id ? 'true' : undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPrayerType(prayerType === t.id ? null : t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && <p className="command-popover__error">{error}</p>}
    </CommandPopover>
  )
}
