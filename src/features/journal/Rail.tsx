import type { ReactNode } from 'react'
import { Mark } from '@/components/Mark'
import { formatNewEntryShortcut } from '@/features/shortcuts/shortcuts'
import { RailHint } from './RailHint'
import { RAIL_EXPAND_KEY } from './railHints'

interface RailProps {
  onNew: () => void
  onToggleEntries: () => void
  entriesOpen: boolean
  lookBackActive: boolean
  onLookBack: () => void
  altarActive: boolean
  onAltar: () => void
  scriptureActive: boolean
  onScripture: () => void
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
  scriptureActive,
  onScripture,
  onOpenSettings,
  labelsExpanded,
  onToggleLabels,
  nativeTopInset,
}: RailProps) {
  // Wordmark beside the mark when labels are expanded; icon-only when collapsed.
  const showBrandLockup = labelsExpanded

  return (
    <nav
      className="rail"
      data-labels={labelsExpanded ? 'true' : 'false'}
      style={nativeTopInset ? { paddingTop: nativeTopInset } : undefined}
    >
      <div className="rail__glow" aria-hidden />
      <div
        className={`rail__brand rail-btn rail-btn--brand${showBrandLockup ? ' rail__brand--lockup' : ''}`}
        aria-hidden={!labelsExpanded}
      >
        <span className="rail-btn__well">
          <Mark size={20} className="rail__mark" />
        </span>
        {showBrandLockup ? <span className="rail-btn__label">Dayspring</span> : null}
      </div>
      <div className="rail__nav">
        <div className="rail__group" aria-label="Write">
          <span className="rail__group-label" aria-hidden>
            Write
          </span>
          <RailButton
            label="New entry"
            shortcut={formatNewEntryShortcut()}
            onClick={onNew}
            icon={<IconNew />}
            labelsExpanded={labelsExpanded}
          />
          <RailButton
            label="Entries"
            shortcut="⌘1"
            onClick={onToggleEntries}
            active={entriesOpen && !lookBackActive && !altarActive && !scriptureActive}
            icon={<IconEntries />}
            labelsExpanded={labelsExpanded}
          />
        </div>
        <div className="rail__group" aria-label="Return">
          <span className="rail__group-label" aria-hidden>
            Return
          </span>
          <RailButton
            label="Ascent"
            subline="The climb through your seasons"
            shortcut="⌘2"
            onClick={onLookBack}
            active={lookBackActive}
            icon={<IconAscent />}
            labelsExpanded={labelsExpanded}
          />
          <RailButton
            label="Lamp"
            subline="The verses you return to"
            shortcut="⌘3"
            onClick={onScripture}
            active={scriptureActive}
            lamp
            icon={<IconScripture />}
            labelsExpanded={labelsExpanded}
          />
          <RailButton
            label="Altar"
            subline="The prayers you return to"
            shortcut="⌘4"
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
        <RailToggle
          labelsExpanded={labelsExpanded}
          onToggle={onToggleLabels}
        />
      </div>
    </nav>
  )
}

interface RailButtonProps {
  label: string
  subline?: string | undefined
  shortcut: string
  onClick: () => void
  icon: ReactNode
  active?: boolean
  /** Gold ember glow when active (Lamp). */
  lamp?: boolean | undefined
  labelsExpanded: boolean
}

function RailButton({
  label,
  subline,
  shortcut,
  onClick,
  icon,
  active = false,
  lamp = false,
  labelsExpanded,
}: RailButtonProps) {
  const button = (
    <button
      type="button"
      className="rail-btn"
      data-active={active ? 'true' : undefined}
      data-lamp={lamp && active ? 'true' : undefined}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <span className="rail-btn__well">{icon}</span>
      {labelsExpanded ? <span className="rail-btn__label">{label}</span> : null}
    </button>
  )

  if (labelsExpanded) return button

  return (
    <RailHint label={label} subline={subline} shortcut={shortcut} active>
      {button}
    </RailHint>
  )
}

function RailToggle({
  labelsExpanded,
  onToggle,
}: {
  labelsExpanded: boolean
  onToggle: () => void
}) {
  const hint = labelsExpanded ? 'Collapse sidebar' : 'Expand sidebar'

  const button = (
    <button
      type="button"
      className="rail-btn"
      onClick={onToggle}
      aria-pressed={labelsExpanded}
      aria-label={hint}
    >
      <span className="rail-btn__well">
        <IconMenu />
      </span>
      {labelsExpanded ? <span className="rail-btn__label">Collapse</span> : null}
    </button>
  )

  if (labelsExpanded) return button

  return (
    <RailHint label={hint} shortcut={RAIL_EXPAND_KEY} active>
      {button}
    </RailHint>
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

function IconMenu() {
  return (
    <NavIcon>
      <path d="M5 7h14" />
      <path d="M5 12h14" />
      <path d="M5 17h14" />
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
  // A bulleted list — distinct from the menu hamburger (the rail toggle).
  return (
    <NavIcon>
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M4.5 6h.01" />
      <path d="M4.5 12h.01" />
      <path d="M4.5 18h.01" />
    </NavIcon>
  )
}

function IconAscent() {
  // A mountain range — the climb from valley to summit.
  return (
    <NavIcon>
      <path d="M3 19h18" />
      <path d="M6 19l4-8.5 3 4.5 2.5-3.5L19 19" />
    </NavIcon>
  )
}

function IconScripture() {
  // Open book — two pages spread from a center spine.
  return (
    <NavIcon>
      <path d="M12 7v13" />
      <path d="M3 18a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h4a4 4 0 0 1 5 3 4 4 0 0 1 5-3h4a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-5a3 3 0 0 0-4 1 3 3 0 0 0-4-1z" />
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
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </NavIcon>
  )
}
