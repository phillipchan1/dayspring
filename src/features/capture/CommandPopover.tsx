import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import './Capture.css'

export type CommandPopoverVariant = 'neutral' | 'pray' | 'sense' | 'scripture'

interface CommandPopoverProps {
  anchor: InlinePanelAnchor
  onDismiss: () => void
  /** Screen-reader label for the panel. */
  ariaLabel: string
  /** `dialog` for capture; `listbox` for scripture results. */
  role?: 'dialog' | 'listbox'
  variant?: CommandPopoverVariant
  /** Chrome row above the body (e.g. scripture · from what you wrote). */
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
}

/**
 * Shared slash-command shell: column-anchored, flat elevated chrome, Esc/outside
 * dismiss, optional footer hint. Scripture, pray, sense, and remind all render inside.
 */
export function CommandPopover({
  anchor,
  onDismiss,
  ariaLabel,
  role = 'dialog',
  variant = 'neutral',
  header,
  footer,
  children,
}: CommandPopoverProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onDismiss()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onDismiss])

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      const t = e.target
      if (t instanceof Node && document.querySelector('.command-popover')?.contains(t)) return
      onDismiss()
    }
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onPointer, true)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onPointer, true)
    }
  }, [onDismiss])

  const panelWidth = Math.min(440, anchor.width, window.innerWidth - 32)
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(anchor.left, window.innerWidth - panelWidth - 16),
    width: panelWidth,
    maxWidth: panelWidth,
    zIndex: 8500,
    top: anchor.top,
    transform: anchor.placeAbove ? 'translateY(-100%)' : undefined,
  }

  return createPortal(
    <div
      className={`command-popover command-popover--${variant}`}
      style={style}
      role={role}
      aria-label={ariaLabel}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {header}
      <div className="command-popover__body">{children}</div>
      {footer != null && <footer className="command-popover__footer">{footer}</footer>}
    </div>,
    document.body,
  )
}

export function CommandPopoverHint({ children }: { children: ReactNode }) {
  return <span className="command-popover__hint">{children}</span>
}

export function CommandPopoverChrome({
  label,
  children,
}: {
  label: string
  children?: ReactNode
}) {
  return (
    <div className="command-popover__chrome">
      <IconBook aria-hidden />
      <span className="command-popover__chrome-label">{label}</span>
      {children}
    </div>
  )
}

function IconBook({ 'aria-hidden': ariaHidden }: { 'aria-hidden'?: boolean }) {
  return (
    <svg
      className="command-popover__chrome-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}
