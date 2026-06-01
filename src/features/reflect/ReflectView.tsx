import { useEffect, useState } from 'react'
import { listSpiritualItems, markPrayerAnswered, unmarkPrayerAnswered } from '@/lib/spiritual'
import type { PrayerType, SpiritualItem } from '@/lib/types'

type Tab = 'prayer' | 'words'

const PRAYER_TYPE_LABELS: Record<PrayerType, string> = {
  intercession: 'Intercession',
  gratitude: 'Gratitude',
  petition: 'Petition',
  praise: 'Praise',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function prayerType(item: SpiritualItem): PrayerType | null {
  return (item.metadata?.prayer_type as PrayerType) ?? null
}

export function ReflectView() {
  const [tab, setTab] = useState<Tab>('prayer')
  const [prayers, setPrayers] = useState<SpiritualItem[] | null>(null)
  const [words, setWords] = useState<SpiritualItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [p, w] = await Promise.all([
          listSpiritualItems('prayer'),
          listSpiritualItems('sense'),
        ])
        if (!cancelled) {
          setPrayers(p)
          setWords(w)
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load')
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  async function toggleAnswered(item: SpiritualItem) {
    if (toggling.has(item.id)) return
    setToggling((s) => new Set(s).add(item.id))
    try {
      if (item.resolved_at) {
        await unmarkPrayerAnswered(item.id)
        setPrayers((prev) =>
          prev?.map((p) => (p.id === item.id ? { ...p, resolved_at: null } : p)) ?? null,
        )
      } else {
        await markPrayerAnswered(item.id)
        const resolvedAt = new Date().toISOString()
        setPrayers((prev) =>
          prev?.map((p) => (p.id === item.id ? { ...p, resolved_at: resolvedAt } : p)) ?? null,
        )
      }
    } catch {
      // silently fail; the UI will show stale state until refresh
    } finally {
      setToggling((s) => {
        const n = new Set(s)
        n.delete(item.id)
        return n
      })
    }
  }

  if (loadError) {
    return <p className="reflect-view__error">{loadError}</p>
  }

  return (
    <div className="reflect-view">
      <nav className="reflect-view__tabs" aria-label="Reflect sections">
        <button
          className="reflect-view__tab"
          data-active={tab === 'prayer' ? 'true' : undefined}
          onClick={() => setTab('prayer')}
        >
          Prayer
        </button>
        <button
          className="reflect-view__tab"
          data-active={tab === 'words' ? 'true' : undefined}
          onClick={() => setTab('words')}
        >
          Words
        </button>
      </nav>

      {tab === 'prayer' && (
        <PrayerList
          items={prayers}
          onToggleAnswered={toggleAnswered}
          toggling={toggling}
        />
      )}

      {tab === 'words' && <WordsList items={words} />}
    </div>
  )
}

function PrayerList({
  items,
  onToggleAnswered,
  toggling,
}: {
  items: SpiritualItem[] | null
  onToggleAnswered: (item: SpiritualItem) => void
  toggling: Set<string>
}) {
  if (items === null) {
    return <div className="reflect-view__loading">Loading…</div>
  }

  if (items.length === 0) {
    return (
      <div className="reflect-view__empty">
        <p className="reflect-view__empty-title">Your prayers will appear here.</p>
        <p className="reflect-view__empty-hint">
          Type <code>/pray</code> anywhere in a journal entry to log one.
        </p>
      </div>
    )
  }

  const active = items.filter((i) => !i.resolved_at)
  const answered = items.filter((i) => i.resolved_at)

  return (
    <div className="prayer-list">
      {active.map((item) => (
        <PrayerItem key={item.id} item={item} onToggle={onToggleAnswered} toggling={toggling} />
      ))}

      {answered.length > 0 && (
        <details className="prayer-answered">
          <summary className="prayer-answered__label">
            Answered ({answered.length})
          </summary>
          <div className="prayer-answered__list">
            {answered.map((item) => (
              <PrayerItem key={item.id} item={item} onToggle={onToggleAnswered} toggling={toggling} answered />
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

function PrayerItem({
  item,
  onToggle,
  toggling,
  answered = false,
}: {
  item: SpiritualItem
  onToggle: (item: SpiritualItem) => void
  toggling: Set<string>
  answered?: boolean
}) {
  const type = prayerType(item)
  return (
    <div className="prayer-item" data-answered={answered ? 'true' : undefined}>
      <div className="prayer-item__main">
        {type && (
          <span className="prayer-type-badge" data-type={type}>
            {PRAYER_TYPE_LABELS[type]}
          </span>
        )}
        <p className="prayer-item__content">{item.content}</p>
        <time className="prayer-item__date" dateTime={item.created_at}>
          {formatDate(item.created_at)}
        </time>
      </div>
      <button
        className="prayer-item__answered-btn"
        title={item.resolved_at ? 'Mark unanswered' : 'Mark answered'}
        disabled={toggling.has(item.id)}
        onClick={() => onToggle(item)}
        aria-label={item.resolved_at ? 'Mark unanswered' : 'Mark answered'}
      >
        {item.resolved_at ? '✓' : '○'}
      </button>
    </div>
  )
}

function WordsList({ items }: { items: SpiritualItem[] | null }) {
  if (items === null) {
    return <div className="reflect-view__loading">Loading…</div>
  }

  if (items.length === 0) {
    return (
      <div className="reflect-view__empty">
        <p className="reflect-view__empty-title">Your impressions will appear here.</p>
        <p className="reflect-view__empty-hint">
          Type <code>/sense</code> in an entry to record a word from God.
        </p>
      </div>
    )
  }

  return (
    <div className="words-list">
      {items.map((item) => (
        <div key={item.id} className="word-item">
          <p className="word-item__text">"{item.content}"</p>
          <time className="word-item__date" dateTime={item.created_at}>
            {formatDate(item.created_at)}
          </time>
        </div>
      ))}
    </div>
  )
}
