import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AttachmentEditTarget } from '@/editor/attachmentInsert'
import type { ImageMenuPoint } from '@/editor/attachmentImageExtension'

export type ImageMenuPhase =
  | { kind: 'closed' }
  | { kind: 'menu'; target: AttachmentEditTarget; point: ImageMenuPoint }

interface Props {
  phase: ImageMenuPhase
  onClose: () => void
  onEditCaption: (target: AttachmentEditTarget) => void
  onReplaceFile: (target: AttachmentEditTarget, file: File) => void
  onRemove: (target: AttachmentEditTarget) => void
}

type ImageMenuIconName = 'caption' | 'replace' | 'delete'

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
export function ImageContextMenu({ phase, onClose, onEditCaption, onReplaceFile, onRemove }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })

  const open = phase.kind !== 'closed'

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return
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
    const pad = 8
    const rect = menuRef.current.getBoundingClientRect()
    const x = Math.min(phase.point.x, window.innerWidth - rect.width - pad)
    const y = Math.min(phase.point.y, window.innerHeight - rect.height - pad)
    setPos({ x: Math.max(pad, x), y: Math.max(pad, y) })
    menuRef.current.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [phase])

  if (phase.kind !== 'menu') return null

  const target = phase.target

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
        className="entry-context-menu image-context-menu"
        role="menu"
        aria-label="Photo options"
        style={{ left: pos.x, top: pos.y }}
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
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
