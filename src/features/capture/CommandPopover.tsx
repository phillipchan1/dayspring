import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import { useIsMobile } from '@/hooks/useMediaQuery'
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
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const t = e.target
      if (t instanceof Node && document.querySelector('.command-popover')?.contains(t)) return
      onDismiss()
    }
    const t = window.setTimeout(() => {
      // `mousedown` covers desktop; `touchstart` covers phones where a tap on a
      // non-interactive surface doesn't reliably synthesize a mouse event.
      document.addEventListener('mousedown', onPointer, true)
      document.addEventListener('touchstart', onPointer, true)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onPointer, true)
      document.removeEventListener('touchstart', onPointer, true)
    }
  }, [onDismiss])

  const isMobile = useIsMobile()

  // On a phone the caret-anchored desktop placement lands the panel behind the
  // soft keyboard. Instead, dock it as a full-width sheet pinned just above the
  // keyboard, tracking the visual viewport so it follows the keyboard up/down.
  const keyboardInset = useKeyboardInset(isMobile)

  const panelWidth = Math.min(440, anchor.width, window.innerWidth - 32)
  const style: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: keyboardInset,
        zIndex: 8500,
      }
    : {
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
      className={`command-popover command-popover--${variant}${isMobile ? ' command-popover--sheet' : ''}`}
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

/**
 * Height of the soft keyboard (and any bottom browser chrome) in px, derived
 * from the visual viewport. Lets a bottom-docked sheet sit directly above the
 * keyboard instead of hiding behind it. Returns 0 on desktop / when idle.
 */
function useKeyboardInset(enabled: boolean): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    if (!enabled) {
      setInset(0)
      return
    }
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [enabled])
  return inset
}

export function CommandPopoverHint({ children }: { children: ReactNode }) {
  return <span className="command-popover__hint">{children}</span>
}

/**
 * Footer with a keyboard hint and, when editing an existing block, a Remove
 * action. `onMouseDown` is suppressed so clicking Remove doesn't blur-commit the
 * field first.
 */
export function CommandPopoverFooter({
  hint,
  onRemove,
}: {
  hint: string
  onRemove?: (() => void) | undefined
}) {
  if (!onRemove) return <CommandPopoverHint>{hint}</CommandPopoverHint>
  return (
    <div className="command-popover__footer-row">
      <button
        type="button"
        className="command-popover__remove"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onRemove}
      >
        Remove
      </button>
      <CommandPopoverHint>{hint}</CommandPopoverHint>
    </div>
  )
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
