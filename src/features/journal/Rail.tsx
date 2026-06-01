import type { ReactNode } from 'react'
import { Mark } from '@/components/Mark'

interface RailProps {
  onToggleEntries: () => void
  entriesOpen: boolean
  onLookBack: () => void
  onOpenSettings: () => void
  /** macOS traffic-light top clearance under Tauri's overlay title bar. */
  nativeTopInset?: string | undefined
}

/**
 * The desktop navigation spine: a slim, full-height rail. The sunrise Mark up
 * top, the destinations in the middle, Settings pinned to the foot (Sign out
 * lives inside Settings → About). Quiet at rest; the active destination
 * (Entries, when its panel is open) warms to the accent. Desktop-only.
 */
export function Rail({
  onToggleEntries,
  entriesOpen,
  onLookBack,
  onOpenSettings,
  nativeTopInset,
}: RailProps) {
  return (
    <nav className="rail" style={nativeTopInset ? { paddingTop: nativeTopInset } : undefined}>
      <div className="rail__brand">
        <Mark size={24} />
      </div>
      <div className="rail__nav">
        <RailButton
          label="Entries"
          title="Entries (⌘1)"
          onClick={onToggleEntries}
          active={entriesOpen}
          icon={<EntriesIcon />}
        />
        <RailButton label="Looking back" title="Looking back (⌘2)" onClick={onLookBack} icon={<LookBackIcon />} />
      </div>
      <div className="rail__footer">
        <RailButton label="Settings" title="Settings (⌘3)" onClick={onOpenSettings} icon={<SettingsIcon />} />
      </div>
    </nav>
  )
}

interface RailButtonProps {
  label: string
  title: string
  onClick: () => void
  icon: ReactNode
  active?: boolean
}

function RailButton({ label, title, onClick, icon, active = false }: RailButtonProps) {
  return (
    <button className="rail-btn" data-active={active ? 'true' : undefined} title={title} onClick={onClick}>
      <span className="rail-btn__icon" aria-hidden>{icon}</span>
      <span className="rail-btn__label">{label}</span>
    </button>
  )
}

/* ── Icons — line art in the Mark.tsx idiom (stroke = currentColor) ───────── */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

function EntriesIcon() {
  return (
    <Icon>
      <path d="M5 6h14" />
      <path d="M5 12h14" />
      <path d="M5 18h14" />
    </Icon>
  )
}

function LookBackIcon() {
  return (
    <Icon>
      <path d="M4 12a8 8 0 1 0 3-6.2" />
      <path d="M4 4v4h4" />
    </Icon>
  )
}

function SettingsIcon() {
  return (
    <Icon>
      <path d="M4 8h16" />
      <path d="M4 16h16" />
      <circle cx="9" cy="8" r="2.2" />
      <circle cx="15" cy="16" r="2.2" />
    </Icon>
  )
}
