import { useCallback, useRef, useState, type KeyboardEvent } from 'react'
import { createReminder, type ReminderHorizon } from '@/lib/reminders'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import { CommandPopover, CommandPopoverHint } from './CommandPopover'
import './Capture.css'

const HORIZONS: { id: ReminderHorizon; label: string }[] = [
  { id: '1w', label: '1 week' },
  { id: '1m', label: '1 month' },
  { id: '3m', label: '3 months' },
  { id: '1y', label: 'a year' },
]

interface Props {
  entryId: string | null
  sentence: string
  anchor: InlinePanelAnchor
  onClose: () => void
}

export function InlineRemindPopover({ entryId, sentence, anchor, onClose }: Props) {
  const [text, setText] = useState(sentence)
  const [horizon, setHorizon] = useState<ReminderHorizon | null>(null)
  const [error, setError] = useState<string | null>(null)
  const committingRef = useRef(false)
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  const handleCommit = useCallback(async () => {
    if (!horizon || !text.trim() || committingRef.current) return
    committingRef.current = true
    setError(null)
    if (horizon === '1y') {
      await new Promise((r) => setTimeout(r, 320))
    }
    try {
      await createReminder({ entry_id: entryId, content: text.trim(), horizon })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save reminder')
      committingRef.current = false
    }
  }, [entryId, horizon, text, onClose])

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      e.stopPropagation()
      void handleCommit()
    }
  }

  function onBlur() {
    if (committingRef.current) return
    if (!text.trim()) {
      onClose()
      return
    }
    if (!horizon) return
    void handleCommit()
  }

  return (
    <CommandPopover
      anchor={anchor}
      onDismiss={onClose}
      ariaLabel="Return to this"
      footer={
        <CommandPopoverHint>
          {horizon
            ? '⌘ enter to keep · esc to cancel'
            : '⌘ enter to keep · pick a time · esc to cancel'}
        </CommandPopoverHint>
      }
    >
      <p className="command-popover__label">return to this</p>
      <textarea
        ref={fieldRef}
        className="command-popover__field"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        rows={2}
        autoFocus
        aria-label="Reminder text"
      />
      <div className="command-popover__pills" role="group" aria-label="When to return">
        {HORIZONS.map((h) => (
          <button
            key={h.id}
            type="button"
            className="command-popover__pill"
            data-active={horizon === h.id ? 'true' : undefined}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setHorizon(h.id)}
          >
            {h.label}
          </button>
        ))}
      </div>
      {error && <p className="command-popover__error">{error}</p>}
    </CommandPopover>
  )
}
