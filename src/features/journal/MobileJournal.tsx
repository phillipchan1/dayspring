import { useRef } from 'react'
import { Brand } from '@/components/Mark'
import { EntryList } from './EntryList'
import { useViewportHeight } from '@/hooks/useViewportHeight'
import { useKeyboardOpen } from '@/hooks/useKeyboard'
import { SaveStatusBadge } from './SaveStatusBadge'
import { SyncBadge } from './SyncBadge'
import { WritingControls } from './WritingControls'
import { ENTRY_RETURN_LABEL } from '@/lib/appHistory'
import { formatNewEntryShortcut } from '@/features/shortcuts/shortcuts'
import { useSurfaceEmbers } from './surfaceEmbers'
import { useSurfaceUpdates } from './surfaceUpdates'
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
 * Mobile: a single, full-width column. Controls live in a thumb-reachable
 * bottom bar that respects the home-indicator inset, and the shell tracks the
 * visual viewport so the keyboard never covers the bar.
 *
 * The entries drawer is gone with the list it held: the Entries tab goes to the
 * Pages wall, which takes the canvas like every other surface. That also retires
 * the left-edge swipe — worth naming in a release note, because it was muscle
 * memory for anyone who had it.
 */
export function MobileJournal(props: JournalViewProps) {
  const {
    entries, activeId, isNewEntry, status, lastSavedAt, saveError,
    onSelect, onEditEntry, onSelectionChange, onEntryMenuAction, onDeleteEntries,
    onNew, query, onQueryChange, onLookBack, onScripture, onAltar, altarEnabled, onOpenSettings, onSync,
    settings, updateSettings, focus, sidebarOpen, onToggleSidebar, onDrawerNavigated,
    onToggleEntries, onPagesMode, mainSlot, userEmail,
    reflectionsActive, altarActive, scriptureActive, pagesActive, bulkActive, bulkCount, rangeSelectActive,
    entryReturn, onReturnFromEntry,
  } = props
  const vh = useViewportHeight()
  const keyboardOpen = useKeyboardOpen()
  // Two layers light a Return destination's dot: the one-time discovery ember
  // and recurring "new since last visit" items (see surfaceEmbers/surfaceUpdates).
  const embers = useSurfaceEmbers()
  const updates = useSurfaceUpdates()
  const dot = {
    reflections: embers.reflections || updates.reflections.length > 0,
    scripture: embers.scripture || updates.scripture.length > 0,
    altar: embers.altar || updates.altar.length > 0,
  }
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const focused = focus.active
  // Ascent / Lamp / Altar replace the journal outright; Pages only takes the
  // canvas, and the drawer that switches modes stays reachable behind it.
  const surfaceActive = reflectionsActive || altarActive || scriptureActive
  const canvasTaken = surfaceActive || pagesActive
  const journalChrome = !canvasTaken

  function closeDrawer() {
    if (sidebarOpen) onToggleSidebar()
  }
  // Route through onToggleEntries so opening the drawer from an alternate
  // surface returns to the journal first — otherwise the guard snaps it shut
  // and the swipe appears to do nothing.
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
      // Fill the full screen with 100dvh (reaches the bottom edge on iOS
      // standalone). Only pin to the measured visual-viewport height while the
      // keyboard is up, so the bottom bar lifts above it — visualViewport.height
      // excludes the home-indicator inset, which otherwise leaves a dead band.
      style={{ flexDirection: 'column', height: keyboardOpen && vh ? `${vh}px` : '100dvh' }}
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
        className={`journal-canvas${canvasTaken ? ' journal-canvas--reflections' : ''}`}
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
            padding: focused ? '0 1rem' : canvasTaken ? '0' : '2.5rem 1rem 1.25rem',
            overflow: 'hidden',
          }}
        >
          {mainSlot}
        </div>
      </div>

      {/* While the keyboard is up, the command-accessory bar (rendered with the
          editor) takes over the bottom; the global nav steps aside so we never
          stack two bars. It returns the moment the keyboard drops. The bar and
          FAB step aside while the drawer is open — it is its own context. */}
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
              active={pagesActive}
              icon={<IconEntries size={22} />}
            />
            <MobileTab
              label="Ascent"
              onClick={onLookBack}
              active={reflectionsActive}
              ember={dot.reflections && !reflectionsActive}
              icon={<IconAscent size={22} />}
            />
            <MobileTab
              label="Lamp"
              onClick={onScripture}
              active={scriptureActive}
              ember={dot.scripture && !scriptureActive}
              icon={<IconScripture size={22} />}
            />
            {altarEnabled && (
              <MobileTab
                label="Altar"
                onClick={onAltar}
                active={altarActive}
                ember={dot.altar && !altarActive}
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
              <span className="drawer__account" title={userEmail}>{userEmail}</span>
            </div>
            {/* .entry-list is itself the scroller — a second one here nests two
                momentum-scrolling regions, which stalls on iOS. */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <EntryList
                entries={entries}
                activeId={activeId}
                isNewEntry={isNewEntry}
                onSelect={onSelect}
                onEditEntry={onEditEntry}
                // NOT closeDrawer: that pops the drawer's history frame, and the
                // entry you just tapped was replaced onto that very frame — the
                // pop threw the selection away and put you back on the surface
                // the drawer opened over (Ascent, most often). Opening an entry
                // consumes the frame instead.
                onRowActivate={onDrawerNavigated}
                {...(onSelectionChange ? { onSelectionChange } : {})}
                onMenuAction={onEntryMenuAction}
                onDeleteEntries={onDeleteEntries}
                query={query}
                onQueryChange={onQueryChange}
                fullWidth
                pagesMode={pagesActive}
                // The drawer has to close behind it, or the wall opens under a
                // sheet that is still covering it — and it closes as part of the
                // switch's own navigation rather than a pop before it, which
                // raced the push and, from a drawer sitting on top of the wall,
                // popped straight back onto the wall you asked to leave.
                onPagesMode={onPagesMode}
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
