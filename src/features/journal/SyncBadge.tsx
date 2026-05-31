import { useSyncExternalStore } from 'react'
import { syncStore } from '@/lib/sync'

/** Subtle connectivity / queue indicator: Offline · N, Syncing N, or Synced. */
export function SyncBadge() {
  const state = useSyncExternalStore(syncStore.subscribe, syncStore.get)

  let label: string
  let color = 'var(--text-faint)'
  if (!state.online) {
    label = state.pending > 0 ? `Offline · ${state.pending}` : 'Offline'
    color = 'var(--md-strong)' // amber-ish
  } else if (state.pending > 0) {
    label = `Syncing ${state.pending}`
    color = 'var(--text-dim)'
  } else {
    label = 'Synced'
  }

  return (
    <span
      title={state.online ? 'Connected' : 'Changes are saved locally and will sync when you reconnect'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        color,
        fontSize: '0.72rem',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      {label}
    </span>
  )
}
