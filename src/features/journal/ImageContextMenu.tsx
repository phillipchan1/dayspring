import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AttachmentEditTarget } from '@/editor/attachmentInsert'
import type { ImageMenuPoint } from '@/editor/attachmentImageExtension'
import { useSheetDismiss } from '@/hooks/useSheetDismiss'
import type { ImageSize } from '@/lib/attachments'
import { swallowClickThrough } from '@/lib/ghostClick'

const SIZE_OPTIONS: ReadonlyArray<{ value: ImageSize; label: string }> = [
  { value: 's', label: 'Small' },
  { value: 'm', label: 'Medium' },
  { value: 'f', label: 'Full' },
]

export type ImageMenuPhase =
  | { kind: 'closed' }
  | { kind: 'menu'; target: AttachmentEditTarget; point: ImageMenuPoint }

interface Props {
  phase: ImageMenuPhase
  onClose: () => void
  /** Open the photo, and the set it is in, in the viewer. */
  onLook: (target: AttachmentEditTarget) => void
  onEditCaption: (target: AttachmentEditTarget) => void
  onReplaceFile: (target: AttachmentEditTarget, file: File) => void
  onSetSize: (target: AttachmentEditTarget, size: ImageSize) => void
  onArrange: (target: AttachmentEditTarget, how: PhotoArrangement) => void
  onRemove: (target: AttachmentEditTarget) => void
  /**
   * Phone width: a bottom sheet instead of a menu at the finger, for the same
   * reasons the page menu is one (EntryContextMenu). It is also where a photo
   * is reordered on a phone, since there is no dragging one there.
   */
  sheet?: boolean
}

/** The ways a photo moves among the photos beside it (lib/photoSet.ts). */
export type PhotoArrangement = 'join' | 'takeOut' | 'makeFirst' | 'earlier' | 'later'

type ImageMenuIconName =
  | 'look'
  | 'caption'
  | 'replace'
  | 'delete'
  | 'join'
  | 'takeOut'
  | 'first'
  | 'earlier'
  | 'later'

function MenuIcon({ name }: { name: ImageMenuIconName }) {
  return (
    <svg
      className="entry-context-menu__icon"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'caption' && (
        <>
          <path d="M4 6h16" />
          <path d="M4 11h16" />
          <path d="M4 16h10" />
        </>
      )}
      {name === 'replace' && (
        <>
          <path d="M4 9a8 8 0 0 1 13.5-3.5L20 8" />
          <path d="M20 4v4h-4" />
          <path d="M20 15a8 8 0 0 1-13.5 3.5L4 16" />
          <path d="M4 20v-4h4" />
        </>
      )}
      {name === 'look' && (
        <>
          <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
          <circle cx="12" cy="12" r="2.6" />
        </>
      )}
      {name === 'earlier' && (
        <>
          <path d="M19 12H6" />
          <path d="M11 7l-5 5 5 5" />
        </>
      )}
      {name === 'later' && (
        <>
          <path d="M5 12h13" />
          <path d="M13 7l5 5-5 5" />
        </>
      )}
      {name === 'join' && (
        <>
          <rect x="4" y="5" width="7" height="6" rx="1" />
          <rect x="13" y="5" width="7" height="6" rx="1" />
          <path d="M12 20v-6" />
          <path d="M9 16l3-3 3 3" />
        </>
      )}
      {name === 'takeOut' && (
        <>
          <rect x="4" y="4" width="7" height="6" rx="1" />
          <rect x="13" y="4" width="7" height="6" rx="1" />
          <path d="M12 13v6" />
          <path d="M9 17l3 3 3-3" />
        </>
      )}
      {name === 'first' && (
        <>
          <path d="M5 5v14" />
          <path d="M19 12H9" />
          <path d="M12 8l-4 4 4 4" />
        </>
      )}
      {name === 'delete' && (
        <>
          <path d="M4 7h16" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
          <path d="M7 7l1-3h8l1 3" />
          <path d="M9 7v13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V7" />
        </>
      )}
    </svg>
  )
}

function MenuItem({
  label,
  icon,
  danger,
  onClick,
}: {
  label: string
  icon: ImageMenuIconName
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
      <MenuIcon name={icon} />
      <span className="entry-context-menu__label">{label}</span>
    </button>
  )
}

