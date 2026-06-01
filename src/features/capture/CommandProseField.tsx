import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react'
import type { CommandPopoverVariant } from './CommandPopover'

interface Props {
  value: string
  onChange: (value: string) => void
  onCommit: () => void | Promise<void>
  onDismiss: () => void
  /** When set, ⌘/Ctrl+Enter and blur-commit only run if this returns true. */
  canCommit?: () => boolean
  placeholder?: string
  rows?: number
  variant?: CommandPopoverVariant
  autoFocus?: boolean
  'aria-label': string
}

/**
 * Prose capture field: Enter inserts a newline; ⌘/Ctrl+Enter commits; blur commits
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
    if (autoFocus) ref.current?.focus()
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
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
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
