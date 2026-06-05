import { isTauri, MAC_TRAFFIC_INSET } from '@/lib/platform'
import { EntryList } from './EntryList'
import { Rail } from './Rail'
import { ENTRIES_PANEL_WIDTH_MAX, ENTRIES_PANEL_WIDTH_MIN } from './entriesPanelWidth'
import { useEntriesPanelResize } from './useEntriesPanelResize'
import { SaveStatusBadge } from './SaveStatusBadge'
import { SyncBadge } from './SyncBadge'
import { WritingControls } from './WritingControls'
import { ENTRY_RETURN_LABEL } from '@/lib/appHistory'
import type { JournalViewProps } from './journalViewProps'

// In the native macOS app the title bar is transparent (overlay style), so the
// traffic-light buttons float over our content. The rail owns the top-left now,
// so it carries the clearance; the top bar only needs a little extra height.
const NATIVE = isTauri()

function formatBreadcrumb(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

/**
 * Desktop: three columns — a slim navigation rail, a toggleable Entries panel,
 * and the centered writing canvas. Entering focus mode hides the rail, panel,
 * and top bar so the canvas takes the whole screen.
 */
export function DesktopJournal(props: JournalViewProps) {
  const {
    entries, activeId, words, status, lastSavedAt, saveError,
    onSelect, onEditEntry, onSelectionChange, onEntryMenuAction, onDeleteEntries, onNew, query, onQueryChange, onLookBack, onThreads, onScripture, onAltar, onOpenSettings, onSync,
    settings, updateSettings, focus, entriesOpen, onToggleEntries, mainSlot,
    reflectionsActive, threadsActive, altarActive, scriptureActive, bulkActive, bulkCount, rangeSelectActive,
    entryReturn, onReturnFromEntry,
  } = props
  const focused = focus.active
  const activeEntry = entries.find((e) => e.id === activeId)
  const topbarLabel = bulkActive
    ? `${bulkCount} entries selected`
    : rangeSelectActive
      ? 'Selecting entries'
      : activeEntry
        ? formatBreadcrumb(activeEntry.created_at)
        : ''
  const { width: entriesPanelWidth, resizing, onResizePointerDown } = useEntriesPanelResize()
  const canvasAlternateActive = reflectionsActive || threadsActive || altarActive || scriptureActive
  const journalChrome = !canvasAlternateActive

  return (
    <div className="app-shell">
      {!focused && (
        <Rail
          onNew={onNew}
          onToggleEntries={onToggleEntries}
          entriesOpen={entriesOpen}
          lookBackActive={reflectionsActive}
          onLookBack={onLookBack}
          threadsActive={threadsActive}
          onThreads={onThreads}
          scriptureActive={scriptureActive}
          onScripture={onScripture}
          altarActive={altarActive}
          onAltar={onAltar}
          onOpenSettings={onOpenSettings}
          labelsExpanded={settings.railLabels}
          onToggleLabels={() => updateSettings({ railLabels: !settings.railLabels })}
          nativeTopInset={NATIVE ? MAC_TRAFFIC_INSET.railTop : undefined}
        />
      )}

      {!focused && !canvasAlternateActive && (
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
            onEditEntry={onEditEntry}
            {...(onSelectionChange ? { onSelectionChange } : {})}
            onMenuAction={onEntryMenuAction}
            onDeleteEntries={onDeleteEntries}
            query={query}
            onQueryChange={onQueryChange}
            onCollapse={onToggleEntries}
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
        {!focused && journalChrome && (
          <header
            className="journal-topbar"
            // No native title bar (overlay style), so the top bar doubles as the
            // window drag handle. Buttons/inputs inside lack the attribute, so
            // they stay clickable — Tauri only drags when the target itself has it.
            data-tauri-drag-region
            style={NATIVE ? { paddingTop: MAC_TRAFFIC_INSET.mainTop } : undefined}
          >
            <div className="journal-topbar__lead" data-tauri-drag-region>
              {entryReturn ? (
                <button
                  type="button"
                  className="journal-topbar__back"
                  onClick={onReturnFromEntry}
                >
                  ← {ENTRY_RETURN_LABEL[entryReturn.surface]}
                </button>
              ) : null}
              <span className="journal-topbar__label">{topbarLabel}</span>
            </div>
            <div className="journal-topbar__actions">
              <div className="status-cluster" style={{ marginRight: '0.6rem' }} data-tauri-drag-region>
                {!bulkActive && !rangeSelectActive && (
                  <>
                    <span className="status-cluster__dot" data-status={status} aria-hidden />
                    <span>{words} {words === 1 ? 'word' : 'words'}</span>
                    <span className="status-cluster__sep" aria-hidden>·</span>
                  </>
                )}
                <SaveStatusBadge status={status} lastSavedAt={lastSavedAt} error={saveError} bare />
                {!bulkActive && !rangeSelectActive && (
                  <>
                    <span className="status-cluster__sep" aria-hidden>·</span>
                    <SyncBadge bare onSync={onSync} />
                  </>
                )}
              </div>
              <button className="nav-btn" onClick={focus.enter} title="Focus mode (⌘⏎)">
                focus
              </button>
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
              padding: focused
                ? '0 1.5rem'
                : canvasAlternateActive
                  ? '0'
                  : '4rem 1.5rem 2.5rem',
              overflow: 'hidden',
            }}
          >
            {mainSlot}
          </div>
        </div>
      </main>

      <WritingControls settings={settings} update={updateSettings} focus={focus} />
    </div>
  )
}
