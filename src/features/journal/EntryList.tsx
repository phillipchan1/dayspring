import { useCallback, useState } from 'react'
import type { Entry } from '@/lib/types'
import { Brand } from '@/components/Mark'
import { isTauri, MAC_TRAFFIC_INSET } from '@/lib/platform'
import { deriveTitle } from './deriveTitle'
import { matchSnippet } from './search'
import {
  EntryContextMenu,
  type EntryMenuAction,
  type EntryMenuPhase,
} from './EntryContextMenu'
import { useSuppressNativeContextMenu } from './useSuppressNativeContextMenu'

// Native macOS overlay title bar: the traffic lights float over the top of the
// sidebar, so drop the brand/search down to clear them. Not needed inside the
// mobile drawer (fullWidth) or on the web.
const NATIVE = isTauri()

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface Props {
  entries: Entry[]
  activeId: string | null
  onSelect: (entry: Entry) => void
  onMenuAction: (action: EntryMenuAction, entry: Entry) => void
  query: string
  onQueryChange: (q: string) => void
  /** Fill the parent width (used inside the mobile drawer). */
  fullWidth?: boolean
}

export function EntryList({
  entries,
  activeId,
  onSelect,
  onMenuAction,
  query,
  onQueryChange,
  fullWidth = false,
}: Props) {
  const [phase, setPhase] = useState<EntryMenuPhase>({ kind: 'closed' })
  const closeMenu = useCallback(() => setPhase({ kind: 'closed' }), [])
  const menuTargetId = phase.kind === 'closed' ? null : phase.entry.id

  useSuppressNativeContextMenu(phase.kind !== 'closed', closeMenu)

  function openMenu(entry: Entry, x: number, y: number) {
    setPhase({ kind: 'menu', entry, x, y })
  }

  function handleMenuAction(action: EntryMenuAction, entry: Entry) {
    onMenuAction(action, entry)
    closeMenu()
  }

  function blockNativeMenu(e: React.MouseEvent) {
    e.preventDefault()
  }

  return (
    <aside
      className="entry-list"
      style={{
        width: '100%',
        flexShrink: 0,
        borderRight: fullWidth ? 'none' : '1px solid var(--border-subtle)',
        background: 'var(--bg-elevated)',
        overflowY: 'auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      onContextMenu={blockNativeMenu}
    >
      <div
        className={!fullWidth ? 'entry-list__head' : undefined}
        style={{
          padding: NATIVE && !fullWidth
            ? `${MAC_TRAFFIC_INSET.sidebarTop} ${MAC_TRAFFIC_INSET.sidebarX} 0.5rem`
            : '0.7rem 0.75rem 0.5rem',
          position: 'sticky',
          top: 0,
          background: 'var(--bg-elevated)',
        }}
        onContextMenu={blockNativeMenu}
      >
        {!fullWidth && (
          <Brand showMark={false} wordmarkRem={1.1} style={{ padding: '0.15rem 0.1rem 0.7rem' }} />
        )}
        <input
          data-entry-search
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search entries…"
          onContextMenu={blockNativeMenu}
          style={{
            width: '100%',
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text-bright)',
            padding: '0.45rem 0.6rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.82rem',
          }}
        />
        <div
          style={{
            color: 'var(--text-dim)',
            fontSize: '0.68rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontFamily: 'var(--font-mono)',
            marginTop: '0.6rem',
          }}
        >
          {query.trim() ? `${entries.length} match${entries.length === 1 ? '' : 'es'}` : `Entries · ${entries.length}`}
        </div>
      </div>

      {entries.length === 0 ? (
        <p
          style={{ padding: '0 0.75rem', color: 'var(--text-faint)', fontSize: '0.85rem' }}
          onContextMenu={blockNativeMenu}
        >
          {query.trim() ? 'No matches.' : 'Nothing yet. Start writing →'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} onContextMenu={blockNativeMenu}>
          {entries.map((entry) => {
            const active = entry.id === activeId
            const context = entry.id === menuTargetId
            const title = deriveTitle(entry.body_markdown) || 'Untitled'
            const snippet = matchSnippet(entry.body_markdown, query)
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className="entry-row"
                  data-entry-row
                  data-active={active ? 'true' : undefined}
                  data-context={context ? 'true' : undefined}
                  onClick={() => onSelect(entry)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    openMenu(entry, e.clientX, e.clientY)
                  }}
                >
                  <span className="entry-row__title">{title}</span>
                  {snippet ? <span className="entry-row__snippet">{snippet}</span> : null}
                  <span className="entry-row__meta">
                    {formatDate(entry.created_at)} · {entry.word_count} w
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <EntryContextMenu
        phase={phase}
        onClose={closeMenu}
        onAction={handleMenuAction}
        onRequestDelete={(entry) => setPhase({ kind: 'confirm', entry })}
      />
    </aside>
  )
}
