import { useEffect, useState } from 'react'
import type { SaveStatus } from '@/hooks/useAutosave'

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return `${h}h ago`
}

interface Props {
  status: SaveStatus
  lastSavedAt: number | null
  error: string | null
}

export function SaveStatusBadge({ status, lastSavedAt, error }: Props) {
  // Re-render periodically so "saved 30s ago" stays accurate.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 10_000)
    return () => clearInterval(id)
  }, [])

  let label: string
  let color = 'var(--text-faint)'
  switch (status) {
    case 'saving':
      label = 'Saving…'
      break
    case 'error':
      label = error ? `Save failed` : 'Save failed'
      color = 'var(--danger)'
      break
    case 'saved':
      label = lastSavedAt ? `Saved ${timeAgo(lastSavedAt)}` : 'Saved'
      color = 'var(--success)'
      break
    default:
      label = lastSavedAt ? `Saved ${timeAgo(lastSavedAt)}` : 'Not saved yet'
  }

  return (
    <span
      title={error ?? undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        color,
        fontSize: '0.75rem',
        fontFamily: 'var(--font-mono)',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'currentColor',
          opacity: status === 'saving' ? 0.5 : 1,
        }}
      />
      {label}
    </span>
  )
}
