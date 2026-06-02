import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react'
import type { CommandPopoverVariant } from './CommandPopover'

interface Props {
  value: string
  onChange: (value: string) => void
  onCommit: () => void | Promise<void>
  onDismiss: () => void
  /** When set, Enter and blur-commit only run if this returns true. */
  canCommit?: () => boolean
  placeholder?: string
  rows?: number
  variant?: CommandPopoverVariant
  autoFocus?: boolean
  'aria-label': string
}

/**
 * Prose capture field: Enter commits; Shift+Enter inserts a newline; blur commits
 * when non-empty or dismisses when empty.
 */
export function CommandProseField({
  value,
  onChange,
  onCommit,
  onDismiss,
  canCommit,
  placeholder,
  rows = 3,
  variant = 'neutral',
  autoFocus = true,
  'aria-label': ariaLabel,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const committingRef = useRef(false)

  useEffect(() => {
    if (!autoFocus) return
    const el = ref.current
    if (!el) return
    el.focus()
    // Place the caret at the end so editing existing text starts cleanly.
    const end = el.value.length
    el.setSelectionRange(end, end)
  }, [autoFocus])

  const commit = useCallback(async () => {
    if (committingRef.current) return
    if (canCommit && !canCommit()) return
    committingRef.current = true
    try {
      await onCommit()
    } finally {
      committingRef.current = false
    }
  }, [onCommit, canCommit])

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && e.shiftKey) return
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      void commit()
    }
  }

  function onBlur() {
    if (committingRef.current) return
    if (!value.trim()) {
      onDismiss()
      return
    }
    if (canCommit && !canCommit()) return
    void commit()
  }

  return (
    <textarea
      ref={ref}
      className={`command-popover__field command-popover__field--${variant}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      placeholder={placeholder}
      rows={rows}
      aria-label={ariaLabel}
    />
  )
}
