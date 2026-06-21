import type { ReactNode } from 'react'
import { Mark } from '@/components/Mark'
import { formatNewEntryShortcut } from '@/features/shortcuts/shortcuts'
import { isTauri } from '@/lib/platform'
import { RailHint } from './RailHint'
import { RAIL_EXPAND_KEY } from './railHints'
import { useSurfaceEmbers } from './surfaceEmbers'
import {
  IconAltar,
  IconAscent,
  IconEntries,
  IconMenu,
  IconNew,
  IconScripture,
  IconSettings,
} from './navIcons'

const NATIVE = isTauri()

interface RailProps {
  onNew: () => void
  onToggleEntries: () => void
  entriesOpen: boolean
  lookBackActive: boolean
  onLookBack: () => void
  altarActive: boolean
  onAltar: () => void
  /** Altar is feature-flagged off until ready — hide its rail destination when false. */
  altarEnabled: boolean
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
  altarEnabled,
  scriptureActive,
  onScripture,
  onOpenSettings,
  labelsExpanded,
  onToggleLabels,
  nativeTopInset,
}: RailProps) {
  // Wordmark beside the mark when labels are expanded; icon-only when collapsed.
  const showBrandLockup = labelsExpanded

  // One-time discovery embers on the Return destinations (see surfaceEmbers.ts).
  const embers = useSurfaceEmbers()

  const drag = NATIVE ? true : undefined

  return (
    <nav
      className="rail"
      data-labels={labelsExpanded ? 'true' : 'false'}
      style={nativeTopInset ? { paddingTop: nativeTopInset } : undefined}
      data-tauri-drag-region={drag}
    >
      <div className="rail__glow" aria-hidden data-tauri-drag-region={drag} />
      <div
        className={`rail__brand rail-btn rail-btn--brand${showBrandLockup ? ' rail__brand--lockup' : ''}`}
        aria-hidden={!labelsExpanded}
        data-tauri-drag-region={drag}
      >
        <span className="rail-btn__well" data-tauri-drag-region={drag}>
          <Mark size={20} className="rail__mark" />
        </span>
        {showBrandLockup ? <span className="rail-btn__label" data-tauri-drag-region={drag}>Dayspring</span> : null}
      </div>
      <div className="rail__nav" data-tauri-drag-region={drag}>
        <div className="rail__group" aria-label="Write" data-tauri-drag-region={drag}>
          <span className="rail__group-label" aria-hidden data-tauri-drag-region={drag}>
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
        <div className="rail__group" aria-label="Return" data-tauri-drag-region={drag}>
          <span className="rail__group-label" aria-hidden data-tauri-drag-region={drag}>
            Return
          </span>
          <RailButton
            label="Ascent"
            subline="The climb through your seasons"
            shortcut="⌘2"
            onClick={onLookBack}
            active={lookBackActive}
            ember={embers.reflections}
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
            ember={embers.scripture}
            icon={<IconScripture />}
            labelsExpanded={labelsExpanded}
          />
          {altarEnabled && (
            <RailButton
              label="Altar"
              subline="The prayers you return to"
              shortcut="⌘4"
              onClick={onAltar}
              active={altarActive}
              ember={embers.altar}
              icon={<IconAltar />}
              labelsExpanded={labelsExpanded}
            />
          )}
        </div>
      </div>
      <div className="rail__footer" data-tauri-drag-region={drag}>
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
  /** One-time discovery ember — the surface holds something not yet seen. */
  ember?: boolean | undefined
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
  ember = false,
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
      <span className="rail-btn__well">
        {icon}
        {ember && !active ? <span className="rail-btn__ember" aria-hidden /> : null}
      </span>
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

