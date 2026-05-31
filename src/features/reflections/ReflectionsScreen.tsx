import { useEffect, useMemo, useState } from 'react'
import { listRollups, type Rollup } from '@/lib/insights'
import { MonthlyRollup } from './MonthlyRollup'

interface Props {
  onBack: () => void
  onOpenEntry: (entryId: string) => void
  onFilterEntries: (entryIds: string[]) => void
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rollups: Rollup[] }

/**
 * Supabase throws a PostgrestError (a plain object, not an Error), so surface its
 * real message/code. A missing table (42P01 / PGRST205) means the insights
 * migration hasn't been applied yet.
 */
function describeLoadError(e: unknown): string {
  const pg = e as { message?: string; code?: string } | null
  const msg = pg?.message ?? (e instanceof Error ? e.message : '') ?? ''
  const missingTable =
    pg?.code === '42P01' || pg?.code === 'PGRST205' || /insights|does not exist|schema cache/i.test(msg)
  if (missingTable) {
    return "The insights table doesn't exist yet — run supabase/schema.sql (or supabase/migrations/20260530120000_insights.sql) in the Supabase SQL editor, then reload."
  }
  return msg || 'Failed to load'
}

function monthLabel(start: string): string {
  return new Date(`${start}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function ReflectionsScreen({ onBack, onOpenEntry, onFilterEntries }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rollups = await listRollups('monthly')
        if (cancelled) return
        setState({ kind: 'ready', rollups })
        setSelected(rollups[0]?.period_start ?? null)
      } catch (e) {
        if (!cancelled) setState({ kind: 'error', message: describeLoadError(e) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const active = useMemo(() => {
    if (state.kind !== 'ready') return null
    return state.rollups.find((r) => r.period_start === selected) ?? state.rollups[0] ?? null
  }, [state, selected])

  return (
    <div className="reflections">
      <header className="reflections__bar">
        <button className="btn btn--ghost" onClick={onBack}>
          ← Writing
        </button>
        {state.kind === 'ready' && state.rollups.length > 0 && (
          <select
            className="reflections__period"
            value={active?.period_start ?? ''}
            onChange={(e) => setSelected(e.target.value)}
          >
            {state.rollups.map((r) => (
              <option key={r.id} value={r.period_start}>
                {monthLabel(r.period_start)}
              </option>
            ))}
          </select>
        )}
      </header>

      <div className="reflections__body">
        {state.kind === 'loading' && (
          <div className="reflections-canvas__content reflections-canvas__content--padded">
            <RollupSkeleton />
          </div>
        )}

        {state.kind === 'error' && (
          <div className="reflections__notice reflections-canvas__content--padded">
            <p style={{ color: 'var(--danger)' }}>Couldn't load your reflections.</p>
            <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{state.message}</p>
          </div>
        )}

        {state.kind === 'ready' && !active && (
          <div className="reflections__notice reflections-canvas__content--padded">
            <h1 className="reflections__empty-title">Your first monthly reflection</h1>
            <p style={{ color: 'var(--text-dim)' }}>
              It unlocks after a few weeks of writing — keep going.
            </p>
          </div>
        )}

        {active && (
          <div className="reflections-canvas">
            <div className="reflections-glow" aria-hidden />
            <div className="reflections-canvas__content">
              <MonthlyRollup
                payload={active.payload}
                onOpenEntry={onOpenEntry}
                onFilterEntries={onFilterEntries}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RollupSkeleton() {
  return (
    <div className="rollup" aria-hidden="true">
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--block" />
      <div className="skeleton skeleton--block" />
    </div>
  )
}
