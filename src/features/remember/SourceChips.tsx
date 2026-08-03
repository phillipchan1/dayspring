import type { Passage, PassageSource } from '@/lib/remember'

interface Props {
  passages: Passage[]
  active: PassageSource | null
  onPick: (source: PassageSource | null) => void
}

const ORDER: { key: PassageSource; label: string }[] = [
  { key: 'mark', label: 'Marked' },
  { key: 'quote', label: 'Set apart' },
  { key: 'emphasis', label: 'Emphasised' },
  { key: 'pray', label: 'Prayers' },
]

/**
 * Filter by where a passage came from.
 *
 * A source with nothing in it is hidden rather than shown disabled — an empty
 * chip is a to-do ("you should mark something"), and Remember is a place you go
 * to see, never to work.
 */
export function SourceChips({ passages, active, onPick }: Props) {
  const counts = new Map<PassageSource, number>()
  for (const p of passages) counts.set(p.source, (counts.get(p.source) ?? 0) + 1)

  const present = ORDER.filter((o) => (counts.get(o.key) ?? 0) > 0)
  // One source and nothing to choose between — the chips would be furniture.
  if (present.length < 2) return null

  return (
    <div className="rem__chips" role="group" aria-label="Filter by source">
      <button
        type="button"
        className="rem__chip"
        data-on={active === null ? 'true' : undefined}
        aria-pressed={active === null}
        onClick={() => onPick(null)}
      >
        All <span className="rem__chip-n">{passages.length}</span>
      </button>
      {present.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className="rem__chip"
          data-on={active === key ? 'true' : undefined}
          aria-pressed={active === key}
          onClick={() => onPick(active === key ? null : key)}
        >
          {label} <span className="rem__chip-n">{counts.get(key)}</span>
        </button>
      ))}
    </div>
  )
}
