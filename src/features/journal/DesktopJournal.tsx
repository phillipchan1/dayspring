import { isTauri, MAC_TRAFFIC_INSET } from '@/lib/platform'
import { Rail } from './Rail'
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
 * Desktop: a slim navigation rail and the canvas. Entering focus mode hides the
 * rail and top bar so the canvas takes the whole screen.
 *
 * Two columns, not three. The middle one was the entries panel; Entries is the
 * Pages wall now, which takes the canvas like every other surface — so the
 * editor is never sharing a screen with an index of itself, and writing is
 * always full width.
 */
export function DesktopJournal(props: JournalViewProps) {
  const {
    entries, activeId, words, status, lastSavedAt, saveError,
    onNew, isNewEntry, onLookBack, onScripture, onAltar, altarEnabled, onOpenSettings, onSync,
    settings, updateSettings, focus, onToggleEntries, mainSlot,
    reflectionsActive, altarActive, scriptureActive, pagesActive,
    entryReturn, onReturnFromEntry,
  } = props
  const focused = focus.active
  const activeEntry = entries.find((e) => e.id === activeId)
  const topbarLabel = activeEntry
    ? formatBreadcrumb(activeEntry.created_at)
    : isNewEntry
      ? formatBreadcrumb(new Date().toISOString())
      : ''
  // A surface owns the canvas, so the journal's own chrome steps aside.
  const surfaceActive =
    reflectionsActive || altarActive || scriptureActive || pagesActive
  const journalChrome = !surfaceActive

  return (
    <div className="app-shell">
      {!focused && (
        <Rail
          onNew={onNew}
          onEntries={onToggleEntries}
          pagesActive={pagesActive}
          lookBackActive={reflectionsActive}
          onLookBack={onLookBack}
          scriptureActive={scriptureActive}
          onScripture={onScripture}
          altarActive={altarActive}
          onAltar={onAltar}
          altarEnabled={altarEnabled}
          onOpenSettings={onOpenSettings}
          labelsExpanded={settings.railLabels}
          onToggleLabels={() => updateSettings({ railLabels: !settings.railLabels })}
          nativeTopInset={NATIVE ? MAC_TRAFFIC_INSET.railTop : undefined}
        />
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
                <span className="status-cluster__dot" data-status={status} aria-hidden />
                <span>{words} {words === 1 ? 'word' : 'words'}</span>
                <span className="status-cluster__sep" aria-hidden>·</span>
                <SaveStatusBadge status={status} lastSavedAt={lastSavedAt} error={saveError} bare />
                <span className="status-cluster__sep" aria-hidden>·</span>
                <SyncBadge bare onSync={onSync} />
              </div>
              <button className="nav-btn" onClick={focus.enter} title="Focus mode (⌘⏎)">
                focus
              </button>
            </div>
          </header>
        )}

        <div
          className={`journal-canvas${surfaceActive ? ' journal-canvas--reflections' : ''}`}
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
                : surfaceActive
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
