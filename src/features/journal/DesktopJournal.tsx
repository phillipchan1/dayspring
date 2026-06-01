import { isTauri, MAC_TRAFFIC_INSET } from '@/lib/platform'
import { EntryList } from './EntryList'
import { Rail } from './Rail'
import { ENTRIES_PANEL_WIDTH_MAX, ENTRIES_PANEL_WIDTH_MIN } from './entriesPanelWidth'
import { useEntriesPanelResize } from './useEntriesPanelResize'
import { SaveStatusBadge } from './SaveStatusBadge'
import { SyncBadge } from './SyncBadge'
import { FabNew } from './FabNew'
import { WritingControls } from './WritingControls'
import type { JournalViewProps } from './journalViewProps'

// In the native macOS app the title bar is transparent (overlay style), so the
// traffic-light buttons float over our content. The rail owns the top-left now,
// so it carries the clearance; the top bar only needs a little extra height.
const NATIVE = isTauri()

function formatBreadcrumb(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toLowerCase()
}

/**
 * Desktop: three columns — a slim navigation rail, a toggleable Entries panel,
 * and the centered writing canvas. Entering focus mode hides the rail, panel,
 * and top bar so the canvas takes the whole screen.
 */
export function DesktopJournal(props: JournalViewProps) {
  const {
    entries, activeId, words, status, lastSavedAt, saveError,
    onSelect, onEntryMenuAction, onNew, query, onQueryChange, onLookBack, onOpenSettings,
    settings, updateSettings, focus, entriesOpen, onToggleEntries, mainSlot,
  } = props
  const focused = focus.active
  const activeEntry = entries.find((e) => e.id === activeId)
  const { width: entriesPanelWidth, resizing, onResizePointerDown } = useEntriesPanelResize()

  return (
    <div className="app-shell">
      {!focused && (
        <Rail
          onToggleEntries={onToggleEntries}
          entriesOpen={entriesOpen}
          onLookBack={onLookBack}
          onOpenSettings={onOpenSettings}
          nativeTopInset={NATIVE ? MAC_TRAFFIC_INSET.railTop : undefined}
        />
      )}

      {!focused && (
        <div
          className="entries-panel"
          data-open={entriesOpen ? 'true' : 'false'}
          data-resizing={resizing ? 'true' : undefined}
          style={{ '--entries-panel-width': `${entriesPanelWidth}px` } as React.CSSProperties}
        >
          <EntryList
            entries={entries}
            activeId={activeId}
            onSelect={onSelect}
            onMenuAction={onEntryMenuAction}
            query={query}
            onQueryChange={onQueryChange}
          />
          {entriesOpen && (
            <div
              className="entries-panel__resize"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize entries panel"
              aria-valuemin={ENTRIES_PANEL_WIDTH_MIN}
              aria-valuemax={ENTRIES_PANEL_WIDTH_MAX}
              aria-valuenow={entriesPanelWidth}
              onPointerDown={onResizePointerDown}
            />
          )}
        </div>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!focused && (
          <header
            className="journal-topbar"
            style={NATIVE ? { paddingTop: MAC_TRAFFIC_INSET.mainTop } : undefined}
          >
            <div className="journal-topbar__lead">
              {activeEntry ? formatBreadcrumb(activeEntry.created_at) : ''}
            </div>
            <div className="journal-topbar__actions">
              <div className="status-cluster" style={{ marginRight: '0.6rem' }}>
                <span className="status-cluster__dot" data-status={status} aria-hidden />
                <span>{words} {words === 1 ? 'word' : 'words'}</span>
                <span className="status-cluster__sep" aria-hidden>·</span>
                <SaveStatusBadge status={status} lastSavedAt={lastSavedAt} error={saveError} bare />
                <span className="status-cluster__sep" aria-hidden>·</span>
                <SyncBadge bare />
              </div>
              <button className="nav-btn" onClick={focus.enter} title="Focus mode (⌘⏎)">
                focus
              </button>
            </div>
          </header>
        )}

        <div className="journal-canvas" style={{ flex: 1, minHeight: 0 }}>
          {!focused && (
            <>
              <div className="journal-horizon" aria-hidden />
              <div className="journal-glow" aria-hidden />
            </>
          )}
          <div
            className="journal-canvas__content"
            style={{ padding: focused ? '0 1.5rem' : '4rem 1.5rem 2.5rem', overflow: 'hidden' }}
          >
            {mainSlot}
          </div>
        </div>
      </main>

      {!focused && <FabNew onClick={onNew} />}

      <WritingControls settings={settings} update={updateSettings} focus={focus} />
    </div>
  )
}
