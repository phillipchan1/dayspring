import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { InlinePanelAnchor } from '@/editor/inlinePanelAnchor'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { useKeyboardInset } from '@/hooks/useKeyboard'
import { useSheetDismiss } from '@/hooks/useSheetDismiss'
import './Capture.css'

export type CommandPopoverVariant = 'neutral' | 'pray' | 'sense' | 'scripture' | 'image'

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
  /** Skip the auto viewport top-clamp when the caller manages `anchor.top`
   *  itself (e.g. the image caption popover, which tracks its photo on scroll). */
  skipViewportClamp?: boolean
  children: ReactNode
}

/**
 * Shared slash-command shell: column-anchored, flat elevated chrome, Esc/outside
 * dismiss, optional footer hint. Scripture, pray, sense, practice, and image render inside.
 */
export function CommandPopover({
  anchor,
  onDismiss,
  ariaLabel,
  role = 'dialog',
  variant = 'neutral',
  header,
  footer,
  skipViewportClamp = false,
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
  const panelRef = useRef<HTMLDivElement>(null)

  // Pull the panel up if it would spill past the bottom of the viewport — a tall
  // photo can anchor a caption popover far below the fold. Desktop, anchored-below
  // only; never pushes down, so a panel that already fits is untouched. A
  // ResizeObserver re-clamps when content grows after mount (e.g. the preview
  // image finishes loading and the panel gets taller).
  const [topClamp, setTopClamp] = useState<number | null>(null)
  useLayoutEffect(() => {
    const el = panelRef.current
    if (isMobile || anchor.placeAbove || skipViewportClamp || !el) {
      setTopClamp(null)
      return
    }
    const pad = 12
    const recompute = () => {
      const height = el.getBoundingClientRect().height
      const maxTop = window.innerHeight - height - pad
      setTopClamp(anchor.top > maxTop ? Math.max(pad, maxTop) : null)
    }
    recompute()
    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    window.addEventListener('resize', recompute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recompute)
    }
  }, [isMobile, anchor.top, anchor.placeAbove, skipViewportClamp])

  // Track the keyboard everywhere: a phone gets the full bottom sheet, while
  // iPad/desktop keep the caret-anchored panel but clamp it so a tall panel
  // (e.g. scripture results) can never spill behind an on-screen keyboard.
  const keyboardInset = useKeyboardInset()

  // The grab handle was decorative — the pill said "swipe me away" and nothing
  // happened. At full height the scrim above the sheet is an ~82pt strip sitting
  // under the Dynamic Island, which is not a dismiss target, so the handle has
  // to actually work.
  const { handlers: dragHandlers, dragY, dragging } = useSheetDismiss({
    onDismiss,
    enabled: isMobile,
  })

  const panelWidth = Math.min(440, anchor.width, window.innerWidth - 32)
  const style: React.CSSProperties = isMobile
    ? {
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: keyboardInset,
        // Grow toward full-screen for heavy actions (scripture results, prayer
        // text) while leaving a ~56px peek of the entry above, dimmed by the
        // scrim — so you stay anchored in "still editing my entry".
        maxHeight: `calc(100dvh - ${keyboardInset}px - 56px)`,
        zIndex: 8500,
        transform: dragY ? `translateY(${dragY}px)` : undefined,
        transition: dragging ? 'none' : undefined,
      }
    : {
        position: 'fixed',
        left: Math.min(anchor.left, window.innerWidth - panelWidth - 16),
        width: panelWidth,
        maxWidth: panelWidth,
        zIndex: 8500,
        top: topClamp ?? anchor.top,
        transform: anchor.placeAbove ? 'translateY(-100%)' : undefined,
        // Keyboard up (iPad on-screen keyboard) and anchored below: cap height
        // to the space above the keyboard. No keyboard → undefined → CSS
        // controls it, so mouse-desktop is unchanged.
        ...(keyboardInset > 0 && !anchor.placeAbove
          ? { maxHeight: `calc(100dvh - ${keyboardInset}px - ${anchor.top}px - 8px)` }
          : {}),
      }

  const sheet = (
    <div
      ref={panelRef}
      className={`command-popover command-popover--${variant}${isMobile ? ' command-popover--sheet' : ''}`}
      style={style}
      role={role}
      aria-label={ariaLabel}
      onMouseDown={(e) => e.stopPropagation()}
      {...(isMobile ? dragHandlers : {})}
    >
      {isMobile && (
        <div className="command-popover__handle">
          <div className="command-popover__grab" aria-hidden />
          {/* Named exit. The scrim and the handle both dismiss, but a sheet at
              90% height leaves neither obvious. */}
          <button
            type="button"
            className="command-popover__close"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onDismiss}
            aria-label={`Close ${ariaLabel}`}
          >
            ✕
          </button>
        </div>
      )}
      {header}
      <div className="command-popover__body" data-sheet-scroll={isMobile ? '' : undefined}>
        {children}
      </div>
      {footer != null && <footer className="command-popover__footer">{footer}</footer>}
    </div>
  )

  return createPortal(
    isMobile ? (
      <>
        {/* Dimmed peek of the entry behind the sheet — context stays visible,
            tap it to dismiss. */}
        <div className="command-popover__scrim" onClick={onDismiss} aria-hidden />
        {sheet}
      </>
    ) : (
      sheet
    ),
    document.body,
  )
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
