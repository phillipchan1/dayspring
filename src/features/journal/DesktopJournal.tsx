import { isTauri, MAC_TRAFFIC_INSET } from '@/lib/platform'
import { Rail } from './Rail'
import { StatusCluster } from './StatusCluster'
import { WritingControls } from './WritingControls'
import { ENTRY_RETURN_LABEL } from '@/lib/appHistory'
import { BackChevron } from '@/components/BackChevron'
import type { JournalViewProps } from './journalViewProps'

// In the native macOS app the title bar is transparent (overlay style), so the
// traffic-light buttons float over our content. The rail owns the top-left now,
// so it carries the clearance; the top bar's extra height is `--frame-bar-top`.
const NATIVE = isTauri()

function formatBreadcrumb(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

/*
 * The door into the rituals no longer lives up here. A ritual is a shape for
 * the whole page, chosen before there is a page, so its door is now the shelf
 * at the foot of a blank page itself (`RitualShelf.tsx`) — the one place a
 * page is unmistakably blank.
 */

/**
 * Desktop: two columns — a slim navigation rail and the canvas. Entering focus
 * mode hides the rail and top bar so the canvas takes the whole screen.
 *
 * There used to be a third: a resizable Entries panel holding a list of 30px
 * rows. It is gone (D-025). Everything it did, Pages does at the far end of its
 * zoom — ~30 rows a screen, scannable by date, today's page marked, and a
 * double-click opens it to write. What the panel could never do is what makes
 * the trade worth it: lighting a subject DIMS the rest instead of throwing it
 * away, so you keep the shape of the years around what you were looking for.
 */
export function DesktopJournal(props: JournalViewProps) {
  const {
    entries, activeId, words, status, lastSavedAt, saveError,
    onNew, isNewEntry, onLookBack, onScripture, onAltar, altarEnabled, onLifeMap, onRitualThreads, hasWalkedARitual, onOpenSettings, onSync,
    settings, updateSettings, focus, onPages, mainSlot,
    reflectionsActive, altarActive, scriptureActive, pagesActive, lifeMapActive, bulkActive, bulkCount, rangeSelectActive,
    userEmail, concordanceEnabled,
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
        : isNewEntry
          ? formatBreadcrumb(new Date().toISOString())
          : ''
  // A surface owns the canvas, so the journal's own chrome steps aside. Pages
  // is one of them now rather than a mode of a panel beside the canvas.
  const canvasTaken =
    reflectionsActive || altarActive || scriptureActive || pagesActive || lifeMapActive
  const journalChrome = !canvasTaken

  return (
    <div className="app-shell">
      {!focused && (
        <Rail
          onNew={onNew}
          pagesActive={pagesActive}
          onPages={onPages}
          lookBackActive={reflectionsActive}
          onLookBack={onLookBack}
          scriptureActive={scriptureActive}
          onScripture={onScripture}
          altarActive={altarActive}
          onAltar={onAltar}
          onLifeMap={onLifeMap}
          onRitualThreads={onRitualThreads}
          hasWalkedARitual={hasWalkedARitual}
          userEmail={userEmail}
          concordanceEnabled={concordanceEnabled}
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
            // In the frame Pages uses, so the way back from a page you are
            // writing sits exactly where the way back from a page you are
            // reading does (see `--frame-*` in global.css). The Mac clearance
            // comes from `--frame-bar-top` now, not an inline style.
            className="journal-topbar journal-topbar--frame"
            // No native title bar (overlay style), so the top bar doubles as the
            // window drag handle. Buttons/inputs inside lack the attribute, so
            // they stay clickable — Tauri only drags when the target itself has it.
            data-tauri-drag-region
          >
            <div className="journal-topbar__lead" data-tauri-drag-region>
              {entryReturn ? (
                <button
                  type="button"
                  className="journal-topbar__back"
                  onClick={onReturnFromEntry}
                >
                  <BackChevron />
                  {ENTRY_RETURN_LABEL[entryReturn.surface]}
                </button>
              ) : null}
              <span className="journal-topbar__label">{topbarLabel}</span>
            </div>
            <div className="journal-topbar__actions">
              <StatusCluster
                status={status}
                lastSavedAt={lastSavedAt}
                saveError={saveError}
                onSync={onSync}
                leading={<span>{words} {words === 1 ? 'word' : 'words'}</span>}
              />
              <button className="nav-btn" onClick={focus.enter} title="Focus mode (⌘⏎)">
                focus
              </button>
            </div>
          </header>
        )}

        <div
          className={`journal-canvas${canvasTaken ? ' journal-canvas--reflections' : ''}`}
          style={{ flex: 1, minHeight: 0 }}
        >
          {journalChrome && (
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
                : canvasTaken
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
