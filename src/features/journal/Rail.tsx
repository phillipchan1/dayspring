import type { ReactNode } from 'react'
import { Mark } from '@/components/Mark'

interface RailProps {
  onNew: () => void
  onToggleEntries: () => void
  entriesOpen: boolean
  lookBackActive: boolean
  onLookBack: () => void
  altarActive: boolean
  onAltar: () => void
  onOpenSettings: () => void
  /** macOS traffic-light top clearance under Tauri's overlay title bar. */
  nativeTopInset?: string | undefined
}

/**
 * Slim glass spine — icon-only destinations (labels in tooltips + screen readers).
 * Wordmark lives in the entries panel; the mark anchors the rail.
 */
export function Rail({
  onNew,
  onToggleEntries,
  entriesOpen,
  lookBackActive,
  onLookBack,
  altarActive,
  onAltar,
  onOpenSettings,
  nativeTopInset,
}: RailProps) {
  return (
    <nav className="rail" style={nativeTopInset ? { paddingTop: nativeTopInset } : undefined}>
      <div className="rail__glow" aria-hidden />
      <div className="rail__brand">
        <Mark size={24} />
      </div>
      <div className="rail__nav">
        <div className="rail__actions">
          <RailButton
            label="New entry"
            shortcut="⌘N"
            onClick={onNew}
            icon={<IconNew />}
          />
        </div>
        <div className="rail__destinations" aria-label="Destinations">
          <RailButton
            label="Entries"
            shortcut="⌘1"
            onClick={onToggleEntries}
            active={entriesOpen && !lookBackActive && !altarActive}
            icon={<IconEntries />}
          />
          <RailButton
            label="Looking back"
            shortcut="⌘2"
            onClick={onLookBack}
            active={lookBackActive}
            icon={<IconLookBack />}
          />
          <RailButton
            label="Altar"
            shortcut="⌘3"
            onClick={onAltar}
            active={altarActive}
            icon={<IconAltar />}
          />
        </div>
      </div>
      <div className="rail__footer">
        <RailButton
          label="Settings"
          shortcut="⌘,"
          onClick={onOpenSettings}
          icon={<IconSettings />}
        />
      </div>
    </nav>
  )
}

interface RailButtonProps {
  label: string
  shortcut: string
  onClick: () => void
  icon: ReactNode
  active?: boolean
}

function RailButton({ label, shortcut, onClick, icon, active = false }: RailButtonProps) {
  return (
    <button
      type="button"
      className="rail-btn"
      data-active={active ? 'true' : undefined}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={`${label} (${shortcut})`}
      onClick={onClick}
    >
      <span className="rail-btn__well">{icon}</span>
    </button>
  )
}

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function IconNew() {
  return (
    <NavIcon>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </NavIcon>
  )
}

function IconEntries() {
  return (
    <NavIcon>
      <path d="M5 6h14" />
      <path d="M5 12h14" />
      <path d="M5 18h14" />
    </NavIcon>
  )
}

function IconLookBack() {
  return (
    <NavIcon>
      <path d="M4 12a8 8 0 1 0 3-6.2" />
      <path d="M4 4v4h4" />
    </NavIcon>
  )
}

function IconAltar() {
  return (
    <NavIcon>
      <path d="M12 3v4" />
      <path d="M8 7h8" />
      <path d="M6 21h12" />
      <path d="M9 11h6v10H9z" />
      <path d="M10 11V9a2 2 0 0 1 4 0v2" />
    </NavIcon>
  )
}

function IconSettings() {
  return (
    <NavIcon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </NavIcon>
  )
}
