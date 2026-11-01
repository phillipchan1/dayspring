import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { swallowClickThrough } from '@/lib/ghostClick'
import type { Entry } from '@/lib/types'
import { useSheetDismiss } from '@/hooks/useSheetDismiss'
import { isContextPress, useMenuExit, useMenuKeyboard } from '@/hooks/useMenuKeyboard'
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

/**
 * The delete confirm's keys, shared by the single and bulk menus.
 *
 * Return is the DEFAULT button, and for a destructive alert the default is
 * Cancel: Return must never be the key that throws a page away. ⌘⌫ is the
 * deliberate chord that confirms, as it is for Finder's Move to Trash. Esc
 * cancels. Space still presses whichever button has focus, as on the Mac.
 */
export function confirmKeyAction(
  e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey'>,
): 'cancel' | 'confirm' | null {
  if (e.key === 'Escape' || e.key === 'Enter') return 'cancel'
  if ((e.key === 'Backspace' || e.key === 'Delete') && (e.metaKey || e.ctrlKey)) return 'confirm'
  return null
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
  const backdropRef = useRef<HTMLDivElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const open = phase.kind !== 'closed'
  const menuOpen = phase.kind === 'menu'
  const drag = useSheetDismiss({ onDismiss: onClose, enabled: sheet && menuOpen })

  // The desktop menu appears at once and stays on screen to fade out (N3).
  // The phone sheet's exit belongs to the sheets' own motion, not to this.
  const { shown: shownMenu, leaving } = useMenuExit(menuOpen && !sheet ? phase : null)
  const keys = useMenuKeyboard({
    open: menuOpen,
    menuRef,
    onClose,
    initial: sheet ? 'none' : 'auto',
    restoreFocus: !sheet,
    openKey: phase,
  })

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
      // A right-click outside the menu is a right-click on whatever is there:
      // let it through the backdrop, so that thing opens its own menu.
      if (phase.kind === 'menu' && isContextPress(e) && backdropRef.current) {
        backdropRef.current.style.pointerEvents = 'none'
      }
      swallowClickThrough()
      onClose()
    }

    // The menu's own keys are useMenuKeyboard's; the confirm has its own.
    const onKey = (e: KeyboardEvent) => {
      if (phase.kind !== 'confirm') return
      const act = confirmKeyAction(e)
      if (!act) return
      e.preventDefault()
      e.stopPropagation()
      if (act === 'confirm') onAction('delete', phase.entry)
      onClose()
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
    // Each opening gets a backdrop that catches presses again.
    if (backdropRef.current) backdropRef.current.style.pointerEvents = ''
    if (phase.kind === 'confirm') {
      cancelBtnRef.current?.focus()
      return
    }
    if (phase.kind !== 'menu' || !menuRef.current) return
    // The sheet has no position to find.
    if (sheet) return
    const pad = 8
    const rect = menuRef.current.getBoundingClientRect()
    const x = Math.min(phase.x, window.innerWidth - rect.width - pad)
    const y = Math.min(phase.y, window.innerHeight - rect.height - pad)
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) })
  }, [phase, sheet])

  function renderDesktopMenu(entry: Entry) {
    const headTitle = deriveTitle(entry.body_markdown) || 'Untitled'
    const act = (action: EntryMenuAction) => {
      onAction(action, entry)
      onClose()
    }
    return createPortal(
      <>
        {leaving ? null : (
          <div
            ref={backdropRef}
            className="entry-context-backdrop"
            role="presentation"
            aria-hidden
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) onClose()
            }}
          />
        )}
        <div
          ref={menuRef}
          className="entry-context-menu"
          role="menu"
          tabIndex={-1}
          aria-label={`Actions for ${headTitle}`}
          data-leaving={leaving ? 'true' : undefined}
          style={{ left: pos.x, top: pos.y }}
          onPointerDown={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
          {...keys.menuProps}
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

  // Closed, perhaps with the last menu still fading.
  if (phase.kind === 'closed') return shownMenu ? renderDesktopMenu(shownMenu.entry) : null

  if (phase.kind === 'confirm') {
    const title = deriveTitle(phase.entry.body_markdown) || 'Untitled'
    return (
      <>
        {shownMenu ? renderDesktopMenu(shownMenu.entry) : null}
        {createPortal(
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
                <button
                  ref={cancelBtnRef}
                  type="button"
                  className="btn btn--ghost"
                  data-default="true"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  aria-keyshortcuts="Meta+Backspace"
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
        )}
      </>
    )
  }

  const entry = phase.entry
  if (!sheet) return renderDesktopMenu(entry)

  const headTitle = deriveTitle(entry.body_markdown) || 'Untitled'
  const act = (action: EntryMenuAction) => {
    onAction(action, entry)
    onClose()
  }
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
