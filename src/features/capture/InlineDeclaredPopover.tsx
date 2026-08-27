import { useRef, useState } from 'react'
import { MARK_KIND } from '@/lib/markKinds'
import { createSpiritualItem, updateSpiritualItem } from '@/lib/spiritual'
import { formatSpiritualBlock } from '@/lib/spiritualBlocks'
import type { SpiritualItemType } from '@/lib/types'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import { CommandPopover, CommandPopoverFooter } from './CommandPopover'
import { CommandProseField } from './CommandProseField'
import { PROSE_KEEP_HINT, PROSE_SAVE_HINT } from './commandHints'
import './Capture.css'

/** Existing marking being edited in place. */
export interface DeclaredEdit {
  id: string
  content: string
}

interface Props {
  kind: SpiritualItemType
  entryId: string | null
  anchor: InlinePanelAnchor
  /** When set, the popover edits this existing marking instead of creating one. */
  edit?: DeclaredEdit | undefined
  onInsert: (text: string) => void
  onRemove?: (() => void) | undefined
  onClose: () => void
}

/**
 * The capture for a declared kind whose whole content is the writer's own
 * sentence — gift, desire, learned, story, absence.
 *
 * One component for all of them, driven by the kind table. Prayer and sense keep
 * their own popovers: prayer carries a type alongside its text, and sense has a
 * shipped voice this doesn't try to reproduce. Scripture is a different thing
 * entirely — it fetches verbatim ESV text.
 *
 * The placeholder is the kind's own gloss, so the field asks the question the
 * kind exists to ask instead of a generic "Write it here…".
 */
export function InlineDeclaredPopover({
  kind,
  entryId,
  anchor,
  edit,
  onInsert,
  onRemove,
  onClose,
}: Props) {
  const meta = MARK_KIND[kind]
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
    onInsert(formatSpiritualBlock(kind, id, content))
    const persist = edit
      ? updateSpiritualItem(id, { content })
      : createSpiritualItem({ id, entry_id: entryId, type: kind, content })
    void persist.catch((e) => {
      setError(e instanceof Error ? e.message : 'Could not save')
    })
  }

  const label = meta.label.toLowerCase()

  return (
    <CommandPopover
      anchor={anchor}
      onDismiss={onClose}
      ariaLabel={edit ? `Edit ${label}` : meta.label}
      variant="declared"
      tone={meta.tone}
      footer={
        <CommandPopoverFooter
          hint={edit ? PROSE_SAVE_HINT : PROSE_KEEP_HINT}
          onRemove={edit ? onRemove : undefined}
        />
      }
    >
      <p className="command-popover__label">{edit ? `edit ${label}` : label}</p>
      <CommandProseField
        value={text}
        onChange={setText}
        onCommit={handleCommit}
        onDismiss={onClose}
        placeholder={meta.gloss}
        rows={4}
        variant="declared"
        aria-label={meta.label}
      />
      {error && <p className="command-popover__error">{error}</p>}
    </CommandPopover>
  )
}
