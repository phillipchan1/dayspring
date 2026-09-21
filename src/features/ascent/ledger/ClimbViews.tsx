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
import { NameIt, usePeriodName } from './NameIt'
import { ThreadAcross } from './ThreadAcross'
import { NowStrip } from './NowStrip'
import { monthStrip, seasonStrip } from './strips'
import type { Seed } from './write'
import './Ledger.css'

type Open = ((entryId: string) => void) | undefined

/** Today on the writer's clock — "it's Monday" must be their Monday, not UTC's. */
export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
/** The period a climb view has selected — so the mountain above can frame it. */
type OnPeriod = ((from: string, to: string) => void) | undefined

export function MonthView({ onOpenEntry, onPeriod }: { onOpenEntry: Open; onPeriod?: OnPeriod }) {
  const today = todayIso()
  const months = useMemo(() => recentMonths(today, 6), [today])
  const [ym, setYm] = useState(months[months.length - 1]!)
  const end = monthEnd(ym)
  const open = today <= end
  const [ledger, setLedger] = useState<RangeLedger | null>(null)
  const [seed, setSeed] = useState<Seed | null>(null)
  const extras = useExtras(`${ym}-01`, end)
  const [given, setGiven] = usePeriodName(`month:${ym}`)
  const [across, setAcross] = useState<LedgerThread | null>(null)
  useEffect(() => onPeriod?.(`${ym}-01`, end), [ym, end, onPeriod])

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
      title: given ? `${monthLabel(ym)} · ${given}` : monthLabel(ym),
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
      </nav>
      <h2 className="climb__title">
        {monthLabel(ym)} <NameIt key={ym} name={given} onName={setGiven} />
      </h2>
      <NowStrip strip={monthStrip(ym, today)} />

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
                <div>
                  <button type="button" className="story__name-btn alive__name" onClick={() => setAcross(t)} title={LEDGER_COPY.wholeThread}>
                    {t.label}
                  </button>
                  <div className="alive__kind">{LEDGER_COPY.kind[t.kind]}</div>
                </div>
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
      {across ? <ThreadAcross thread={across} onClose={() => setAcross(null)} onOpenEntry={onOpenEntry} /> : null}
    </div>
  )
}

// ── RIDGE: a season ─────────────────────────────────────────────────────────

function Pile({
  title,
  what,
  items,
  empty,
  onOpen,
}: {
  title: string
  /** One line saying what belongs in this pile — a date fact. */
  what: string
  items: MovedItem[]
  empty: string
  /** A card stands for every page the thread was on, so it opens the thread. */
  onOpen: (item: MovedItem, why: string) => void
}) {
  return (
    <div className="pile">
      <div className="pile__head">
        <h4>{title}</h4>
        <p>{what}</p>
      </div>
      {items.length === 0 ? (
        <p className="pile__none">{empty}</p>
      ) : (
        <div className="pile__items">
          {items.map((it) => (
            <button key={it.thread.id} type="button" className="pile__item" onClick={() => onOpen(it, what)}>
              <span className="pile__name">{it.thread.label}</span>
              <span className="pile__kind">{LEDGER_COPY.kind[it.thread.kind]}</span>
              {it.line ? (
                <span className="pile__line">
                  “{it.line.text}”<small>{fmtDay(it.line.date)}</small>
                </span>
              ) : null}
              <span className="pile__open">{LEDGER_COPY.pileOpen}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * What moved this season — began, came back, carried through, went quiet.
 * Dates, not meanings. Real seasons: "Fall 2026", "Winter 2025–26".
 */
export function SeasonView({ onOpenEntry, onPeriod }: { onOpenEntry: Open; onPeriod?: OnPeriod }) {
  const today = todayIso()
  const seasons = useMemo(() => recentSeasons(today, 4), [today])
  const [key, setKey] = useState(seasons[seasons.length - 1]!.key)
  const season: Season = seasons.find((s) => s.key === key) ?? seasonOf(today)
  const prev = previousSeason(season)
  const open = today >= season.from && today <= season.to
  const [view, setView] = useState<SeasonView | null>(null)
  const [seed, setSeed] = useState<Seed | null>(null)
  const extras = useExtras(season.from, season.to)
  const [given, setGiven] = usePeriodName(`season:${season.key}`)
  useEffect(() => onPeriod?.(season.from, season.to), [season.from, season.to, onPeriod])
  const [across, setAcross] = useState<{ thread: LedgerThread; focus: { label: string; why: string; lines: LedgerLine[] } } | null>(null)
  // A card is there because of every page the thread was on this season (for
  // "went quiet", last season) — so it opens those pages, then its whole life.
  const openPile = (it: MovedItem, why: string, span: string = season.label) =>
    setAcross({ thread: it.thread, focus: { label: span, why, lines: it.thread.lines } })

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
      title: given ? `${season.label} · ${given}` : season.label,
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
      <h2 className="climb__title">
        {season.label} <NameIt key={season.key} name={given} onName={setGiven} />
      </h2>
      <p className="climb__sub">{season.months}</p>
      <NowStrip strip={seasonStrip(season, today)} />

      <section className="climb__mod">
        <span className="ascent-dim__eyebrow">{LEDGER_COPY.movedSeason(season.name)}</span>
        {!m ? (
          <SurfaceLoader label="Reading the season…" />
        ) : (
          <>
            <div className="piles">
              <Pile title={LEDGER_COPY.began} what={LEDGER_COPY.beganWhat(season.name)} items={m.began} empty={LEDGER_COPY.beganNone} onOpen={openPile} />
              <Pile title={LEDGER_COPY.cameBackPile} what={LEDGER_COPY.cameBackWhat(prev.label)} items={m.cameBack} empty={LEDGER_COPY.cameBackNone} onOpen={openPile} />
              <Pile title={LEDGER_COPY.carried} what={LEDGER_COPY.carriedWhat(prev.label)} items={m.carried} empty={LEDGER_COPY.carriedNone(prev.label)} onOpen={openPile} />
              <Pile
                title={open ? LEDGER_COPY.notYet(season.name) : LEDGER_COPY.quietPile}
                what={open ? LEDGER_COPY.notYetWhat(prev.label, season.name) : LEDGER_COPY.quietWhat(prev.label)}
                items={m.quiet}
                empty={open ? LEDGER_COPY.notYetNone(prev.label) : LEDGER_COPY.quietNone}
                onOpen={(it, why) => openPile(it, why, prev.label)}
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
      {across ? <ThreadAcross thread={across.thread} focus={across.focus} onClose={() => setAcross(null)} onOpenEntry={onOpenEntry} /> : null}
    </div>
  )
}

export { Passage }
