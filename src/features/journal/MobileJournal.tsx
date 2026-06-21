import { useRef } from 'react'
import { signOut } from '@/lib/auth'
import { Brand } from '@/components/Mark'
import { useViewportHeight } from '@/hooks/useViewportHeight'
import { useKeyboardOpen } from '@/hooks/useKeyboard'
import { EntryList } from './EntryList'
import { SaveStatusBadge } from './SaveStatusBadge'
import { SyncBadge } from './SyncBadge'
import { WritingControls } from './WritingControls'
import { ENTRY_RETURN_LABEL } from '@/lib/appHistory'
import { formatNewEntryShortcut } from '@/features/shortcuts/shortcuts'
import { useSurfaceEmbers } from './surfaceEmbers'
import { deriveTitle } from './deriveTitle'
import {
  IconAltar,
  IconAscent,
  IconEntries,
  IconNew,
  IconScripture,
  IconSettings,
} from './navIcons'
import type { ReactNode } from 'react'
import type { JournalViewProps } from './journalViewProps'

const SWIPE_THRESHOLD = 60
const EDGE_ZONE = 28

/**
 * Mobile: a single, full-width column. No persistent sidebar — the entry list
 * is a swipe/tap drawer. Controls live in a thumb-reachable bottom bar that
 * respects the home-indicator inset, and the shell tracks the visual viewport
 * so the keyboard never covers the bar.
 */
