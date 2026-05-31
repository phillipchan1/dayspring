import { useRef, useState } from 'react'
import { signOut } from '@/lib/auth'
import { useViewportHeight } from '@/hooks/useViewportHeight'
import { EntryList } from './EntryList'
import { SaveStatusBadge } from './SaveStatusBadge'
import { SyncBadge } from './SyncBadge'
import { FocusControls } from './FocusControls'
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
    onSelect, onNew, query, onQueryChange, mode, onToggleMode, onOpenSettings,
    settings, updateSettings, focus, mainSlot, userEmail,
  } = props
  const [drawerOpen, setDrawerOpen] = useState(false)
  const vh = useViewportHeight()
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const focused = focus.active

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
      if (dx > 0 && start.x < EDGE_ZONE && !drawerOpen) setDrawerOpen(true)
      else if (dx < 0 && drawerOpen) setDrawerOpen(false)
    }
    touchStart.current = null
  }

  function handleSelect(entry: Entry) {
    onSelect(entry)
    setDrawerOpen(false)
  }

  const activeEntry = entries.find((e) => e.id === activeId)
  const heading = activeEntry ? deriveTitle(activeEntry.body_markdown) || 'Untitled' : 'New entry'

  return (
    <div
      className="app-shell"
      style={{ flexDirection: 'column', height: vh ? `${vh}px` : '100dvh' }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {!focused && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: 'max(0.5rem, env(safe-area-inset-top)) 0.75rem 0.5rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
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
          <SyncBadge />
          <SaveStatusBadge status={status} lastSavedAt={lastSavedAt} error={saveError} />
        </header>
      )}

      <div style={{ flex: 1, minHeight: 0, padding: focused ? '0 1rem' : '1.25rem 1rem', overflow: 'hidden' }}>
        {mainSlot}
      </div>

      {!focused && (
        <nav className="mobile-bar">
          <button className="btn btn--ghost" onClick={() => setDrawerOpen(true)} aria-label="Entries">
            ☰
          </button>
          <button className="btn btn--ghost" onClick={onNew}>
            + New
          </button>
          <button className="btn btn--ghost" onClick={onToggleMode}>
            {mode === 'write' ? 'Read' : 'Edit'}
          </button>
          <button className="btn btn--ghost" onClick={focus.enter}>
            Focus
          </button>
          <button className="btn btn--ghost" onClick={onOpenSettings} aria-label="Settings">
            ⚙
          </button>
        </nav>
      )}

      {drawerOpen && !focused && (
        <>
          <div className="scrim" onClick={() => setDrawerOpen(false)} />
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
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-bright)' }}>Dayspring</span>
              <button className="btn btn--ghost" onClick={() => void signOut()} title={userEmail}>⎋</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <EntryList
                entries={entries}
                activeId={activeId}
                onSelect={handleSelect}
                query={query}
                onQueryChange={onQueryChange}
                fullWidth
              />
            </div>
          </div>
        </>
      )}

      {focused && <FocusControls settings={settings} update={updateSettings} onExit={focus.exit} />}
    </div>
  )
}
