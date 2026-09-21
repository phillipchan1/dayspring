import { useEffect, useMemo, useState } from 'react'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import type { LedgerLine, LedgerThread, RangeLedger } from './build'
import { monthEnd } from './build'
import { LEDGER_COPY, MONTH_LONG, MONTH_SHORT } from './copy'
import type { NewName } from './extras'
import { loadMonthLedger, loadSeasonView, loadSpanExtras, type SeasonView, type SpanExtras } from './load'
import type { MovedItem } from './moved'
import { fmtDay, Passage } from './Passage'
import { previousSeason, recentSeasons, seasonOf, type Season } from './seasons'
import { SpanPhotos } from './SpanPhotos'
import { WriteSheet } from './WriteSheet'
import type { Seed } from './write'
import './Ledger.css'

type Open = ((entryId: string) => void) | undefined

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}
export function monthLabel(ym: string): string {
  return `${MONTH_LONG[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`
}
/** The last `n` months, oldest first, ending with this one. */
export function recentMonths(today: string, n: number): string[] {
  const out: string[] = []
  let y = +today.slice(0, 4)
  let m = +today.slice(5, 7)
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, '0')}`)
    m--
    if (m === 0) {
      m = 12
      y--
    }
  }
  return out
}

export function threadSeed(thread: LedgerThread, lines: LedgerLine[]): Seed {
  return { title: thread.label, groups: [{ label: thread.label, lines: lines.map((l) => ({ date: l.date, text: l.text })) }] }
}

function NewNames({ news, onOpenEntry }: { news: NewName[]; onOpenEntry: Open }) {
  if (news.length === 0) return <p className="ledger-quiet">{LEDGER_COPY.newNone}</p>
  return (
    <div className="new-names">
      {news.map((n) => (
        <button key={n.label} type="button" className="new-name" onClick={() => onOpenEntry?.(n.entryId)}>
          <span className="new-name__label">{n.label}</span>
          <span className="new-name__first">first on {fmtDay(n.date)}</span>
          <span className="new-name__line">{n.line}</span>
        </button>
      ))}
    </div>
  )
}

function SpanWrite({ title, cta, onWrite }: { title: string; cta: string; onWrite: () => void }) {
  return (
    <section className="span-write">
      <h3>{title}</h3>
      <p>{LEDGER_COPY.spanWriteHint}</p>
      <button type="button" className="story__write is-solid" onClick={onWrite}>
        {cta}
      </button>
    </section>
  )
}

function useExtras(from: string, to: string): SpanExtras | null {
  const [extras, setExtras] = useState<SpanExtras | null>(null)
  useEffect(() => {
    let alive = true
    setExtras(null)
    loadSpanExtras(from, to).then(
      (x) => alive && setExtras(x),
      () => alive && setExtras({ photos: [], news: [] }),
    )
    return () => {
      alive = false
    }
  }, [from, to])
  return extras
}

// ── HILLSIDE: a month ───────────────────────────────────────────────────────

/**
 * What's alive this month: each thread you wrote about in it, with its lines
 * from this month; who was new; the month's photos. The month is named by the
 * calendar — never by the app.
 */
export function MonthView({ onOpenEntry }: { onOpenEntry: Open }) {
  const today = todayIso()
  const months = useMemo(() => recentMonths(today, 6), [today])
  const [ym, setYm] = useState(months[months.length - 1]!)
  const end = monthEnd(ym)
  const open = today <= end
  const [ledger, setLedger] = useState<RangeLedger | null>(null)
  const [seed, setSeed] = useState<Seed | null>(null)
  const extras = useExtras(`${ym}-01`, end)

  useEffect(() => {
    let alive = true
    setLedger(null)
    loadMonthLedger(ym, end).then(
      (l) => alive && setLedger(l),
      () => alive && setLedger({ from: '', to: '', months: [], threads: [], stones: [] }),
    )
    return () => {
      alive = false
    }
  }, [ym, end])

  function writeMonth() {
    if (!ledger) return
    setSeed({
      title: monthLabel(ym),
      groups: ledger.threads.map((t) => ({ label: t.label, lines: t.lines.slice(-3).map((l) => ({ date: l.date, text: l.text })) })),
    })
  }

  return (
    <div className="climb">
      <nav className="climb__periods" aria-label="Months">
        {months.map((m) => (
          <button key={m} type="button" aria-pressed={m === ym} onClick={() => setYm(m)}>
            {MONTH_SHORT[+m.slice(5, 7) - 1]}
          </button>
        ))}
        {open ? <span className="climb__live">{LEDGER_COPY.stillBeingWrittenShort}</span> : null}
      </nav>
      <h2 className="climb__title">{monthLabel(ym)}</h2>

      <section className="climb__mod">
        <span className="ascent-dim__eyebrow">{LEDGER_COPY.alive}</span>
        {!ledger ? (
          <SurfaceLoader label="Reading the month…" />
        ) : ledger.threads.length === 0 ? (
          <p className="ledger-quiet">{LEDGER_COPY.aliveNone}</p>
        ) : (
          <div className="alive">
            {ledger.threads.map((t) => (
              <div key={t.id} className="alive__row">
                <div className="alive__name">{t.label}</div>
                <div className="alive__lines">
                  {t.lines.slice(-3).map((l, i) => (
                    <button key={`${l.entryId}${i}`} type="button" onClick={() => onOpenEntry?.(l.entryId)}>
                      <span className="alive__when">{fmtDay(l.date)}</span>
                      <span className="alive__text">{l.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="climb__mod">
        <span className="ascent-dim__eyebrow">{LEDGER_COPY.newInPages}</span>
        {extras ? <NewNames news={extras.news} onOpenEntry={onOpenEntry} /> : null}
      </section>
      <section className="climb__mod">
        <span className="ascent-dim__eyebrow">{LEDGER_COPY.photos}</span>
        {extras ? <SpanPhotos photos={extras.photos} onOpenEntry={onOpenEntry} empty={LEDGER_COPY.photosNone} /> : null}
      </section>

      {ledger && ledger.threads.length > 0 ? (
        <SpanWrite
          title={open ? LEDGER_COPY.spanSoFar(monthLabel(ym)) : monthLabel(ym)}
          cta={LEDGER_COPY.writeAboutSpan(MONTH_LONG[+ym.slice(5, 7) - 1]!)}
          onWrite={writeMonth}
        />
      ) : null}
      {seed ? <WriteSheet seed={seed} onClose={() => setSeed(null)} onOpenEntry={onOpenEntry} /> : null}
    </div>
  )
}

// ── RIDGE: a season ─────────────────────────────────────────────────────────

function Pile({ title, items, empty, onOpenEntry }: { title: string; items: MovedItem[]; empty: string; onOpenEntry: Open }) {
  return (
    <div className="pile">
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p className="pile__none">{empty}</p>
      ) : (
        items.map((it) => (
          <button key={it.thread.id} type="button" className="pile__item" onClick={() => it.line && onOpenEntry?.(it.line.entryId)}>
            <span className="pile__name">{it.thread.label}</span>
            {it.line ? (
              <span className="pile__line">
                “{it.line.text}”<small>{fmtDay(it.line.date)}</small>
              </span>
            ) : null}
          </button>
        ))
      )}
    </div>
  )
}

/**
 * What moved this season — began, came back, carried through, went quiet.
 * Dates, not meanings. Real seasons: "Fall 2026", "Winter 2025–26".
 */
export function SeasonView({ onOpenEntry }: { onOpenEntry: Open }) {
  const today = todayIso()
  const seasons = useMemo(() => recentSeasons(today, 4), [today])
  const [key, setKey] = useState(seasons[seasons.length - 1]!.key)
  const season: Season = seasons.find((s) => s.key === key) ?? seasonOf(today)
  const prev = previousSeason(season)
  const open = today >= season.from && today <= season.to
  const [view, setView] = useState<SeasonView | null>(null)
  const [seed, setSeed] = useState<Seed | null>(null)
  const extras = useExtras(season.from, season.to)

  useEffect(() => {
    let alive = true
    setView(null)
    loadSeasonView(season).then(
      (v) => alive && setView(v),
      () => alive && setView({ ledger: { from: '', to: '', months: [], threads: [], stones: [] }, moved: { began: [], cameBack: [], carried: [], quiet: [] } }),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [season.key])

  function writeSeason() {
    if (!view) return
    const items = [...view.moved.began, ...view.moved.cameBack, ...view.moved.carried]
    setSeed({
      title: season.label,
      groups: items
        .filter((it) => it.line)
        .map((it) => ({ label: it.thread.label, lines: [{ date: it.line!.date, text: it.line!.text }] })),
    })
  }

  const m = view?.moved
  return (
    <div className="climb">
      <nav className="climb__periods" aria-label="Seasons">
        {seasons.map((s) => (
          <button key={s.key} type="button" aria-pressed={s.key === key} onClick={() => setKey(s.key)}>
            {s.label}
          </button>
        ))}
        <span className="climb__hemi">{LEDGER_COPY.hemisphere}</span>
      </nav>
      <h2 className="climb__title">{season.label}</h2>
      <p className="climb__sub">
        {season.months}
        {open ? ` · ${LEDGER_COPY.stillBeingWrittenShort}` : ''}
      </p>

      <section className="climb__mod">
        <span className="ascent-dim__eyebrow">{LEDGER_COPY.movedSeason(season.name)}</span>
        {!m ? (
          <SurfaceLoader label="Reading the season…" />
        ) : (
          <>
            <div className="piles">
              <Pile title={LEDGER_COPY.began} items={m.began} empty={LEDGER_COPY.beganNone} onOpenEntry={onOpenEntry} />
              <Pile title={LEDGER_COPY.cameBackPile} items={m.cameBack} empty={LEDGER_COPY.cameBackNone} onOpenEntry={onOpenEntry} />
              <Pile title={LEDGER_COPY.carried} items={m.carried} empty={LEDGER_COPY.carriedNone(prev.label)} onOpenEntry={onOpenEntry} />
              <Pile
                title={open ? LEDGER_COPY.notYet(season.name) : LEDGER_COPY.quietPile}
                items={m.quiet}
                empty={open ? LEDGER_COPY.notYetNone(prev.label) : LEDGER_COPY.quietNone}
                onOpenEntry={onOpenEntry}
              />
            </div>
            {open ? <p className="ledger-quiet">{LEDGER_COPY.seasonYoung}</p> : null}
          </>
        )}
      </section>

      <section className="climb__mod">
        <span className="ascent-dim__eyebrow">{LEDGER_COPY.newInPages}</span>
        {extras ? <NewNames news={extras.news} onOpenEntry={onOpenEntry} /> : null}
      </section>
      <section className="climb__mod">
        <span className="ascent-dim__eyebrow">{LEDGER_COPY.photos}</span>
        {extras ? <SpanPhotos photos={extras.photos} onOpenEntry={onOpenEntry} empty={LEDGER_COPY.photosNone} /> : null}
      </section>

      {m && m.began.length + m.cameBack.length + m.carried.length > 0 ? (
        <SpanWrite
          title={open ? LEDGER_COPY.spanSoFar(season.label) : season.label}
          cta={LEDGER_COPY.writeAboutSpan(season.label)}
          onWrite={writeSeason}
        />
      ) : null}
      {seed ? <WriteSheet seed={seed} onClose={() => setSeed(null)} onOpenEntry={onOpenEntry} /> : null}
    </div>
  )
}

export { Passage }
