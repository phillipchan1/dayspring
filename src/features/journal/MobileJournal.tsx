import { useViewportHeight } from '@/hooks/useViewportHeight'
import { useKeyboardOpen } from '@/hooks/useKeyboard'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useSwipeToDismiss } from '@/hooks/useSwipeToDismiss'
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
  IconPages,
  IconNew,
  IconScripture,
  IconSettings,
} from './navIcons'
import type { ReactNode } from 'react'
import type { JournalViewProps } from './journalViewProps'

/**
 * Mobile: a single, full-width column. Controls live in a thumb-reachable
 * bottom bar that respects the home-indicator inset, and the shell tracks the
 * visual viewport so the keyboard never covers the bar.
 *
 * The entries drawer is gone with the list it held: the Entries tab goes to the
 * Pages wall, which takes the canvas like every other surface. That retired the
 * left-edge swipe that used to open the drawer; the edge now does what it does
 * on every other iPhone app, which is go back — see `back` below.
 */
export function MobileJournal(props: JournalViewProps) {
  const {
    entries, activeId, status, lastSavedAt, saveError,
    onNew, onLookBack, onScripture, onAltar, altarEnabled, onOpenSettings, onSync,
    settings, updateSettings, focus,
    onPages, mainSlot,
    reflectionsActive, altarActive, scriptureActive, pagesActive, bulkActive, bulkCount, rangeSelectActive,
    entryReturn, onReturnFromEntry,
  } = props
  const vh = useViewportHeight()
  const keyboardOpen = useKeyboardOpen()
  const touch = useMediaQuery('(pointer: coarse)')
  /*
   * The way back out of an entry, as a gesture.
   *
   * An entry opened from Pages (or Lamp, Altar, Ascent) is a PUSHED view — the
   * header says so with "← Pages" — and on a phone a pushed view is left by
   * dragging it off to the right. Only the header button did that, which is the
   * one thing a thumb reaching for the edge never finds.
   *
   * From the edge, and only the edge. Everything below the header is CodeMirror,
   * where a horizontal drag already means move the caret or extend the
   * selection; taking those would cost far more than a second way back is worth.
   * That is also exactly where iOS puts it, so nobody has to be told.
   *
   * `exit` because nothing else animates the editor away — the surface simply
   * changes — so the shell has to carry itself off the screen before it says it
   * has gone. Its twin is the `[data-leaving]` rule in global.css.
   */
  const back = useSwipeToDismiss({
    onDismiss: onReturnFromEntry,
    enabled: touch && !!entryReturn,
    edge: 32,
    threshold: 72,
    exit: true,
    // A selection handle dragged off the left edge is still a selection.
    guard: () => {
      const sel = window.getSelection()
      return !sel || sel.isCollapsed
    },
  })
  // Two layers light a Return destination's dot: the one-time discovery ember
  // and recurring "new since last visit" items (see surfaceEmbers/surfaceUpdates).
  const embers = useSurfaceEmbers()
  const updates = useSurfaceUpdates()
  const dot = {
    reflections: embers.reflections || updates.reflections.length > 0,
    scripture: embers.scripture || updates.scripture.length > 0,
    altar: embers.altar || updates.altar.length > 0,
  }
  const focused = focus.active
  // Every Return destination replaces the journal outright now, Pages included.
  const canvasTaken = reflectionsActive || altarActive || scriptureActive || pagesActive
  const journalChrome = !canvasTaken

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
      {...back.handlers}
      data-back-swipe={entryReturn ? 'true' : undefined}
      data-dragging={back.dragging ? 'true' : undefined}
      data-leaving={back.leaving ? 'true' : undefined}
      // Fill the full screen with 100dvh (reaches the bottom edge on iOS
      // standalone). Only pin to the measured visual-viewport height while the
      // keyboard is up, so the bottom bar lifts above it — visualViewport.height
      // excludes the home-indicator inset, which otherwise leaves a dead band.
      //
      // The transform is written only while the finger has hold of it: a
      // permanent one would make this the containing block for every fixed
      // child (the FAB, the docked command bar) for the entire life of the app.
      style={{
        flexDirection: 'column',
        height: keyboardOpen && vh ? `${vh}px` : '100dvh',
        ...(back.dragX ? { transform: `translateX(${back.dragX}px)` } : null),
      }}
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
        {journalChrome && (
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
      {!focused && !keyboardOpen && (
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
              label="Journal"
              onClick={onPages}
              active={pagesActive}
              icon={<IconPages size={22} />}
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


      <WritingControls
        settings={settings}
        update={updateSettings}
        focus={focus}
        {...(journalChrome && !keyboardOpen ? { onEnterFocus: focus.enter } : {})}
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
