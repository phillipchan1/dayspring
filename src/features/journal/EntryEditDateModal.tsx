import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Entry } from '@/lib/types'
import { deriveTitle } from './deriveTitle'

interface Props {
  entry: Entry | null
  onClose: () => void
  onSave: (entry: Entry, newCreatedAt: string) => void
}

/** Portaled modal for changing an entry's date. */
export function EntryEditDateModal({ entry, onClose, onSave }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dateValue, setDateValue] = useState('')

  // Populate the date input when the entry changes.
  useEffect(() => {
    if (entry) {
      setDateValue(entry.created_at.slice(0, 10))
    }
  }, [entry])

  // Focus the date input when the modal opens.
  useLayoutEffect(() => {
    if (entry) {
      // Defer so the portal renders first.
      const id = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(id)
    }
  }, [entry])

  // Keyboard dismiss.
  useEffect(() => {
    if (!entry) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'Enter' && dateValue) {
        e.preventDefault()
        e.stopPropagation()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  if (!entry) return null

  const title = deriveTitle(entry.body_markdown) || 'Untitled'

  function handleSave() {
    if (!entry || !dateValue) return
    // Preserve the original time-of-day so relative order within day is stable.
    const timePart = entry.created_at.slice(10)
    onSave(entry, dateValue + timePart)
  }

  return createPortal(
    <div
      className="entry-context-backdrop entry-context-backdrop--confirm"
      role="presentation"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="entry-edit-date glass-surface glass-surface--compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-edit-date-title"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="glass-surface__glow" aria-hidden />
        <h3 id="entry-edit-date-title" className="entry-edit-date__title">
          Change date
        </h3>
        <p className="entry-edit-date__entry-name">"{title}"</p>
        <div className="entry-edit-date__field">
          <label htmlFor="entry-date-input" className="entry-edit-date__label">
            Entry date
          </label>
          <input
            ref={inputRef}
            id="entry-date-input"
            type="date"
            className="entry-edit-date__input"
            value={dateValue}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDateValue(e.target.value)}
          />
        </div>
        <div className="entry-edit-date__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--accent"
            disabled={!dateValue || dateValue === entry.created_at.slice(0, 10)}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
