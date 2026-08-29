import { isTauri, MAC_TRAFFIC_INSET } from '@/lib/platform'
import { Rail } from './Rail'
import { SaveStatusBadge } from './SaveStatusBadge'
import { SyncBadge } from './SyncBadge'
import { WritingControls } from './WritingControls'
import { IconRitual } from './navIcons'
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
 * The door into the rituals, for people who don't know `/` exists.
 *
 * **Only rituals, and only here** (and the matching blank-page control on
 * mobile). Scripture and prayer are things you reach for mid-sentence, about
 * the line you are on — they belong on the `+` beside that line and on the
 * keyboard bar. A ritual is not about a line; it is a shape for the whole page,
 * chosen before there is a page. That is why this one sits up top beside the
 * date, and why the row that briefly sat here offering `/scripture` and `/pray`
 * was putting three different scopes in one place.
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
    onNew, isNewEntry, onLookBack, onScripture, onAltar, altarEnabled, onOpenSettings, onSync,
    settings, updateSettings, focus, onPages, mainSlot,
    reflectionsActive, altarActive, scriptureActive, pagesActive, bulkActive, bulkCount, rangeSelectActive,
    entryReturn, onReturnFromEntry,
    onCommand,
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
  const canvasTaken = reflectionsActive || altarActive || scriptureActive || pagesActive
  const journalChrome = !canvasTaken
  // Nothing written yet — either a brand-new entry, or one that's been emptied.
  const blankPage = !bulkActive && !rangeSelectActive && (isNewEntry || words === 0)

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
              {/* Only on a page nobody has written on yet — the same discipline
                  bodyLinePlaceholder already keeps. It is a starting affordance,
                  not a toolbar, and it retires itself at the first word. */}
              {blankPage && (
                <button
                  type="button"
                  className="journal-topbar__ritual"
                  onClick={() => onCommand('ritual')}
                  title="Practices for the inner life"
                >
                  <IconRitual />
                  Ritual
                </button>
              )}
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
