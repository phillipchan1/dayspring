import { useMemo, useState } from 'react'
import { LEDGER_COPY, MONTH_SHORT } from './copy'
import type { LedgerStone, LedgerThread, YearLedger } from './build'
import { ThreadWalk } from './ThreadWalk'
import './Ledger.css'

interface Props {
  ledger: YearLedger
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/** How many threads the Summit lays out before "more of the year". */
const SHOWN = 6

/**
 * WHAT THIS YEAR KEPT RETURNING TO — the year, drawn as its threads.
 *
 * Replaces the trail. The trail drew the calendar: a line that reached the peak
 * on 31 December whatever the year held, which reads as a progress bar and says
 * nothing about a life. Here every row is something the writer came back to,
 * laid across the months it was alive in — a dot for each month they wrote
 * about it, a dotted stretch where they went quiet and came back, a stone where
 * a prayer was answered. The shape of the year is the shape of what they carried.
 *
 * No counts are printed anywhere. The order is the ledger's, and the order is
 * the only place its arithmetic shows.
 */
export function YearThreads({ ledger, onOpenEntry }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const rows = all ? ledger.threads : ledger.threads.slice(0, SHOWN)
  const openThread = ledger.threads.find((t) => t.id === open) ?? null
  const labels = useMemo(() => new Map(ledger.threads.map((t) => [t.id, t.label])), [ledger])

  if (ledger.threads.length === 0) return null

  return (
    <section className="ledger">
      <span className="ascent-dim__eyebrow">{LEDGER_COPY.eyebrow}</span>
      <p className="ledger__cap">{LEDGER_COPY.caption}</p>

      <div className="ledger__weave" role="list">
        <div className="ledger__months" aria-hidden>
          <span />
          {MONTH_SHORT.map((m, i) => (
            <span key={m} data-future={i >= ledger.throughMonth ? 'true' : undefined}>
              {m.slice(0, 1)}
              <em>{m.slice(1)}</em>
            </span>
          ))}
        </div>
        {rows.map((t) => (
          <button
            key={t.id}
            type="button"
            role="listitem"
            className="ledger__row"
            data-on={t.id === open ? 'true' : undefined}
            aria-expanded={t.id === open}
            onClick={() => setOpen((cur) => (cur === t.id ? null : t.id))}
          >
            <span className="ledger__name">
              <span className="ledger__label">{t.label}</span>
              <span className="ledger__kind">{LEDGER_COPY.kind[t.kind]}</span>
            </span>
            <Strand thread={t} throughMonth={ledger.throughMonth} />
          </button>
        ))}
        {ledger.threads.length > SHOWN ? (
          <button type="button" className="ledger__more" onClick={() => setAll((v) => !v)}>
            {all ? LEDGER_COPY.fewer : LEDGER_COPY.more}
          </button>
        ) : null}
      </div>

      {openThread ? (
        <ThreadWalk
          thread={openThread}
          throughMonth={ledger.throughMonth}
          labels={labels}
          onOpenThread={setOpen}
          onOpenEntry={onOpenEntry}
          onClose={() => setOpen(null)}
        />
      ) : null}

      {ledger.stones.length > 0 ? <Stones stones={ledger.stones} labels={labels} onOpenEntry={onOpenEntry} /> : null}
    </section>
  )
}

/**
 * One thread across twelve months: a dot for each month written in (larger for
 * more), a solid run between neighbouring months, a dotted run across a quiet
 * stretch it came back from. Twelve cells rather than an SVG so the dots stay
 * round at any width.
 */
export function strandCells(perMonth: number[], throughMonth: number) {
  const present = perMonth.map((c, m) => m < throughMonth && c > 0)
  const prevAt = (k: number) => {
    for (let i = k - 1; i >= 0; i--) if (present[i]) return i
    return -1
  }
  const nextAt = (k: number) => {
    for (let i = k + 1; i < 12; i++) if (present[i]) return i
    return -1
  }
  return perMonth.map((c, k) => {
    const p = prevAt(k)
    const n = nextAt(k)
    const on = present[k]!
    const left = p < 0 || (!on && n < 0) ? null : p === k - 1 && on ? 'run' : 'quiet'
    const right = n < 0 || (!on && p < 0) ? null : n === k + 1 && on ? 'run' : 'quiet'
    return { month: k, on, count: on ? c : 0, left, right, future: k >= throughMonth }
  })
}

function Strand({ thread, throughMonth }: { thread: LedgerThread; throughMonth: number }) {
  const peak = Math.max(1, ...thread.perMonth)
  return (
    <span className="ledger__strand" aria-hidden>
      {strandCells(thread.perMonth, throughMonth).map((c) => {
        const ev = thread.events.find((e) => e.month === c.month)
        const size = c.on ? 5 + Math.round((c.count / peak) * 5) : 0
        return (
          <span key={c.month} className="ledger__cell" data-future={c.future ? 'true' : undefined}>
            {c.left ? <span className={`ledger__seg is-left is-${c.left}`} /> : null}
            {c.right ? <span className={`ledger__seg is-right is-${c.right}`} /> : null}
            {c.on ? (
              <span
                className="ledger__dot"
                data-marked={thread.markedMonths.includes(c.month) ? 'true' : undefined}
                data-event={ev?.type}
                style={{ width: size, height: size }}
              />
            ) : null}
          </span>
        )
      })}
    </span>
  )
}

function Stones({
  stones,
  labels,
  onOpenEntry,
}: {
  stones: LedgerStone[]
  labels: Map<string, string>
  onOpenEntry?: ((entryId: string) => void) | undefined
}) {
  return (
    <div className="ledger__stones">
      <span className="ascent-dim__eyebrow">{LEDGER_COPY.stonesEyebrow}</span>
      {stones.map((s) => (
        <div key={s.id} className="ledger__stone">
          <span className="ledger__stone-of">{labels.get(s.threadId)}</span>
          <button type="button" className="ledger__stone-line is-ask" onClick={() => onOpenEntry?.(s.ask.entryId)}>
            <span className="ledger__date">{fmtDay(s.ask.date)} · {LEDGER_COPY.youAsked}</span>“{s.ask.text}”
          </button>
          <button type="button" className="ledger__stone-line" onClick={() => onOpenEntry?.(s.later.entryId)}>
            <span className="ledger__date">{fmtDay(s.later.date)} · {LEDGER_COPY.later}</span>“{s.later.text}”
          </button>
        </div>
      ))}
    </div>
  )
}

export function fmtDay(date: string): string {
  const m = Number(date.slice(5, 7)) - 1
  return `${MONTH_SHORT[m]} ${Number(date.slice(8, 10))}`
}
