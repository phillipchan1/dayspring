import { LEDGER_COPY, MONTH_LONG, MONTH_SHORT, KIND_COPY } from './copy'
import type { LedgerLine, LedgerThread } from './build'

/** Lines a passage shows. Enough to read as a story, few enough to read slowly. */
const SHOWN = 6

export type PassageItem =
  | { type: 'line'; line: LedgerLine }
  | { type: 'quiet'; from: string; to: string }

/**
 * Which lines tell the thread: always its first and its latest, then the ones
 * the writer MARKED (a prayer, something sensed or learned) before plain ones,
 * laid back in the order they were written. Between two shown lines, a run of
 * two or more months with nothing written becomes a quiet note — the silence is
 * part of the story, and it's a fact about dates, not a meaning.
 */
export function passageItems(thread: LedgerThread, months: string[], shown = SHOWN): PassageItem[] {
  const lines = thread.lines
  if (lines.length === 0) return []
  const pick = new Set<number>([0, lines.length - 1])
  const byWeight = lines
    .map((l, i) => ({ i, w: l.kind === 'story' ? 0 : 1 }))
    .filter((x) => !pick.has(x.i))
    .sort((a, b) => b.w - a.w || a.i - b.i)
  for (const x of byWeight) {
    if (pick.size >= shown) break
    pick.add(x.i)
  }
  const chosen = [...pick].sort((a, b) => a - b).map((i) => lines[i]!)
  const out: PassageItem[] = []
  for (let i = 0; i < chosen.length; i++) {
    const l = chosen[i]!
    const prev = chosen[i - 1]
    if (prev) {
      const a = months.indexOf(prev.date.slice(0, 7))
      const b = months.indexOf(l.date.slice(0, 7))
      if (a >= 0 && b > a + 2 && thread.perMonth.slice(a + 1, b).every((c) => c === 0)) {
        out.push({ type: 'quiet', from: months[a + 1]!, to: months[b - 1]! })
      }
    }
    out.push({ type: 'line', line: l })
  }
  return out
}

/** "still going" when it was written in the last month; otherwise when it rested. */
export function threadStatus(thread: LedgerThread, today: string): { going: boolean; last: string | null } {
  const last = thread.lines[thread.lines.length - 1]?.date ?? null
  if (!last) return { going: false, last: null }
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86_400_000
  return { going: days <= 31, last }
}

export function fmtDay(date: string): string {
  return `${MONTH_SHORT[+date.slice(5, 7) - 1]} ${+date.slice(8, 10)}`
}
function monthName(ym: string): string {
  return MONTH_LONG[+ym.slice(5, 7) - 1]!
}

interface Props {
  thread: LedgerThread
  months: string[]
  today: string
  /** Is the span still running? Only then can something be "still going". */
  open: boolean
  onOpenEntry?: ((entryId: string) => void) | undefined
  onWrite: (thread: LedgerThread, lines: LedgerLine[]) => void
}

/**
 * A THREAD, TOLD BACK — a short passage of the writer's own lines, in order,
 * with the quiet stretches left as white space. No dots, no counts, no
 * "turned", no "answered": dates, their words, and the markings they made.
 */
export function Passage({ thread, months, today, open, onOpenEntry, onWrite }: Props) {
  const items = passageItems(thread, months)
  const status = threadStatus(thread, today)
  const first = thread.lines[0]?.date
  const going = open && status.going
  const shownLines = items.flatMap((x) => (x.type === 'line' ? [x.line] : []))

  return (
    <article className="story">
      <header className="story__head">
        <h3 className="story__name">{thread.label}</h3>
        <div className="story__kind">{LEDGER_COPY.kind[thread.kind]}</div>
        {first && status.last ? (
          <div className="story__span">
            {monthName(first.slice(0, 7))}
            {first.slice(0, 7) !== status.last.slice(0, 7) ? ` – ${monthName(status.last.slice(0, 7))}` : ''}
          </div>
        ) : null}
        <div className={`story__status${going ? ' is-going' : ''}`}>
          <i aria-hidden />
          {going ? LEDGER_COPY.stillGoing : status.last ? LEDGER_COPY.lastWritten(monthName(status.last.slice(0, 7))) : ''}
        </div>
      </header>
      <div className="story__body">
        <ol className="story__lines">
          {items.map((it, i) =>
            it.type === 'quiet' ? (
              <li key={`q${i}`} className="story__quiet">
                {LEDGER_COPY.quietSpan(MONTH_SHORT[+it.from.slice(5, 7) - 1]!, MONTH_SHORT[+it.to.slice(5, 7) - 1]!)}
              </li>
            ) : (
              <li key={`${it.line.entryId}${i}`}>
                <button type="button" className="story__line" onClick={() => onOpenEntry?.(it.line.entryId)}>
                  <span className="story__when">{fmtDay(it.line.date)}</span>
                  <span className="story__knot" aria-hidden />
                  <span className="story__text">{it.line.text}</span>
                  {it.line.kind !== 'story' || it.line.refs.length > 0 ? (
                    <span className="story__meta">
                      {it.line.kind !== 'story' ? <span>{KIND_COPY[it.line.kind]}</span> : null}
                      {it.line.refs.slice(0, 2).map((r) => (
                        <span key={r}>{r}</span>
                      ))}
                    </span>
                  ) : null}
                  <span className="story__open">{LEDGER_COPY.openPage}</span>
                </button>
              </li>
            ),
          )}
          <li className={`story__tail${going ? '' : ' is-rest'}`}>
            {going && status.last
              ? LEDGER_COPY.stillBeingWritten(fmtDay(status.last))
              : status.last
                ? LEDGER_COPY.quietSince(fmtDay(status.last))
                : ''}
          </li>
        </ol>
        <div className="story__cta">
          <button type="button" className="story__write" onClick={() => onWrite(thread, shownLines)}>
            {LEDGER_COPY.writeAbout}
          </button>
          <small>{LEDGER_COPY.writeHint}</small>
        </div>
      </div>
    </article>
  )
}
