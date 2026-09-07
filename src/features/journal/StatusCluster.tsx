import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { syncStore } from '@/lib/sync'
import { statusLine } from './statusLine'
import type { SaveStatus } from '@/hooks/useAutosave'

interface Props {
  status: SaveStatus
  lastSavedAt: number | null
  saveError: string | null
  /** Tapping the cluster syncs now. */
  onSync?: () => void
  /** Desktop puts the word count in the same cluster, ahead of the status. */
  leading?: ReactNode
}

/**
 * The dot and one word.
 *
 * This replaced a permanent "Saved 2m ago · Synced", which spent a running line
 * of the top bar on two facts that are almost always fine — and on a phone
 * crowded out the one control we want found. The ladder in `statusLine.ts`
 * decides what it says; everything it no longer says is one hover away.
 *
 * The whole cluster is the sync control now. It used to be the word "Synced"
 * itself, which is exactly the word that goes away when nothing is wrong.
 */
export function StatusCluster({ status, lastSavedAt, saveError, onSync, leading }: Props) {
  const sync = useSyncExternalStore(syncStore.subscribe, syncStore.get)
  // Only the hover detail carries a timestamp now, so this ticks at half the
  // rate the old visible "saved 30s ago" needed.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const line = statusLine({ save: status, lastSavedAt, saveError, sync })

  const body = (
    <>
      <span
        className="status-cluster__dot"
        data-tone={line.tone}
        data-busy={line.busy ? 'true' : undefined}
        aria-hidden
      />
      {leading}
      {leading ? (
        <span className="status-cluster__sep" aria-hidden>
          ·
        </span>
      ) : null}
      <span>{line.label}</span>
    </>
  )

  // `title` carries the full picture on hover; `aria-label` carries it to a
  // screen reader, which would otherwise get only the one collapsed word.
  return onSync ? (
    <button
      type="button"
      className="status-cluster status-cluster--action"
      onClick={onSync}
      title={`${line.detail} — click to sync now`}
      aria-label={`${line.detail}. Sync now.`}
    >
      {body}
    </button>
  ) : (
    <span className="status-cluster" title={line.detail} aria-label={line.detail}>
      {body}
    </span>
  )
}