export function MobileJournal(props: JournalViewProps) {
  const {
    entries, activeId, isNewEntry, status, lastSavedAt, saveError,
    onSelect, onEditEntry, onSelectionChange, onEntryMenuAction, onDeleteEntries, onNew, query, onQueryChange, onLookBack, onScripture, onAltar, altarEnabled, onOpenSettings, onSync,
    settings, updateSettings, focus, sidebarOpen, onToggleSidebar, onToggleEntries, mainSlot, userEmail,
    reflectionsActive, altarActive, scriptureActive, bulkActive, bulkCount, rangeSelectActive,
    entryReturn, onReturnFromEntry,
  } = props
  const vh = useViewportHeight()
  const keyboardOpen = useKeyboardOpen()
  // One-time discovery embers on the Return destinations (see surfaceEmbers.ts).
  const embers = useSurfaceEmbers()
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const focused = focus.active
  const canvasAlternateActive = reflectionsActive || altarActive || scriptureActive
  const journalChrome = !canvasAlternateActive

  function closeDrawer() {
    if (sidebarOpen) onToggleSidebar()
  }
  // Route through onToggleEntries (not the raw sidebar toggle) so opening Entries
  // from an alternate surface (Ascent / Lamp / Altar) first returns to the journal
  // — otherwise the alt-surface guard immediately snaps the sidebar shut and the
  // tap appears to do nothing.
  function openDrawer() {
    if (!sidebarOpen) onToggleEntries()
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    if (t) touchStart.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current
    const t = e.changedTouches[0]
    if (!start || !t) return
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx > 0 && start.x < EDGE_ZONE && !sidebarOpen) openDrawer()
      else if (dx < 0 && sidebarOpen) closeDrawer()
    }
    touchStart.current = null
  }

  const activeEntry = entries.find((e) => e.id === activeId)
  const heading = bulkActive
    ? `${bulkCount} entries selected`
    : rangeSelectActive
      ? 'Selecting entries'
      : activeEntry
        ? deriveTitle(activeEntry.body_markdown) || 'Untitled'
        : 'New entry'

  return (
    <div
      className="app-shell"
      style={{ flexDirection: 'column', height: vh ? `${vh}px` : '100dvh' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {!focused && journalChrome && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: 'max(0.5rem, env(safe-area-inset-top)) 0.75rem 0.5rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {entryReturn ? (
            <button
              type="button"
              className="journal-topbar__back"
              onClick={onReturnFromEntry}
            >
              ← {ENTRY_RETURN_LABEL[entryReturn.surface]}
            </button>
          ) : null}
          <span
            style={{
              flex: 1,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: 'var(--text-bright)',
              fontSize: '0.95rem',
            }}
          >
            {heading}
          </span>
          <div className="status-cluster">
            <span className="status-cluster__dot" data-status={status} aria-hidden />
            <SaveStatusBadge status={status} lastSavedAt={lastSavedAt} error={saveError} bare />
            <span className="status-cluster__sep" aria-hidden>·</span>
            <SyncBadge bare onSync={onSync} />
          </div>
        </header>
      )}

      <div
        className={`journal-canvas${canvasAlternateActive ? ' journal-canvas--reflections' : ''}`}
        style={{ flex: 1, minHeight: 0 }}
      >
        {!focused && journalChrome && (
          <>
            <div className="journal-horizon" aria-hidden />
            <div className="journal-glow" aria-hidden />
          </>
        )}
        <div
          className="journal-canvas__content"
          style={{
            padding: focused ? '0 1rem' : canvasAlternateActive ? '0' : '2.5rem 1rem 1.25rem',
            overflow: 'hidden',
          }}
        >
          {mainSlot}
        </div>
      </div>

      {/* While the keyboard is up, the command-accessory bar (rendered with the
          editor) takes over the bottom; the global nav steps aside so we never
          stack two bars. It returns the moment the keyboard drops. The bar and
          FAB also step aside while the entries drawer is open — the drawer is
          its own focused context. */}
      {!focused && !keyboardOpen && !sidebarOpen && (
        <>
          {/* Perpetual New-entry button — the app's primary act, floated above
              the bar so it's always in thumb reach without crowding the labeled
              destinations below. */}
          <button
            className="mobile-fab"
            onClick={onNew}
            aria-label="New entry"
            title={`New entry (${formatNewEntryShortcut()})`}
          >
            <IconNew size={26} />
          </button>

          {/* Permanent navigation — every destination reads as an icon over a
              word so nothing is a guess. Focus mode lives with the writing
              controls (it hides this bar, so it doesn't belong on it). */}
          <nav className="mobile-bar mobile-bar--tabs" aria-label="Primary">
            <MobileTab
              label="Entries"
              onClick={onToggleEntries}
              icon={<IconEntries size={22} />}
            />
            <MobileTab
              label="Ascent"
              onClick={onLookBack}
              active={reflectionsActive}
              ember={embers.reflections && !reflectionsActive}
              icon={<IconAscent size={22} />}
            />
            <MobileTab
              label="Lamp"
              onClick={onScripture}
              active={scriptureActive}
              ember={embers.scripture && !scriptureActive}
              icon={<IconScripture size={22} />}
            />
            {altarEnabled && (
              <MobileTab
                label="Altar"
                onClick={onAltar}
                active={altarActive}
                ember={embers.altar && !altarActive}
                icon={<IconAltar size={22} />}
              />
            )}
            <MobileTab
              label="Settings"
              onClick={onOpenSettings}
              icon={<IconSettings size={22} />}
            />
          </nav>
        </>
      )}

      {sidebarOpen && !focused && (
        <>
          <div className="scrim" onClick={closeDrawer} />
          <div className="drawer">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.6rem 0.75rem',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <Brand size={20} wordmarkRem={1.05} />
              <button className="btn btn--ghost" onClick={() => void signOut()} title={userEmail}>⎋</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <EntryList
                entries={entries}
                activeId={activeId}
                isNewEntry={isNewEntry}
                onSelect={onSelect}
                onEditEntry={onEditEntry}
                {...(onSelectionChange ? { onSelectionChange } : {})}
                onMenuAction={onEntryMenuAction}
                onDeleteEntries={onDeleteEntries}
                query={query}
                onQueryChange={onQueryChange}
                fullWidth
              />
            </div>
          </div>
        </>
      )}

      <WritingControls
        settings={settings}
        update={updateSettings}
        focus={focus}
        {...(journalChrome && !keyboardOpen && !sidebarOpen ? { onEnterFocus: focus.enter } : {})}
      />
    </div>
  )
}

interface MobileTabProps {
  label: string
  onClick: () => void
  icon: ReactNode
  active?: boolean
  /** One-time discovery ember — the destination holds something not yet seen. */
  ember?: boolean
}

/** One labeled destination in the bottom bar: icon stacked over its word. */
function MobileTab({ label, onClick, icon, active = false, ember = false }: MobileTabProps) {
  return (
    <button
      type="button"
      className="mobile-tab"
      data-active={active ? 'true' : undefined}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <span className="mobile-tab__glyph">
        {icon}
        {ember ? <span className="mobile-tab__ember" aria-hidden /> : null}
      </span>
      <span className="mobile-tab__label">{label}</span>
    </button>
  )
}
