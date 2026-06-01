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
  labelsExpanded: boolean
  onToggleLabels: () => void
  /** macOS traffic-light top clearance under Tauri's overlay title bar. */
  nativeTopInset?: string | undefined
}

/**
 * Slim glass spine — icon destinations with optional labels. Toggle at the
 * foot of the rail; preference persists in settings.
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
  labelsExpanded,
  onToggleLabels,
  nativeTopInset,
}: RailProps) {
  const showBrandLockup = labelsExpanded && !entriesOpen
  const showBrand = !labelsExpanded || showBrandLockup

  return (
    <nav
      className="rail"
      data-labels={labelsExpanded ? 'true' : 'false'}
      style={nativeTopInset ? { paddingTop: nativeTopInset } : undefined}
    >
      <div className="rail__glow" aria-hidden />
      {showBrand ? (
        <div
          className={`rail__brand rail-btn rail-btn--brand${showBrandLockup ? ' rail__brand--lockup' : ''}`}
          aria-hidden={!labelsExpanded}
        >
          <span className="rail-btn__well">
            <Mark size={20} className="rail__mark" />
          </span>
          {showBrandLockup ? <span className="rail-btn__label">Dayspring</span> : null}
        </div>
      ) : null}
      <div className="rail__nav">
        <div className="rail__actions">
          <RailButton
            label="New entry"
            shortcut="⌘N"
            onClick={onNew}
            icon={<IconNew />}
            labelsExpanded={labelsExpanded}
          />
        </div>
        <div className="rail__rule" aria-hidden />
        <div className="rail__destinations" aria-label="Destinations">
          <RailButton
            label="Entries"
            shortcut="⌘1"
            onClick={onToggleEntries}
            active={entriesOpen && !lookBackActive && !altarActive}
            icon={<IconEntries />}
            labelsExpanded={labelsExpanded}
          />
          <RailButton
            label="Looking back"
            shortcut="⌘2"
            onClick={onLookBack}
            active={lookBackActive}
            icon={<IconLookBack />}
            labelsExpanded={labelsExpanded}
          />
          <RailButton
            label="Altar"
            shortcut="⌘3"
            onClick={onAltar}
            active={altarActive}
            icon={<IconAltar />}
            labelsExpanded={labelsExpanded}
          />
        </div>
      </div>
      <div className="rail__footer">
        <RailButton
          label="Settings"
          shortcut="⌘,"
          onClick={onOpenSettings}
          icon={<IconSettings />}
          labelsExpanded={labelsExpanded}
        />
        <button
          type="button"
          className="rail-toggle"
          onClick={onToggleLabels}
          aria-pressed={labelsExpanded}
          aria-label={labelsExpanded ? 'Icons only' : 'Show navigation labels'}
          title={labelsExpanded ? 'Icons only' : 'Show names'}
        >
          <span className="rail__icon-slot rail-toggle__well" aria-hidden>
            <IconRailExpand expanded={labelsExpanded} />
          </span>
          {labelsExpanded ? (
            <span className="rail-toggle__label">
              {labelsExpanded ? 'Icons only' : 'Show names'}
            </span>
          ) : null}
        </button>
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
  labelsExpanded: boolean
}

function RailButton({
  label,
  shortcut,
  onClick,
  icon,
  active = false,
  labelsExpanded,
}: RailButtonProps) {
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
      {labelsExpanded ? <span className="rail-btn__label">{label}</span> : null}
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

function IconRailExpand({ expanded }: { expanded: boolean }) {
  return (
    <NavIcon>
      <path
        d={expanded ? 'M14 6l-6 6 6 6' : 'M10 6l6 6-6 6'}
        strokeWidth="1.65"
      />
    </NavIcon>
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
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
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
