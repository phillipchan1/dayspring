import type { Marking } from './corpus'

export type Run =
  | { kind: 'plain'; text: string }
  | { kind: 'marked'; text: string; marking: Marking; id: string }

/**
 * Split one paragraph into runs so its markings can be painted where they sit.
 *
 * Overlaps are resolved by taking the earliest, longest marking and skipping
 * anything that collides with it. The skipped marking is NOT dropped — it still
 * appears in the margin. That is the honest resolution: the margin is the
 * complete record, and the body is where the ones that fit are shown.
 */
export function splitParagraph(text: string, markings: Marking[], keyBase: string): Run[] {
  const spans = markings
    .map((m, i) => ({ m, i, at: text.indexOf(m.quote) }))
    .filter((s) => s.at >= 0)
    .sort((a, b) => a.at - b.at || b.m.quote.length - a.m.quote.length)

  const runs: Run[] = []
  let cursor = 0
  for (const s of spans) {
    if (s.at < cursor) continue
    if (s.at > cursor) runs.push({ kind: 'plain', text: text.slice(cursor, s.at) })
    runs.push({ kind: 'marked', text: s.m.quote, marking: s.m, id: `${keyBase}-${s.i}` })
    cursor = s.at + s.m.quote.length
  }
  if (cursor < text.length) runs.push({ kind: 'plain', text: text.slice(cursor) })
  return runs
}

/** The one place a marking becomes ink on the page. */
export function MarkedSpan({
  run,
  active,
  onHover,
}: {
  run: Extract<Run, { kind: 'marked' }>
  active: boolean
  onHover: (id: string | null) => void
}) {
  const { marking } = run
  const props = {
    'data-kind': marking.kind,
    'data-on': active ? 'true' : undefined,
    className: 'ink',
    onMouseEnter: () => onHover(run.id),
    onMouseLeave: () => onHover(null),
  }

  if (marking.kind === 'highlight') {
    return (
      <mark className="hl ink" data-hue={marking.hue} data-on={active ? 'true' : undefined} onMouseEnter={() => onHover(run.id)} onMouseLeave={() => onHover(null)}>
        {run.text}
      </mark>
    )
  }
  if (marking.kind === 'underline') {
    return (
      <span {...props} className="ink ul">
        {run.text}
      </span>
    )
  }
  if (marking.kind === 'mark') {
    return (
      <span {...props} className="ink setapart">
        {run.text}
      </span>
    )
  }
  // Declared kinds — scripture, prayer, sense, story, learned. A faint wash in
  // the kind's own tone, so the margin and the sentence are visibly one thing.
  return (
    <span {...props} className="ink ink--declared">
      {run.text}
    </span>
  )
}
