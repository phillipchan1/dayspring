import { useState } from 'react'
import { signOut } from '@/lib/auth'
import { EntryList } from './EntryList'
import { SaveStatusBadge } from './SaveStatusBadge'
import { SyncBadge } from './SyncBadge'
import { WritingControls } from './WritingControls'
import type { JournalViewProps } from './journalViewProps'

/**
 * Desktop: a centered writing column with deep margins (the column width comes
 * from the editor theme's max-width) plus a hideable entry-list panel. The
 * moment you enter focus mode, the panel and header vanish and the column
 * takes the whole screen.
 */
export function DesktopJournal(props: JournalViewProps) {
  const {
    userEmail, entries, activeId, words, status, lastSavedAt, saveError,
    onSelect, onNew, query, onQueryChange, mode, onToggleMode, onLookBack, onOpenSettings,
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
              padding: '0.6rem 1rem',
              borderBottom: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-1)',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                className="btn btn--ghost"
                title={showList ? 'Hide entries' : 'Show entries'}
                onClick={() => setShowList((s) => !s)}
              >
                {showList ? '◀' : '☰'}
              </button>
              <button className="btn btn--ghost" onClick={onNew} title="New entry (C)">
                + New
              </button>
              <button
                className="btn btn--ghost"
                onClick={onToggleMode}
                title={mode === 'write' ? 'Read (Esc)' : 'Edit (E)'}
              >
                {mode === 'write' ? 'Read' : 'Edit'}
              </button>
              <button className="btn btn--ghost" onClick={onLookBack} title="Monthly reflections">
                Looking back
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
                {words} {words === 1 ? 'word' : 'words'}
              </span>
              <SaveStatusBadge status={status} lastSavedAt={lastSavedAt} error={saveError} />
              <SyncBadge />
              <button className="btn btn--ghost" onClick={focus.enter} title="Focus mode (⌘⏎)">
                Focus
              </button>
              <button className="btn btn--ghost" onClick={onOpenSettings} title="Settings (⌘,)">
                ⚙
              </button>
              <button className="btn btn--ghost" onClick={() => void signOut()} title={userEmail}>
                Sign out
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

      <WritingControls
        settings={settings}
        update={updateSettings}
        focus={focus}
        visible={mode === 'write'}
      />
    </div>
  )
}
