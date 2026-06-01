import { useState } from 'react'
import { signOut } from '@/lib/auth'
import { isTauri, MAC_TRAFFIC_INSET } from '@/lib/platform'
import { EntryList } from './EntryList'
import { SaveStatusBadge } from './SaveStatusBadge'
import { SyncBadge } from './SyncBadge'
import { WritingControls } from './WritingControls'
import type { JournalViewProps } from './journalViewProps'

// In the native macOS app the title bar is transparent (overlay style), so the
// traffic-light buttons float over our content. Leave room for them: always a
// little extra height, plus left clearance for the header when the sidebar is
// collapsed (otherwise the lights cover the first buttons).
const NATIVE = isTauri()

/**
 * Desktop: a centered writing column with deep margins (the column width comes
 * from the editor theme's max-width) plus a hideable entry-list panel. The
 * moment you enter focus mode, the panel and header vanish and the column
 * takes the whole screen.
 */
export function DesktopJournal(props: JournalViewProps) {
  const {
    userEmail, entries, activeId, words, status, lastSavedAt, saveError,
    onSelect, onNew, query, onQueryChange, onLookBack, onOpenSettings,
    settings, updateSettings, focus, mainSlot,
  } = props
  const [showList, setShowList] = useState(true)
  const focused = focus.active

  return (
    <div className="app-shell">
      {!focused && showList && (
        <EntryList
          entries={entries}
          activeId={activeId}
          onSelect={onSelect}
          query={query}
          onQueryChange={onQueryChange}
        />
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!focused && (
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: NATIVE
                ? `${MAC_TRAFFIC_INSET.mainTop} ${MAC_TRAFFIC_INSET.mainX} 0.6rem ${
                    showList ? MAC_TRAFFIC_INSET.mainX : MAC_TRAFFIC_INSET.mainLeftCollapsed
                  }`
                : '0.6rem 1rem',
              borderBottom: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-1)',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
              <button
                className="nav-btn"
                title={showList ? 'Hide entries' : 'Show entries'}
                onClick={() => setShowList((s) => !s)}
              >
                {showList ? '◀' : '☰'}
              </button>
              <button className="nav-btn" onClick={onNew} title="New entry (C)">
                new
              </button>
              <button className="nav-btn" onClick={onLookBack} title="Monthly reflections">
                looking back
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem' }}>
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
              <button className="nav-btn" onClick={onOpenSettings} title="Settings (⌘,)">
                ⚙
              </button>
              <button className="nav-btn" onClick={() => void signOut()} title={userEmail}>
                sign out
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

      <WritingControls settings={settings} update={updateSettings} focus={focus} />
    </div>
  )
}
