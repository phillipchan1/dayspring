import type { Entry } from '@/lib/types'
import { deriveTitle } from './deriveTitle'
import { matchSnippet } from './search'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface Props {
  entries: Entry[]
  activeId: string | null
  onSelect: (entry: Entry) => void
  query: string
  onQueryChange: (q: string) => void
  /** Fill the parent width (used inside the mobile drawer). */
  fullWidth?: boolean
}

export function EntryList({ entries, activeId, onSelect, query, onQueryChange, fullWidth = false }: Props) {
  return (
    <aside
      style={{
        width: fullWidth ? '100%' : '17rem',
        flexShrink: 0,
        borderRight: fullWidth ? 'none' : '1px solid var(--border-subtle)',
        background: 'var(--bg-elevated)',
        overflowY: 'auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: '0.7rem 0.75rem 0.5rem', position: 'sticky', top: 0, background: 'var(--bg-elevated)' }}>
        <input
          data-entry-search
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search entries…"
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
        <p style={{ padding: '0 0.75rem', color: 'var(--text-faint)', fontSize: '0.85rem' }}>
          {query.trim() ? 'No matches.' : 'Nothing yet. Start writing →'}
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {entries.map((entry) => {
            const active = entry.id === activeId
            const title = deriveTitle(entry.body_markdown) || 'Untitled'
            const snippet = matchSnippet(entry.body_markdown, query)
            return (
              <li key={entry.id}>
                <button
                  onClick={() => onSelect(entry)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.7rem 0.75rem',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    border: 'none',
                    borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                    color: active ? 'var(--text-bright)' : 'var(--text)',
                  }}
                >
                  <div
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontSize: '0.9rem',
                    }}
                  >
                    {title}
                  </div>
                  {snippet ? (
                    <div
                      style={{
                        color: 'var(--text-dim)',
                        fontSize: '0.75rem',
                        marginTop: '0.2rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {snippet}
                    </div>
                  ) : null}
                  <div
                    style={{
                      color: 'var(--text-faint)',
                      fontSize: '0.72rem',
                      fontFamily: 'var(--font-mono)',
                      marginTop: '0.15rem',
                    }}
                  >
                    {formatDate(entry.created_at)} · {entry.word_count} w
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}
