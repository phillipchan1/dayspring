import { ALLOWS_INTERNAL_UI } from '@/lib/releaseChannel'
import { LEDGER_COPY, KIND_COPY, MONTH_LONG, MONTH_SHORT } from './copy'
import type { LedgerLine, LedgerThread } from './build'

interface Props {
  thread: LedgerThread
  throughMonth: number
  labels: Map<string, string>
  onOpenThread: (id: string) => void
  onOpenEntry?: ((entryId: string) => void) | undefined
  onClose: () => void
}

/** Lines shown per month before "more that month". */
const PER_MONTH = 3

export interface Step {
  word: string
  kind: LedgerLine['kind'] | 'ask' | 'answered'
  month: number
}

/**
 * How it moved: the order of the writer's own markings on the thread, story
 * left out, repeats folded. "asked → sensed → prayed → answered" is read off
 * lines they wrote, not a mood the app inferred — the words are theirs, the
 * app only lays them in order.
 */
export function movementSteps(lines: LedgerLine[]): Step[] {
  const out: Step[] = []
  for (const l of lines) {
    const kind: Step['kind'] = l.flag === 'answered' ? 'answered' : l.flag === 'ask' ? 'ask' : l.kind
    if (kind === 'story') continue
    const word = kind === 'answered' ? KIND_COPY.answered : kind === 'ask' ? KIND_COPY.ask : KIND_COPY[kind]
    if (out.length && out[out.length - 1]!.word === word) continue
    out.push({ word, kind, month: l.month })
  }
  return out
}

/** Month-by-month, with the silences kept: "quiet Mar – Aug" is part of the thread. */
export type TimelineItem =
  | { type: 'month'; month: number; lines: LedgerLine[]; more: boolean; marked: boolean }
  | { type: 'quiet'; from: number; to: number; trailing: boolean }

export function timeline(thread: LedgerThread, throughMonth: number): TimelineItem[] {
  const out: TimelineItem[] = []
  const present = thread.perMonth.map((c, m) => (m < throughMonth && c > 0 ? m : -1)).filter((m) => m >= 0)
  if (present.length === 0) return out
  const first = present[0]!
  let quietFrom = -1
  for (let m = first; m < throughMonth; m++) {
    if (!thread.perMonth[m]) {
      if (quietFrom < 0) quietFrom = m
      continue
    }
    if (quietFrom >= 0) {
      out.push({ type: 'quiet', from: quietFrom, to: m - 1, trailing: false })
      quietFrom = -1
    }
    const lines = thread.lines.filter((l) => l.month === m)
    out.push({
      type: 'month',
      month: m,
      lines: lines.slice(0, PER_MONTH),
      more: thread.perMonth[m]! > Math.min(lines.length, PER_MONTH),
      marked: thread.markedMonths.includes(m),
    })
  }
  if (quietFrom >= 0) out.push({ type: 'quiet', from: quietFrom, to: throughMonth - 1, trailing: true })
  return out
}

