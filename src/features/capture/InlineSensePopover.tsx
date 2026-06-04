import { useRef, useState } from 'react'
import { createSpiritualItem, updateSpiritualItem } from '@/lib/spiritual'
import { formatSpiritualBlock } from '@/lib/spiritualBlocks'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import { CommandPopover, CommandPopoverFooter } from './CommandPopover'
import { CommandProseField } from './CommandProseField'
import { PROSE_KEEP_HINT, PROSE_SAVE_HINT } from './commandHints'
import './Capture.css'

/** Existing sense being edited in place. */
export interface SenseEdit {
  id: string
  content: string
}

interface Props {
  entryId: string | null
  anchor: InlinePanelAnchor
  /** When set, the popover edits this existing sense instead of creating one. */
  edit?: SenseEdit | undefined
  onInsert: (text: string) => void
  onRemove?: (() => void) | undefined
  onClose: () => void
}

export function InlineSensePopover({ entryId, anchor, edit, onInsert, onRemove, onClose }: Props) {
  const [text, setText] = useState(edit?.content ?? '')
  const [error, setError] = useState<string | null>(null)
  // Guard against key-repeat or blur firing a second insert before React unmounts.
  const committedRef = useRef(false)

  function handleCommit() {
    const content = text.trim()
    if (!content) return
    if (committedRef.current) return
    committedRef.current = true
    setError(null)
    const id = edit?.id ?? crypto.randomUUID()
    onInsert(formatSpiritualBlock('sense', id, content))
    const persist = edit
      ? updateSpiritualItem(id, { content })
      : createSpiritualItem({ id, entry_id: entryId, type: 'sense', content })
    void persist.catch((e) => {
      setError(e instanceof Error ? e.message : 'Could not save')
    })
  }

  return (
    <CommandPopover
      anchor={anchor}
      onDismiss={onClose}
      ariaLabel={edit ? 'Edit a sense' : 'A sense'}
      variant="sense"
      footer={
        <CommandPopoverFooter
          hint={edit ? PROSE_SAVE_HINT : PROSE_KEEP_HINT}
          onRemove={edit ? onRemove : undefined}
        />
      }
    >
      <p className="command-popover__label">{edit ? 'edit a sense' : 'a sense'}</p>
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
