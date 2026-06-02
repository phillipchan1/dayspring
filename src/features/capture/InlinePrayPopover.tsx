import { useEffect, useRef, useState } from 'react'
import { createSpiritualItem, getSpiritualItem, updateSpiritualItem } from '@/lib/spiritual'
import { formatSpiritualBlock } from '@/lib/spiritualBlocks'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import type { PrayerType } from '@/lib/types'
import { CommandPopover, CommandPopoverFooter } from './CommandPopover'
import { CommandProseField } from './CommandProseField'
import { PROSE_KEEP_HINT, PROSE_SAVE_HINT } from './commandHints'
import './Capture.css'

/** Existing prayer being edited in place. */
export interface PrayEdit {
  id: string
  content: string
  prayerType: PrayerType | null
}

const PRAYER_TYPE_VALUES: PrayerType[] = ['intercession', 'gratitude', 'petition', 'praise']

function readPrayerType(metadata: Record<string, unknown> | null): PrayerType | null {
  const value = metadata?.prayer_type
  return typeof value === 'string' && PRAYER_TYPE_VALUES.includes(value as PrayerType)
    ? (value as PrayerType)
    : null
}

const PRAYER_TYPES: { id: PrayerType; label: string }[] = [
  { id: 'intercession', label: 'Intercession' },
  { id: 'gratitude', label: 'Gratitude' },
  { id: 'petition', label: 'Petition' },
  { id: 'praise', label: 'Praise' },
]

interface Props {
  entryId: string | null
  anchor: InlinePanelAnchor
  /** When set, the popover edits this existing prayer instead of creating one. */
  edit?: PrayEdit | undefined
  onInsert: (text: string) => void
  onRemove?: (() => void) | undefined
  onClose: () => void
}

export function InlinePrayPopover({ entryId, anchor, edit, onInsert, onRemove, onClose }: Props) {
  const [text, setText] = useState(edit?.content ?? '')
  const [prayerType, setPrayerType] = useState<PrayerType | null>(edit?.prayerType ?? null)
  const [error, setError] = useState<string | null>(null)
  // The prayer type lives in the DB row, not the fence — hydrate it when editing,
  // unless the user has already picked one in the meantime.
  const userPickedRef = useRef(false)
  const editId = edit?.id
  useEffect(() => {
    if (!editId) return
    let cancelled = false
    void getSpiritualItem(editId)
      .then((item) => {
        if (cancelled || userPickedRef.current || !item) return
        setPrayerType(readPrayerType(item.metadata))
      })
      .catch(() => null)
    return () => {
      cancelled = true
    }
  }, [editId])

  async function handleCommit() {
    const content = text.trim()
    if (!content) return
    setError(null)
    const id = edit?.id ?? crypto.randomUUID()
    const metadata = prayerType ? { prayer_type: prayerType } : null
    onInsert(formatSpiritualBlock('prayer', id, content))
    const persist = edit
      ? updateSpiritualItem(id, { content, metadata })
      : createSpiritualItem({ id, entry_id: entryId, type: 'prayer', content, metadata })
    void persist.catch((e) => {
      setError(e instanceof Error ? e.message : 'Could not save')
    })
  }

  return (
    <CommandPopover
      anchor={anchor}
      onDismiss={onClose}
      ariaLabel={edit ? 'Edit prayer' : 'Prayer'}
      variant="pray"
      footer={
        <CommandPopoverFooter
          hint={edit ? PROSE_SAVE_HINT : PROSE_KEEP_HINT}
          onRemove={edit ? onRemove : undefined}
        />
      }
    >
      <p className="command-popover__label">{edit ? 'edit prayer' : 'prayer'}</p>
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
            onClick={() => {
              userPickedRef.current = true
              setPrayerType(prayerType === t.id ? null : t.id)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && <p className="command-popover__error">{error}</p>}
    </CommandPopover>
  )
}
