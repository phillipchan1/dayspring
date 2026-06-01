import { useEffect, useMemo, useState } from 'react'
import { listSpiritualItems } from '@/lib/spiritual'
import type { SpiritualItem } from '@/lib/types'
import './Altar.css'

type Lens = 'all' | 'prayer' | 'sense'

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

function isAltarItem(item: SpiritualItem): item is SpiritualItem & { type: 'prayer' | 'sense' } {
  return item.type === 'prayer' || item.type === 'sense'
}

const LENSES: { id: Lens; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'prayer', label: 'Prayer' },
  { id: 'sense', label: 'Sense' },
]

export function AltarView({ onOpenEntry }: Props) {
  const [items, setItems] = useState<SpiritualItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [lens, setLens] = useState<Lens>('all')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const all = await listSpiritualItems()
        if (cancelled) return
        const altarItems = all.filter(isAltarItem).sort((a, b) => b.created_at.localeCompare(a.created_at))
        setItems(altarItems)
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
    if (!items) return null
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (lens !== 'all' && item.type !== lens) return false
      if (!q) return true
      return item.content.toLowerCase().includes(q)
    })
  }, [items, query, lens])

  const grouped = useMemo(() => {
    if (!filtered) return []
    const map = new Map<string, SpiritualItem[]>()
    for (const item of filtered) {
      const key = monthKey(item.created_at)
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  if (loadError) {
    return <p className="altar__error">{loadError}</p>
  }

  if (items === null) {
    return <div className="altar altar--loading">Loading…</div>
  }

  const empty = items.length === 0
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
              aria-label="Search prayers and senses"
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
              Nothing here yet. Type <code>/pray</code> or <code>/sense</code> in an entry to plant
              a seed.
            </p>
          )}

          {lensEmpty && <p className="altar__quiet">Nothing here under this lens.</p>}

          {grouped.map(([key, monthItems]) => (
            <section key={key} className="altar__month">
              <h2 className="altar__month-label">{monthLabel(key)}</h2>
              <ul className="altar__list">
                {monthItems.map((item) => (
                  <li key={item.id} className="altar__item">
                    <span className="altar__type" data-type={item.type}>
                      {item.type}
                    </span>
                    <p className="altar__content">{item.content}</p>
                    <div className="altar__meta">
                      <time dateTime={item.created_at} className="altar__date">
                        {formatItemDate(item.created_at)}
                      </time>
                      {item.entry_id && (
                        <button
                          type="button"
                          className="altar__open-entry"
                          onClick={() => onOpenEntry(item.entry_id!)}
                        >
                          → open entry
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
