import type { Passage, PassageSource } from '@/lib/remember'

interface Props {
  passages: Passage[]
  onOpenEntry: (entryId: string) => void
}

/**
 * Where each passage came from. Shown as a quiet label rather than a colour —
 * colour would imply a ranking between them, and a prayer is not worth more
 * than a sentence you underlined.
 */
const LABEL: Record<PassageSource, string> = {
  mark: 'Marked',
  quote: 'Set apart',
  emphasis: 'Emphasised',
  pray: 'Prayer',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * The passages, newest first. Verbatim, dated, clickable.
 *
 * No excerpting, no summary line, no relevance order — this is the writer's own
 * text handed back exactly as they left it.
 */
export function PassageList({ passages, onOpenEntry }: Props) {
  return (
    <div className="rem__list">
      {passages.map((p) => (
        <button
          key={`${p.entryId}-${p.source}-${p.text.slice(0, 40)}`}
          type="button"
          className="rem__passage"
          onClick={() => onOpenEntry(p.entryId)}
        >
          <span className="rem__passage-t">{p.text}</span>
          <span className="rem__passage-m">
            <span className="rem__passage-k">{LABEL[p.source]}</span>
            <span className="rem__passage-d">{formatDate(p.date)}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
