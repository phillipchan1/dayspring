import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { THEMES, type ThemeId } from '@/lib/resolveTheme'
import { syncStore } from '@/lib/sync'
import { StatusCluster } from './StatusCluster'
import { IconRitual } from './navIcons'
import type { SaveStatus } from '@/hooks/useAutosave'

/**
 * Dev-only: `?__preview=topbar` renders the journal top bar's two reworked
 * pieces — the Ritual door and the status cluster — across every state at once,
 * which the real app can only show one at a time (and only when it happens to
 * be offline). Optional `&theme=vellum` etc.
 *
 * The markup here mirrors what `MobileJournal` / `DesktopJournal` render; the
 * StatusCluster is the real component.
 */

const SAVE_STATES: { label: string; status: SaveStatus; lastSavedAt: number | null; error: string | null }[] = [
  { label: 'saved', status: 'saved', lastSavedAt: Date.now() - 120_000, error: null },
  { label: 'saving', status: 'saving', lastSavedAt: Date.now() - 120_000, error: null },
  { label: 'never saved', status: 'idle', lastSavedAt: null, error: null },
  { label: 'save failed', status: 'error', lastSavedAt: Date.now() - 120_000, error: 'Disk full' },
]

const SYNC_STATES: { label: string; apply: () => void }[] = [
  { label: 'synced', apply: () => { syncStore.setOnline(true); syncStore.setQueue({ pending: 0, blocked: 0 }) } },
  { label: 'syncing 3', apply: () => { syncStore.setOnline(true); syncStore.setQueue({ pending: 3, blocked: 0 }) } },
  { label: 'offline', apply: () => { syncStore.setQueue({ pending: 2, blocked: 0 }); syncStore.setOnline(false) } },
  { label: "3 didn't sync", apply: () => { syncStore.setOnline(true); syncStore.setQueue({ pending: 0, blocked: 3 }) } },
]

function isThemeId(value: string | null): value is ThemeId {
  return THEMES.some((t) => t.id === value)
}

function Preview() {
  const [sync, setSync] = useState(0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '2rem 1.5rem 6rem' }}>
      <div style={{ maxWidth: '52rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            The door — blank page only
          </p>
          <header className="journal-topbar" style={{ marginTop: '0.6rem' }}>
            <div className="journal-topbar__lead">
              <span className="journal-topbar__label">New entry</span>
              <button type="button" className="journal-topbar__ritual" title="Practices for the inner life">
                <IconRitual />
                Ritual
              </button>
            </div>
            <div className="journal-topbar__actions">
              <StatusCluster
                status="saved"
                lastSavedAt={Date.now() - 120_000}
                saveError={null}
                onSync={() => {}}
                leading={<span>128 words</span>}
              />
            </div>
          </header>
        </div>

        <div>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>
            Status — every save state, at sync: {SYNC_STATES[sync]!.label}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', margin: '0.6rem 0 1rem', flexWrap: 'wrap' }}>
            {SYNC_STATES.map((s, i) => (
              <button
                key={s.label}
                type="button"
                className="nav-btn"
                onClick={() => { s.apply(); setSync(i) }}
                style={{ opacity: i === sync ? 1 : 0.5 }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {SAVE_STATES.map((s) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '1.2rem' }}>
                <span style={{ width: '7rem', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-faint)' }}>
                  {s.label}
                </span>
                <StatusCluster
                  status={s.status}
                  lastSavedAt={s.lastSavedAt}
                  saveError={s.error}
                  onSync={() => {}}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function renderTopbarPreview(): void {
  const wanted = new URLSearchParams(window.location.search).get('theme')
  const theme: ThemeId = isThemeId(wanted) ? wanted : 'compline'
  const family = THEMES.find((t) => t.id === theme)?.family ?? 'dark'
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-appearance', family)
  root.style.colorScheme = family

  const el = document.getElementById('root')
  if (!el) throw new Error('Root element #root not found')
  createRoot(el).render(<Preview />)
}
