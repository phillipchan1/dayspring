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
import { deriveTitle } from './deriveTitle'
import type { Entry } from '@/lib/types'
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
    entries, activeId, status, lastSavedAt, saveError,
    onSelect, onEditEntry, onSelectionChange, onEntryMenuAction, onDeleteEntries, onNew, query, onQueryChange, onLookBack, onScripture, onAltar, onOpenSettings,
    settings, updateSettings, focus, sidebarOpen, onToggleSidebar, mainSlot, userEmail,
    reflectionsActive, altarActive, scriptureActive, bulkActive, bulkCount, rangeSelectActive,
    entryReturn, onReturnFromEntry,
  } = props
  const vh = useViewportHeight()
  const keyboardOpen = useKeyboardOpen()
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const focused = focus.active
  const canvasAlternateActive = reflectionsActive || altarActive || scriptureActive
  const journalChrome = !canvasAlternateActive

  function closeDrawer() {
    if (sidebarOpen) onToggleSidebar()
  }
  function openDrawer() {
    if (!sidebarOpen) onToggleSidebar()
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

  function handleEditEntry(entry: Entry) {
    onEditEntry(entry)
    closeDrawer()
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
            <SyncBadge bare />
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
          stack two bars. It returns the moment the keyboard drops. */}
      {!focused && !keyboardOpen && (
        <>
          <nav className="mobile-bar">
            <button
              className="nav-btn"
              onClick={onNew}
              aria-label="New entry"
              title={`New entry (${formatNewEntryShortcut()})`}
            >
              +
            </button>
            <button className="nav-btn" onClick={openDrawer} aria-label="Entries" title="Entries (⌘1)">
              ☰
            </button>
            <button className="nav-btn" onClick={onLookBack} aria-label="Ascent" title="Ascent (⌘2)">
              ▲
            </button>
            <button className="nav-btn" onClick={onScripture} aria-label="Lamp" title="Lamp (⌘3)">
              ✦
            </button>
            <button className="nav-btn" onClick={onAltar} aria-label="Altar" title="Altar (⌘4)">
              ◇
            </button>
            {journalChrome && (
              <button className="nav-btn" onClick={focus.enter} title="Focus mode (⌘⏎)">
                focus
              </button>
            )}
            <button className="nav-btn" onClick={onOpenSettings} aria-label="Settings" title="Settings (⌘,)">
              ⚙
            </button>
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
                onSelect={onSelect}
                onEditEntry={handleEditEntry}
                {...(onSelectionChange ? { onSelectionChange } : {})}
                onRowActivate={closeDrawer}
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

      {journalChrome && (
        <WritingControls settings={settings} update={updateSettings} focus={focus} />
      )}
    </div>
  )
}
