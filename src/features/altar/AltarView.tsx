import { useEffect, useMemo, useState } from 'react'
import { listSpiritualItems } from '@/lib/spiritual'
import { listReminders } from '@/lib/reminders'
import type { Reminder } from '@/lib/reminders'
import type { SpiritualItem, SpiritualItemType } from '@/lib/types'
import './Altar.css'

type Lens = 'all' | SpiritualItemType

type AltarRow =
  | { kind: 'spiritual'; item: SpiritualItem }
  | { kind: 'reminder'; item: Reminder }

interface Props {
  onOpenEntry: (entryId: string) => void
}

function formatItemDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function monthKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y!, m! - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

function typeLabel(row: AltarRow): string {
  if (row.kind === 'reminder') return 'reminder'
  switch (row.item.type) {
    case 'prayer':
      return 'prayer'
    case 'sense':
      return 'sense'
    case 'scripture':
      return 'scripture'
  }
}

function rowContent(row: AltarRow): string {
  return row.item.content
}

function rowReference(row: AltarRow): string | null {
  if (row.kind !== 'spiritual' || row.item.type !== 'scripture') return null
  const ref = row.item.metadata?.reference
  return typeof ref === 'string' ? ref : null
}

function rowCreatedAt(row: AltarRow): string {
  return row.item.created_at
}

function rowEntryId(row: AltarRow): string | null {
  return row.item.entry_id
}

const LENSES: { id: Lens; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'prayer', label: 'Prayer' },
  { id: 'sense', label: 'Sense' },
  { id: 'scripture', label: 'Scripture' },
]

export function AltarView({ onOpenEntry }: Props) {
  const [rows, setRows] = useState<AltarRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [lens, setLens] = useState<Lens>('all')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [items, reminders] = await Promise.all([
          listSpiritualItems(),
          listReminders(),
        ])
        if (cancelled) return
        const merged: AltarRow[] = [
          ...items.map((item) => ({ kind: 'spiritual' as const, item })),
          ...reminders.map((item) => ({ kind: 'reminder' as const, item })),
        ].sort((a, b) => rowCreatedAt(b).localeCompare(rowCreatedAt(a)))
        setRows(merged)
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Could not load')
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!rows) return null
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (lens !== 'all') {
        if (row.kind === 'reminder') return false
        if (row.item.type !== lens) return false
      }
      if (!q) return true
      const text = rowContent(row).toLowerCase()
      const ref = rowReference(row)?.toLowerCase() ?? ''
      return text.includes(q) || ref.includes(q)
    })
  }, [rows, query, lens])

  const grouped = useMemo(() => {
    if (!filtered) return []
    const map = new Map<string, AltarRow[]>()
    for (const row of filtered) {
      const key = monthKey(rowCreatedAt(row))
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  if (loadError) {
    return <p className="altar__error">{loadError}</p>
  }

  if (rows === null) {
    return <div className="altar altar--loading">Loading…</div>
  }

  const empty = rows.length === 0
  const lensEmpty = !empty && filtered!.length === 0

  return (
    <div className="altar">
      <div className="altar__bg" aria-hidden />
      <div className="altar__scroll">
        <div className="altar__column">
          <header className="altar__header">
            <h1 className="altar__title">Altar</h1>
            <p className="altar__subtitle">Seeds planted in time</p>
          </header>

          <div className="altar__toolbar">
            <input
              type="search"
              className="altar__search"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search spiritual items"
            />
            <div className="altar__lenses" role="group" aria-label="Filter by type">
              {LENSES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className="altar__lens"
                  data-active={lens === l.id ? 'true' : undefined}
                  onClick={() => setLens(l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {empty && (
            <p className="altar__quiet">
              Nothing here yet. Type <code>/pray</code>, <code>/sense</code>, or{' '}
              <code>/scripture</code> in an entry to plant a seed.
            </p>
          )}

          {lensEmpty && (
            <p className="altar__quiet">Nothing here under this lens.</p>
          )}

          {grouped.map(([key, monthRows]) => (
            <section key={key} className="altar__month">
              <h2 className="altar__month-label">{monthLabel(key)}</h2>
              <ul className="altar__list">
                {monthRows.map((row) => {
                  const id = row.kind === 'spiritual' ? row.item.id : row.item.id
                  const label = typeLabel(row)
                  const entryId = rowEntryId(row)
                  const isScripture =
                    row.kind === 'spiritual' && row.item.type === 'scripture'
                  return (
                    <li
                      key={`${row.kind}-${id}`}
                      className={`altar__item${isScripture ? ' altar__item--scripture' : ''}`}
                    >
                      {!isScripture && (
                        <span className="altar__type" data-type={label}>
                          {label}
                        </span>
                      )}
                      <p className="altar__content">{rowContent(row)}</p>
                      {rowReference(row) && (
                        <p className="altar__reference">{rowReference(row)}</p>
                      )}
                      <div className="altar__meta">
                        <time dateTime={rowCreatedAt(row)} className="altar__date">
                          {formatItemDate(rowCreatedAt(row))}
                        </time>
                        {entryId && (
                          <button
                            type="button"
                            className="altar__open-entry"
                            onClick={() => onOpenEntry(entryId)}
                          >
                            → open entry
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