/**
 * Photo options menu — left- or right-click on a photo opens it. Mirrors
 * EntryContextMenu (portal, backdrop dismiss, viewport clamp) so a photo of any
 * size can never push the controls off-screen.
 */
export function ImageContextMenu({
  phase,
  onClose,
  onLook,
  onEditCaption,
  onReplaceFile,
  onSetSize,
  onArrange,
  onRemove,
  sheet = false,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const open = phase.kind !== 'closed'
  const drag = useSheetDismiss({ onDismiss: onClose, enabled: sheet && open })

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
      swallowClickThrough()
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
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
  }, [open, onClose])

  useLayoutEffect(() => {
    if (phase.kind !== 'menu' || !menuRef.current) return
    // The sheet has no position to find, and no row to pre-focus.
    if (sheet) {
      menuRef.current.focus()
      return
    }
    const pad = 8
    const rect = menuRef.current.getBoundingClientRect()
    const x = Math.min(phase.point.x, window.innerWidth - rect.width - pad)
    const y = Math.min(phase.point.y, window.innerHeight - rect.height - pad)
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) })
    menuRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [phase, sheet])

  if (phase.kind !== 'menu') return null

  const target = phase.target
  const arrange = (how: PhotoArrangement) => () => {
    onArrange(target, how)
    onClose()
  }

  return createPortal(
    <>
      <div
        className={`entry-context-backdrop${sheet ? ' entry-context-backdrop--sheet' : ''}`}
        role="presentation"
        aria-hidden
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      />
      <div
        ref={menuRef}
        className={`entry-context-menu image-context-menu${sheet ? ' entry-context-menu--sheet' : ''}`}
        role="menu"
        tabIndex={sheet ? -1 : undefined}
        aria-label="Photo options"
        data-dragging={sheet && drag.dragging ? 'true' : undefined}
        style={
          sheet
            ? drag.dragY
              ? { translate: `0 ${drag.dragY}px` }
              : undefined
            : { left: pos.x, top: pos.y }
        }
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        {...(sheet ? drag.handlers : {})}
      >
        {sheet && <span className="entry-context-menu__grab" aria-hidden />}
        <MenuItem
          label={target.set ? 'Look at these' : 'Look'}
          icon="look"
          onClick={() => {
            onLook(target)
            onClose()
          }}
        />
        <div className="entry-context-menu__sep" role="separator" />
        {/* Size is a lone photo's setting. In a set the rows decide. */}
        {!target.set && (
          <>
            <div className="image-context-menu__size" role="group" aria-label="Photo size">
              <span className="image-context-menu__size-label">Size</span>
              <div className="image-context-menu__size-options">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="image-context-menu__size-btn"
                    aria-pressed={target.size === opt.value}
                    data-active={target.size === opt.value}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSetSize(target, opt.value)
                      onClose()
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="entry-context-menu__sep" role="separator" />
          </>
        )}
        <MenuItem
          label="Edit caption…"
          icon="caption"
          onClick={() => {
            onEditCaption(target)
            onClose()
          }}
        />
        <MenuItem
          label="Replace photo…"
          icon="replace"
          onClick={() => fileRef.current?.click()}
        />
        {(target.set || target.joinsAbove) && (
          <div className="entry-context-menu__sep" role="separator" />
        )}
        {target.joinsAbove && (
          <MenuItem label="Put with the photos above" icon="join" onClick={arrange('join')} />
        )}
        {target.set && target.set.index > 0 && (
          <MenuItem label="Make this the first photo" icon="first" onClick={arrange('makeFirst')} />
        )}
        {target.set && target.set.index > 0 && (
          <MenuItem label="Move earlier" icon="earlier" onClick={arrange('earlier')} />
        )}
        {target.set && target.set.index < target.set.count - 1 && (
          <MenuItem label="Move later" icon="later" onClick={arrange('later')} />
        )}
        {target.set && (
          <MenuItem label="Take out of the set" icon="takeOut" onClick={arrange('takeOut')} />
        )}
        <div className="entry-context-menu__sep" role="separator" />
        <MenuItem
          label="Remove photo"
          icon="delete"
          danger
          onClick={() => {
            onRemove(target)
            onClose()
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="command-popover__file-input"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              onReplaceFile(target, file)
              onClose()
            }
          }}
        />
      </div>
    </>,
    document.body,
  )
}
