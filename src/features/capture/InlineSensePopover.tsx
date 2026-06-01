import { useState } from 'react'
import { createSpiritualItem } from '@/lib/spiritual'
import { formatSpiritualBlock } from '@/lib/spiritualBlocks'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import { CommandPopover, CommandPopoverHint } from './CommandPopover'
import { CommandProseField } from './CommandProseField'
import './Capture.css'

interface Props {
  entryId: string | null
  anchor: InlinePanelAnchor
  onInsert: (text: string) => void
  onClose: () => void
}

export function InlineSensePopover({ entryId, anchor, onInsert, onClose }: Props) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleCommit() {
    const content = text.trim()
    if (!content) return
    setError(null)
    const id = crypto.randomUUID()
    onInsert(formatSpiritualBlock('sense', id, content))
    void createSpiritualItem({
      id,
      entry_id: entryId,
      type: 'sense',
      content,
    }).catch((e) => {
      setError(e instanceof Error ? e.message : 'Could not save')
    })
  }

  return (
    <CommandPopover
      anchor={anchor}
      onDismiss={onClose}
      ariaLabel="A sense"
      variant="sense"
      footer={<CommandPopoverHint>⌘ enter to keep · esc to cancel</CommandPopoverHint>}
    >
      <p className="command-popover__label">a sense</p>
      <CommandProseField
        value={text}
        onChange={setText}
        onCommit={handleCommit}
        onDismiss={onClose}
        placeholder="Write it here…"
        rows={4}
        variant="sense"
        aria-label="A sense"
      />
      {error && <p className="command-popover__error">{error}</p>}
    </CommandPopover>
  )
}
