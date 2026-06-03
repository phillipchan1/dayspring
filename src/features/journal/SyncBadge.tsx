import { useSyncExternalStore } from 'react'
import { syncStore } from '@/lib/sync'

interface Props {
  /** Render as plain inline text (no dot, inherits size/font) for the unified
   *  status cluster. States/labels are unchanged. */
  bare?: boolean
  /** When provided, tapping/clicking the badge triggers a manual re-sync. */
  onSync?: () => void
}

/** Subtle connectivity / queue indicator: Offline · N, Syncing N, or Synced. */
export function SyncBadge({ bare = false, onSync }: Props = {}) {
  const state = useSyncExternalStore(syncStore.subscribe, syncStore.get)

  let label: string
  let color = 'var(--text-faint)'
  if (!state.online) {
    label = state.pending > 0 ? `Offline · ${state.pending}` : 'Offline'
    color = 'var(--md-strong)' // amber-ish
  } else if (state.pulling) {
    label = 'Updating library'
    color = 'var(--text-dim)'
  } else if (state.pending > 0) {
    label = `Syncing ${state.pending}`
    color = 'var(--text-dim)'
  } else {
    label = 'Synced'
  }

  const title = state.online
    ? (onSync ? 'Click to sync now' : 'Connected')
    : 'Changes are saved locally and will sync when you reconnect'

  if (bare) {
    // Offline stays amber (it matters); everything else inherits the cluster's
    // quiet tone. The cluster supplies the dot.
    return onSync ? (
      <button
        type="button"
        onClick={onSync}
        title={title}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: state.online ? 'inherit' : color,
          font: 'inherit',
        }}
      >
        {label}
      </button>
    ) : (
      <span title={title} style={{ color: state.online ? 'inherit' : color }}>
        {label}
      </span>
    )
  }

  return (
    <span
      title={title}
      onClick={onSync}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        color,
        fontSize: '0.72rem',
        fontFamily: 'var(--font-mono)',
        cursor: onSync ? 'pointer' : undefined,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
      {label}
    </span>
  )
}