export function ThreadWalk({ thread, throughMonth, labels, onOpenThread, onOpenEntry, onClose }: Props) {
  const present = thread.perMonth.map((c, m) => (m < throughMonth && c > 0 ? m : -1)).filter((m) => m >= 0)
  const first = present[0] ?? 0
  const last = present[present.length - 1] ?? 0
  const steps = movementSteps(thread.lines)

  const kinds = [...new Set(thread.lines.map((l) => l.kind))]
  const refs = new Map<string, Set<number>>()
  const crossed = new Map<string, Set<number>>()
  for (const l of thread.lines) {
    for (const r of l.refs) (refs.get(r) ?? refs.set(r, new Set()).get(r)!).add(l.month)
    for (const w of l.with) if (labels.has(w)) (crossed.get(w) ?? crossed.set(w, new Set()).get(w)!).add(l.month)
  }
  const months = (s: Set<number>) => [...s].sort((a, b) => a - b).map((m) => MONTH_SHORT[m]).join(', ')

  return (
    <div className="ledger-walk">
      <div className="ledger-walk__head">
        <h3 className="ledger-walk__title">{thread.label}</h3>
        <button type="button" className="ledger-walk__close" onClick={onClose}>
          {LEDGER_COPY.close}
        </button>
      </div>
      <p className="ledger-walk__span">
        {first === last ? MONTH_LONG[first] : `${MONTH_LONG[first]} – ${MONTH_LONG[last]}`}
        {thread.returned ? ` · ${LEDGER_COPY.cameBack}` : ''}
      </p>

      <div className="ledger-walk__facets">
        <div className="ledger-walk__facet is-wide">
          <span className="ascent-dim__eyebrow">{LEDGER_COPY.moved}</span>
          {steps.length > 0 ? (
            <div className="ledger-walk__steps">
              {steps.map((s, i) => (
                <span key={`${s.word}${i}`} className="ledger-walk__step">
                  {i > 0 ? <span className="ledger-walk__arrow">→</span> : null}
                  <span className="ledger-chip" data-kind={s.kind}>
                    <i />
                    {s.word} <small>{MONTH_SHORT[s.month]}</small>
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <p className="ledger-walk__none">{LEDGER_COPY.onlyWritten}</p>
          )}
        </div>
        <div className="ledger-walk__facet">
          <span className="ascent-dim__eyebrow">{LEDGER_COPY.markings}</span>
          <div>
            {kinds.map((k) => (
              <span key={k} className="ledger-chip" data-kind={k}>
                <i />
                {KIND_COPY[k]}
              </span>
            ))}
          </div>
        </div>
        <div className="ledger-walk__facet">
          <span className="ascent-dim__eyebrow">{LEDGER_COPY.scripture}</span>
          {refs.size > 0 ? (
            <div>
              {[...refs].map(([r, ms]) => (
                <span key={r} className="ledger-chip">
                  {r} <small>{months(ms)}</small>
                </span>
              ))}
            </div>
          ) : (
            <p className="ledger-walk__none">{LEDGER_COPY.noScripture}</p>
          )}
        </div>
        <div className="ledger-walk__facet">
          <span className="ascent-dim__eyebrow">{LEDGER_COPY.crossed}</span>
          {crossed.size > 0 ? (
            <div>
              {[...crossed].map(([id, ms]) => (
                <button key={id} type="button" className="ledger-chip is-link" onClick={() => onOpenThread(id)}>
                  {labels.get(id)} <small>{months(ms)}</small>
                </button>
              ))}
            </div>
          ) : (
            <p className="ledger-walk__none">{LEDGER_COPY.noCrossed}</p>
          )}
        </div>
      </div>

      <ol className="ledger-walk__timeline">
        {timeline(thread, throughMonth).map((item) =>
          item.type === 'quiet' ? (
            <li key={`q${item.from}`} className="ledger-walk__quiet">
              {item.trailing
                ? LEDGER_COPY.quietSince(MONTH_LONG[item.from - 1] ?? MONTH_LONG[item.from]!)
                : item.from === item.to
                  ? LEDGER_COPY.quietIn(MONTH_LONG[item.from]!)
                  : LEDGER_COPY.quietSpan(MONTH_SHORT[item.from]!, MONTH_SHORT[item.to]!)}
            </li>
          ) : (
            <li key={`m${item.month}`} className="ledger-walk__month">
              <span className="ledger-walk__mname">
                {MONTH_LONG[item.month]}
                {item.marked ? <em> · {LEDGER_COPY.setApart}</em> : null}
              </span>
              {item.lines.map((l, i) => (
                <button
                  key={`${l.entryId}${i}`}
                  type="button"
                  className="ledger-walk__line"
                  onClick={() => onOpenEntry?.(l.entryId)}
                >
                  <span className="ledger__date">{MONTH_SHORT[l.month]} {Number(l.date.slice(8, 10))}</span>
                  <span className="ledger-walk__text">{l.text}</span>
                  <span className="ledger-walk__meta">
                    <span className="ledger-chip is-bare" data-kind={l.kind}>
                      <i />
                      {KIND_COPY[l.kind]}
                    </span>
                    {l.flag === 'answered' ? <span className="ledger-walk__flag">◆ {KIND_COPY.answered}</span> : null}
                    {l.flag === 'ask' ? <span className="ledger-walk__flag">{KIND_COPY.ask}</span> : null}
                    {l.flag === 'turn' ? <span className="ledger-walk__flag">↗ {LEDGER_COPY.turned}</span> : null}
                    {l.refs.map((r) => (
                      <span key={r} className="ledger-walk__ref">{r}</span>
                    ))}
                  </span>
                </button>
              ))}
              {item.more ? <span className="ledger-walk__more">{LEDGER_COPY.moreThatMonth}</span> : null}
            </li>
          ),
        )}
      </ol>

      {ALLOWS_INTERNAL_UI || import.meta.env.DEV ? (
        // Alpha only: what the order was made of, so the weights can be tuned on
        // a real year. The writer-facing Summit never prints a count.
        <p className="ledger-walk__why">
          why here · {thread.facts.months} months · {thread.facts.mentions} pages · back after quiet{' '}
          {thread.facts.returns} · moved {thread.facts.movement} · set apart {thread.facts.marked} · in{' '}
          {Math.round(thread.facts.prior * 100)}% of earlier years · score {thread.score.toFixed(1)}
        </p>
      ) : null}
    </div>
  )
}
