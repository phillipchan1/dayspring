import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Entry } from '@/lib/types'
import { useSheetDismiss } from '@/hooks/useSheetDismiss'
import { deriveTitle } from './deriveTitle'
import { canShareEntry } from './entryActions'
import { EntryMenuIcon, type EntryMenuIconName } from './entryMenuIcons'

export type EntryMenuPhase =
  | { kind: 'closed' }
  | { kind: 'menu'; entry: Entry; x: number; y: number }
  | { kind: 'confirm'; entry: Entry }

export type EntryMenuAction =
  | 'copy-text'
  | 'copy-markdown'
  | 'export-markdown'
  | 'share'
  | 'duplicate'
  | 'print'
  | 'edit-date'
  | 'delete'

interface Props {
  phase: EntryMenuPhase
  onClose: () => void
  onAction: (action: EntryMenuAction, entry: Entry) => void
  onRequestDelete: (entry: Entry) => void
  /**
   * Phone width: a bottom sheet instead of a menu at the finger.
   *
   * A desktop menu opened by a long-press landed wherever the thumb happened
   * to be — often the top third, out of reach — over the very page it was
   * about, with rows a third shorter than a finger. The sheet always comes up
   * in the thumb's half, full width, and carries fewer, larger rows.
   */
  sheet?: boolean
}

/** "Tue, Aug 26" — with the year only when it isn't this one. */
function sheetDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

function MenuItem({
  label,
  icon,
  danger,
  onClick,
}: {
  label: string
  icon: EntryMenuIconName
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`entry-context-menu__item${danger ? ' entry-context-menu__item--danger' : ''}`}
      role="menuitem"
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <EntryMenuIcon name={icon} />
      <span className="entry-context-menu__label">{label}</span>
    </button>
  )
}

function MenuSep() {
  return <div className="entry-context-menu__sep" role="separator" />
}

/** Portaled entry context menu with backdrop dismiss (desktop-grade). */
export function EntryContextMenu({ phase, onClose, onAction, onRequestDelete, sheet = false }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const deleteBtnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const open = phase.kind !== 'closed'
  const drag = useSheetDismiss({ onDismiss: onClose, enabled: sheet && phase.kind === 'menu' })

  // Dismiss on outside pointer down (deferred so the opening click doesn't close).
  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (phase.kind === 'confirm') {
        const dialog = document.querySelector('.entry-confirm')
        if (dialog?.contains(target)) return
      }
      onClose()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      if (phase.kind === 'confirm' && e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onAction('delete', phase.entry)
        onClose()
      }
    }

    const onScroll = () => onClose()

    const id = window.requestAnimationFrame(() => {
      document.addEventListener('pointerdown', onPointerDown, true)
    })
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)

    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open, phase, onClose, onAction])

  useLayoutEffect(() => {
    if (phase.kind === 'confirm') {
      deleteBtnRef.current?.focus()
      return
    }
    if (phase.kind !== 'menu' || !menuRef.current) return
    // The sheet has no position to find, and no row to pre-focus: a highlighted
    // first row under a thumb reads as a choice already made.
    if (sheet) {
      menuRef.current.focus({ preventScroll: true })
      return
    }
    const pad = 8
    const rect = menuRef.current.getBoundingClientRect()
    const x = Math.min(phase.x, window.innerWidth - rect.width - pad)
    const y = Math.min(phase.y, window.innerHeight - rect.height - pad)
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) })
    const first = menuRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]')
    first?.focus()
  }, [phase, sheet])

  if (phase.kind === 'closed') return null

  if (phase.kind === 'confirm') {
    const title = deriveTitle(phase.entry.body_markdown) || 'Untitled'
    return createPortal(
      <div
        className="entry-context-backdrop entry-context-backdrop--confirm"
        role="presentation"
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          className="entry-confirm glass-surface glass-surface--compact"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="entry-confirm-title"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="glass-surface__glow" aria-hidden />
          <h3 id="entry-confirm-title" className="entry-confirm__title">
            Delete entry?
          </h3>
          <p className="entry-confirm__body">
            <span className="entry-confirm__name">“{title}”</span> will be removed from your journal.
            This can’t be undone.
          </p>
          <div className="entry-confirm__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              ref={deleteBtnRef}
              type="button"
              className="btn btn--danger"
              onClick={() => {
                onAction('delete', phase.entry)
                onClose()
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )
  }

  const entry = phase.entry
  const headTitle = deriveTitle(entry.body_markdown) || 'Untitled'
  const act = (action: EntryMenuAction) => {
    onAction(action, entry)
    onClose()
  }

  if (sheet) {
    const date = sheetDate(entry.created_at)
    return createPortal(
      <>
        <div
          className="entry-context-backdrop entry-context-backdrop--sheet"
          role="presentation"
          aria-hidden
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        />
        <div
          ref={menuRef}
          className="entry-context-menu entry-context-menu--sheet"
          role="menu"
          tabIndex={-1}
          aria-label={`Actions for ${headTitle}`}
          data-dragging={drag.dragging ? 'true' : undefined}
          style={drag.dragY ? { translate: `0 ${drag.dragY}px` } : undefined}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          {...drag.handlers}
        >
          <span className="entry-context-menu__grab" aria-hidden />
          <div className="entry-context-menu__head">
            {date ? <span className="entry-context-menu__head-date">{date}</span> : null}
            <span className="entry-context-menu__head-title">{headTitle}</span>
          </div>
          <MenuItem label="Copy text" icon="copy-text" onClick={() => act('copy-text')} />
          {canShareEntry() ? (
            <MenuItem label="Share…" icon="share" onClick={() => act('share')} />
          ) : (
            <MenuItem label="Export Markdown…" icon="export" onClick={() => act('export-markdown')} />
          )}
          <MenuItem label="Change date…" icon="edit-date" onClick={() => act('edit-date')} />
          <MenuItem label="Duplicate" icon="duplicate" onClick={() => act('duplicate')} />
          <MenuSep />
          <MenuItem label="Delete entry…" icon="delete" danger onClick={() => onRequestDelete(entry)} />
        </div>
      </>,
      document.body,
    )
  }

  return createPortal(
    <>
      <div
        className="entry-context-backdrop"
        role="presentation"
        aria-hidden
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      />
      <div
        ref={menuRef}
        className="entry-context-menu"
        role="menu"
        aria-label={`Actions for ${headTitle}`}
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="entry-context-menu__head">
          <span className="entry-context-menu__head-title">{headTitle}</span>
        </div>
        <MenuItem label="Copy text" icon="copy-text" onClick={() => act('copy-text')} />
        <MenuItem label="Copy Markdown" icon="copy-markdown" onClick={() => act('copy-markdown')} />
        <MenuSep />
        <MenuItem label="Export Markdown…" icon="export" onClick={() => act('export-markdown')} />
        <MenuSep />
        <MenuItem label="Change date…" icon="edit-date" onClick={() => act('edit-date')} />
        <MenuSep />
        <MenuItem label="Duplicate" icon="duplicate" onClick={() => act('duplicate')} />
        <MenuItem label="Print…" icon="print" onClick={() => act('print')} />
        <MenuSep />
        <MenuItem label="Delete entry…" icon="delete" danger onClick={() => onRequestDelete(entry)} />
      </div>
    </>,
    document.body,
  )
}
