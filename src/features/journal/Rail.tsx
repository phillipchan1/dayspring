import type { ReactNode } from 'react'
import { Mark } from '@/components/Mark'

interface RailProps {
  onToggleEntries: () => void
  entriesOpen: boolean
  lookBackActive: boolean
  onLookBack: () => void
  onOpenSettings: () => void
  /** macOS traffic-light top clearance under Tauri's overlay title bar. */
  nativeTopInset?: string | undefined
}

/**
 * Slim glass spine — icon-only destinations (labels in tooltips + screen readers).
 * Wordmark lives in the entries panel; the mark anchors the rail.
 */
export function Rail({
  onToggleEntries,
  entriesOpen,
  lookBackActive,
  onLookBack,
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
        <RailButton
          label="Entries"
          shortcut="⌘1"
          onClick={onToggleEntries}
          active={entriesOpen && !lookBackActive}
          icon={<IconEntries />}
        />
        <RailButton
          label="Looking back"
          shortcut="⌘2"
          onClick={onLookBack}
          active={lookBackActive}
          icon={<IconLookBack />}
        />
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

function IconSettings() {
  return (
    <NavIcon>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </NavIcon>
  )
}
