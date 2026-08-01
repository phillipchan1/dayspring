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
  let title: string
  if (!state.online) {
    label = state.pending > 0 ? `Offline · ${state.pending}` : 'Offline'
    color = 'var(--md-strong)' // amber-ish
    title = 'Changes are saved locally and will sync when you reconnect'
  } else if (state.blocked > 0) {
    // The server refused these and the flush stopped retrying. They are still on
    // this device, so say that rather than the reassuring lie of "Synced".
    label = `${state.blocked} didn't sync`
    color = 'var(--md-strong)'
    title = onSync
      ? "Some changes couldn't be saved to the cloud. They're safe on this device — click to try again."
      : "Some changes couldn't be saved to the cloud. They're safe on this device."
  } else if (state.pulling) {
    label = 'Updating library'
    color = 'var(--text-dim)'
    title = 'Connected'
  } else if (state.pending > 0) {
    label = `Syncing ${state.pending}`
    color = 'var(--text-dim)'
    title = onSync ? 'Click to sync now' : 'Connected'
  } else {
    label = 'Synced'
    title = onSync ? 'Click to sync now' : 'Connected'
  }

  const quiet = state.online && state.blocked === 0

  if (bare) {
    // Offline and unsynced changes stay amber (they matter); everything else
    // inherits the cluster's quiet tone. The cluster supplies the dot.
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
          color: quiet ? 'inherit' : color,
          font: 'inherit',
        }}
      >
        {label}
      </button>
    ) : (
      <span title={title} style={{ color: quiet ? 'inherit' : color }}>
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
