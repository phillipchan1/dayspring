import { useMemo, useState } from 'react'
import type { LedgerThread, YearLedger } from './build'
import { LEDGER_COPY, MONTH_LONG, MONTH_SHORT } from './copy'
import { onePerMonth } from './extras'
import type { SpanExtras } from './load'
import { Passage } from './Passage'
import { SpanPhotoTile } from './SpanPhotos'
import { WriteSheet } from './WriteSheet'
import { ThreadAcross } from './ThreadAcross'
import { threadSeed, todayIso } from './ClimbViews'
import type { Seed } from './write'
import './Ledger.css'

/** Passages the Summit tells before "more of the year". */
const SHOWN = 5

/**
 * The year, told back: where we are in it (a strip of months, "now" marked,
 * the months still to come dashed), the year's photos laid under its months,
 * then each thread it kept returning to as a short passage of the writer's own
 * lines — and who was new in its pages. Every one of those ends in writing.
 */
export function YearStory({
  ledger,
  extras,
  open,
  onOpenEntry,
}: {
  ledger: YearLedger
  extras: SpanExtras | null
  open: boolean
  onOpenEntry?: ((entryId: string) => void) | undefined
}) {
  const [all, setAll] = useState(false)
  const [seed, setSeed] = useState<Seed | null>(null)
  const [across, setAcross] = useState<LedgerThread | null>(null)
  const today = todayIso()
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => `${ledger.year}-${String(i + 1).padStart(2, '0')}`), [ledger.year])
  const nowIx = open ? ledger.throughMonth - 1 : 12
  const film = useMemo(() => onePerMonth(extras?.photos ?? []), [extras])
  const threads = all ? ledger.threads : ledger.threads.slice(0, SHOWN)

  function writeYear() {
    setSeed({
      title: open ? LEDGER_COPY.spanSoFar(String(ledger.year)) : String(ledger.year),
      groups: ledger.threads.slice(0, 6).map((t: LedgerThread) => {
        const l = t.lines[t.lines.length - 1]!
        return { label: t.label, lines: [{ date: l.date, text: l.text }] }
      }),
    })
  }

  return (
    <div className="year-story">
      <div className="year-now">
        <div className="year-now__months">
          {months.map((m, i) => (
            <span key={m} className={i < nowIx ? 'is-past' : i === nowIx ? 'is-now' : 'is-future'} />
          ))}
        </div>
        <div className="year-now__labels">
          {months.map((m, i) => (
            <span key={m} className={i === nowIx ? 'is-now' : ''}>
              {i === nowIx ? 'now' : MONTH_SHORT[i]}
            </span>
          ))}
        </div>
        {film.size > 0 ? (
          <div className="year-now__film">
            {months.map((m, i) => {
              const p = film.get(m)
              return i > nowIx ? (
                <span key={m} className="year-now__empty is-future" />
              ) : p ? (
                <SpanPhotoTile key={m} photo={p} onOpenEntry={onOpenEntry} className="span-photo is-film" />
              ) : (
                <span key={m} className="year-now__empty" />
              )
            })}
          </div>
        ) : null}
        {open ? <p className="year-now__note">{LEDGER_COPY.nowNote(MONTH_LONG[nowIx]!)}</p> : null}
      </div>

      <section className="climb__mod">
        <span className="ascent-dim__eyebrow">{LEDGER_COPY.yearTold}</span>
        {threads.map((t) => (
          <Passage
            key={t.id}
            thread={t}
            months={months}
            today={today}
            open={open}
            onOpenEntry={onOpenEntry}
            onWrite={(th, lines) => setSeed(threadSeed(th, lines))}
            onWhole={setAcross}
          />
        ))}
        {ledger.threads.length > SHOWN && !all ? (
          <button type="button" className="ledger__more" onClick={() => setAll(true)}>
            {LEDGER_COPY.moreThreads}
          </button>
        ) : null}
      </section>

      {extras && extras.news.length > 0 ? (
        <section className="climb__mod">
          <span className="ascent-dim__eyebrow">{LEDGER_COPY.yearNew}</span>
          <div className="new-names">
            {extras.news.map((n) => (
              <button key={n.label} type="button" className="new-name" onClick={() => onOpenEntry?.(n.entryId)}>
                <span className="new-name__label">{n.label}</span>
                <span className="new-name__first">
                  first on {MONTH_SHORT[+n.date.slice(5, 7) - 1]} {+n.date.slice(8, 10)}
                </span>
                <span className="new-name__line">{n.line}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="span-write">
        <h3>{open ? LEDGER_COPY.yearWrite : LEDGER_COPY.yearWriteSealed(ledger.year)}</h3>
        <p>{LEDGER_COPY.yearWriteHint}</p>
        <button type="button" className="story__write is-solid" onClick={writeYear}>
          {open ? LEDGER_COPY.yearWriteCta : LEDGER_COPY.yearWriteCtaSealed(ledger.year)}
        </button>
      </section>

      {seed ? <WriteSheet seed={seed} onClose={() => setSeed(null)} onOpenEntry={onOpenEntry} /> : null}
      {across ? <ThreadAcross thread={across} onClose={() => setAcross(null)} onOpenEntry={onOpenEntry} /> : null}
    </div>
  )
}
