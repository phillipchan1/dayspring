import { useEffect, useMemo, useState } from 'react'
import { DIMENSION_COPY, EMPTY_COPY, SUMMIT_COPY } from './ascent.config'
import type { ScriptureData, SummitStone, SummitView } from './data/types'
import { ScriptureDimension } from './dimensions/ScriptureDimension'
import { recordClimb, sinceLastClimb } from './lastClimb'
import { listSummitYears, loadSummitYear } from './data/summitYear'
import { loadNaming, startNaming, type YearNaming } from './summitNaming'
import { SummitTrail } from './SummitTrail'
import { useFeatureFlag } from '@/features/flags'
import { ALLOWS_INTERNAL_UI } from '@/lib/releaseChannel'
import { loadYearLedger } from './ledger/load'
import { YearThreads } from './ledger/YearThreads'
import type { YearLedger } from './ledger/build'
import { positionInYear } from './data/stones'
import { fmtDay } from './data/words'

interface Props {
  /** The whole Summit: the refrain, the stones, the long look, the year. */
  view: SummitView
  /** Year-of-the-year verse (real scripture, kept). */
  scripture: ScriptureData | null
  onScriptureDrill: (osisRef: string) => void
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/** A stone is only worth a long look after a few months are under it. Below
 *  that a "throughline" would be a mirror pretending to be a window. */
const LONG_LOOK_MIN_PROGRESS = 0.25

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/**
 * SUMMIT (year) — the quietest ground, and the only altitude that is OPEN.
 *
 * Week, month and season are closed loops: they seal on a boundary and stop
 * moving. The year is the one the writer is standing inside, so it is the one
 * place where returning shows something changed — not because a counter went up
 * but because the year got longer and, sometimes, because an ask was met.
 *
 * Five things, four of them the writer's own material, and the app speaks once:
 * the trail with its stones · the refrain · the verse · the long look, folded ·
 * the writer's own naming of the year.
 */
export function Summit({ view: openYear, scripture: openScripture, onScriptureDrill, onOpenEntry }: Props) {
  // The rail. The open year is what you land on; a sealed year is loaded on
  // demand, because an archive of fifteen years must not cost fifteen rollup
  // payloads to open the Ascent.
  const [years, setYears] = useState<number[]>([openYear.year])
  const [shownYear, setShownYear] = useState(openYear.year)
  const [loaded, setLoaded] = useState<SummitView | null>(null)

  useEffect(() => {
    let alive = true
    listSummitYears().then(
      (ys) => alive && setYears(ys),
      () => {}, // no rail is a quieter failure than a broken one
    )
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (shownYear === openYear.year) {
      setLoaded(null)
      return
    }
    let alive = true
    loadSummitYear(shownYear).then(
      (v) => alive && setLoaded(v),
      () => alive && setLoaded(null),
    )
    return () => {
      alive = false
    }
  }, [shownYear, openYear.year])

  const isOpenYear = shownYear === openYear.year
  // A year that hasn't landed yet is NOT the open year with its number swapped:
  // spreading the open year kept its verse and its refrain, which would have put
  // this year's scripture under 2019's heading. Until it loads there is nothing
  // to show but the mountain.
  const view: SummitView | null = isOpenYear ? openYear : loaded
  const scripture = isOpenYear ? openScripture : (view?.scripture ?? null)
  const year = view?.year ?? shownYear
  const stones = view?.stones ?? []
  const longLook = view?.longLook ?? null
  const progress = view?.progress ?? (isOpenYear ? openYear.progress : 1)
  const refrain = view?.words?.moments?.[0] ?? null

  // THE YEAR'S LEDGER (alpha): the year read as the threads the writer kept
  // returning to, in place of the calendar trail. undefined = reading, null =
  // nothing to show (or it failed) — both fall back to the trail, never blank.
  const ledgerOn = useFeatureFlag('yearLedger') || ALLOWS_INTERNAL_UI
  const [ledger, setLedger] = useState<YearLedger | null | undefined>(undefined)
  useEffect(() => {
    if (!ledgerOn) return
    let alive = true
    setLedger(undefined)
    loadYearLedger(shownYear).then(
      (l) => alive && setLedger(l.threads.length > 0 ? l : null),
      (e) => {
        console.error('[ledger]', e instanceof Error ? e.message : e)
        if (alive) setLedger(null)
      },
    )
    return () => {
      alive = false
    }
  }, [ledgerOn, shownYear])
  const ledgerView = ledgerOn && ledger && ledger.year === shownYear ? ledger : null
  const ledgerReading = ledgerOn && ledger === undefined

  const [openStone, setOpenStone] = useState<string | null>(null)
  const [longLookOpen, setLongLookOpen] = useState(false)
  const [naming, setNaming] = useState<YearNaming | null>(null)
  const [starting, setStarting] = useState(false)

  // What arrived since this screen last showed the year. The diff is READ during
  // render and RECORDED in an effect — see lastClimb.ts for why the two have to
  // be separate calls.
  const stoneKey = stones.map((s) => s.id).join(',')
  const hasRefrain = refrain !== null
  const since = useMemo(
    () => (isOpenYear ? sinceLastClimb(year, stones, hasRefrain) : { newStones: [], refrainArrived: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpenYear, year, stoneKey, hasRefrain],
  )
  useEffect(() => {
    // Only the open year has a "since": a sealed one gained nothing while you
    // were away, and recording a visit to 2019 would silence the real year.
    if (isOpenYear) recordClimb(year, stones, hasRefrain)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpenYear, year, stoneKey, hasRefrain])

  // The naming is an ordinary entry, so it is read on its own rather than
  // through the climb: writing one must not mean rebuilding the whole Ascent.
  useEffect(() => {
    let alive = true
    loadNaming(year).then(
      (n) => alive && setNaming(n),
      () => {}, // a naming that won't load is a quiet absence, never an error state
    )
    return () => {
      alive = false
    }
  }, [year])

  const hasAnything =
    refrain !== null ||
    stones.length > 0 ||
    (scripture?.refs.length ?? 0) > 0 ||
    longLook !== null ||
    ledgerView !== null
  if (!hasAnything) {
    return (
      <div className="ascent-summit">
        <YearRail years={years} shown={shownYear} open={openYear.year} onPick={setShownYear} />
        {ledgerReading ? null : (
          <SummitTrail year={year} progress={progress} stones={[]} selectedId={null} onSelect={() => {}} />
        )}
        <p className="ascent-empty">
          {isOpenYear
            ? EMPTY_COPY.year.empty
            : view === null
              ? SUMMIT_COPY.sealedReading(year)
              : SUMMIT_COPY.sealedEmpty(year)}
        </p>
      </div>
    )
  }

  const stone = stones.find((s) => s.id === openStone) ?? null
  const longLookReady = longLook !== null && progress >= LONG_LOOK_MIN_PROGRESS

  async function onWriteNaming() {
    if (starting) return
    if (naming) {
      onOpenEntry?.(naming.entryId)
      return
    }
    setStarting(true)
    try {
      const id = await startNaming(year)
      onOpenEntry?.(id)
    } finally {
      setStarting(false)
    }
  }

  if (ledgerView || ledgerReading) {
    // Ledger mode. The mountain stays — it is the Summit — and the stones on
    // its trail come from answered Altar prayers when the ledger found any,
    // else from the yearly rollup. Below it: the refrain (checked against its
    // page), then the year's threads, then the rest of the Summit unchanged.
    const trailStones: SummitStone[] =
      ledgerView && ledgerView.stones.length > 0
        ? ledgerView.stones.map((st) => ({
            id: st.id,
            ask: { ...st.ask, dateLabel: fmtDay(st.ask.date) },
            later: { ...st.later, dateLabel: fmtDay(st.later.date) },
            position: positionInYear(st.later.date, year),
          }))
        : stones
    const trailStone = trailStones.find((st) => st.id === openStone) ?? null
    return (
      <div className="ascent-summit">
        <YearRail years={years} shown={shownYear} open={openYear.year} onPick={setShownYear} />

        <SummitTrail
          year={year}
          progress={progress}
          stones={trailStones}
          selectedId={openStone}
          onSelect={setOpenStone}
        />

        <p className="ascent-summit__look">
          {isOpenYear ? SUMMIT_COPY.lookingBack : SUMMIT_COPY.lookingBackSealed(year)}
        </p>

        {trailStone ? (
          <StonePair stone={trailStone} onOpenEntry={onOpenEntry} onClose={() => setOpenStone(null)} />
        ) : null}

        <div className="ascent-stack ascent-stack--summit">
          {refrain ? (
            <section className="ascent-dim ascent-dim--words is-year">
              <span className="ascent-dim__eyebrow">{DIMENSION_COPY.words.year}</span>
              <button type="button" className="ascent-oneline" onClick={() => onOpenEntry?.(refrain.entryId)}>
                “{refrain.text}”
              </button>
              <span className="ascent-oneline__date">{refrain.dateLabel}</span>
            </section>
          ) : null}

          {trailStones.length > 0 && !trailStone ? (
            <section className="ascent-dim">
              <span className="ascent-dim__eyebrow">{SUMMIT_COPY.stonesEyebrow}</span>
              <p className="ascent-dim__note">{SUMMIT_COPY.stonesHint}</p>
            </section>
          ) : null}

          {ledgerView ? (
            <YearThreads key={shownYear} ledger={{ ...ledgerView, stones: [] }} onOpenEntry={onOpenEntry} />
          ) : (
            <p className="ascent-dim__note">{SUMMIT_COPY.sealedReading(shownYear)}</p>
          )}

          <ScriptureDimension data={scripture} onDrill={onScriptureDrill} />

          {longLook ? (
            <section className="ascent-dim ascent-longlook">
              <button
                type="button"
                className="ascent-longlook__toggle"
                onClick={() => setLongLookOpen((v) => !v)}
                aria-expanded={longLookOpen}
                disabled={!longLookReady}
              >
                {!longLookReady
                  ? SUMMIT_COPY.longLookWaiting
                  : longLookOpen
                    ? SUMMIT_COPY.longLookClose
                    : SUMMIT_COPY.longLookOpen}
              </button>
              {longLookOpen && longLookReady ? (
                <div className="ascent-longlook__body">
                  {longLook.throughline.map((p, i) => (
                    <p key={`t${i}`} className="ascent-longlook__para">
                      {p}
                    </p>
                  ))}
                  {longLook.themes.map((p, i) => (
                    <p key={`h${i}`} className="ascent-longlook__para is-themes">
                      {p}
                    </p>
                  ))}
                  <p className="ascent-dim__note">{SUMMIT_COPY.longLookFooter}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          {naming?.text || isOpenYear ? (
            <section className="ascent-dim ascent-naming">
              <span className="ascent-dim__eyebrow">{SUMMIT_COPY.namingEyebrow}</span>
              {naming && naming.text ? (
                <>
                  <button type="button" className="ascent-naming__answer" onClick={() => onOpenEntry?.(naming.entryId)}>
                    “{naming.text}”
                  </button>
                  <span className="ascent-oneline__date">{SUMMIT_COPY.namingBy(naming.dateLabel)}</span>
                </>
              ) : (
                <>
                  <p className="ascent-summit__ask">{naming ? SUMMIT_COPY.namingStarted : SUMMIT_COPY.taught}</p>
                  <button type="button" className="ascent-naming__write" onClick={onWriteNaming} disabled={starting}>
                    {naming ? SUMMIT_COPY.namingOpen : SUMMIT_COPY.namingWrite}
                  </button>
                </>
              )}
              <p className="ascent-dim__note">{DIMENSION_COPY.learning.note}</p>
            </section>
          ) : null}

          <SinceLastClimb newStones={since.newStones} refrainArrived={since.refrainArrived} />
        </div>
      </div>
    )
  }

  return (
    <div className="ascent-summit">
      <YearRail years={years} shown={shownYear} open={openYear.year} onPick={setShownYear} />

      <SummitTrail
        year={year}
        progress={progress}
        stones={stones}
        selectedId={openStone}
        onSelect={setOpenStone}
      />

      <p className="ascent-summit__look">
        {isOpenYear ? SUMMIT_COPY.lookingBack : SUMMIT_COPY.lookingBackSealed(year)}
      </p>

      {stone ? <StonePair stone={stone} onOpenEntry={onOpenEntry} onClose={() => setOpenStone(null)} /> : null}

      <div className="ascent-stack ascent-stack--summit">
        {refrain ? (
          <section className="ascent-dim ascent-dim--words is-year">
            <span className="ascent-dim__eyebrow">{DIMENSION_COPY.words.year}</span>
            <button
              type="button"
              className="ascent-oneline"
              onClick={() => onOpenEntry?.(refrain.entryId)}
            >
              “{refrain.text}”
            </button>
            <span className="ascent-oneline__date">{refrain.dateLabel}</span>
          </section>
        ) : null}

        <ScriptureDimension data={scripture} onDrill={onScriptureDrill} />

        {stones.length > 0 && !stone ? (
          <section className="ascent-dim">
            <span className="ascent-dim__eyebrow">{SUMMIT_COPY.stonesEyebrow}</span>
            <p className="ascent-dim__note">{SUMMIT_COPY.stonesHint}</p>
          </section>
        ) : null}

        {longLook ? (
          <section className="ascent-dim ascent-longlook">
            <button
              type="button"
              className="ascent-longlook__toggle"
              onClick={() => setLongLookOpen((v) => !v)}
              aria-expanded={longLookOpen}
              disabled={!longLookReady}
            >
              {!longLookReady
                ? SUMMIT_COPY.longLookWaiting
                : longLookOpen
                  ? SUMMIT_COPY.longLookClose
                  : SUMMIT_COPY.longLookOpen}
            </button>
            {longLookOpen && longLookReady ? (
              <div className="ascent-longlook__body">
                {longLook.throughline.map((p, i) => (
                  <p key={`t${i}`} className="ascent-longlook__para">
                    {p}
                  </p>
                ))}
                {longLook.themes.map((p, i) => (
                  <p key={`h${i}`} className="ascent-longlook__para is-themes">
                    {p}
                  </p>
                ))}
                <p className="ascent-dim__note">{SUMMIT_COPY.longLookFooter}</p>
              </div>
            ) : null}
          </section>
        ) : null}

        {naming?.text || isOpenYear ? (
          <section className="ascent-dim ascent-naming">
            <span className="ascent-dim__eyebrow">{SUMMIT_COPY.namingEyebrow}</span>
            {naming && naming.text ? (
              <>
                <button type="button" className="ascent-naming__answer" onClick={() => onOpenEntry?.(naming.entryId)}>
                  “{naming.text}”
                </button>
                <span className="ascent-oneline__date">{SUMMIT_COPY.namingBy(naming.dateLabel)}</span>
              </>
            ) : (
              <>
                <p className="ascent-summit__ask">{naming ? SUMMIT_COPY.namingStarted : SUMMIT_COPY.taught}</p>
                <button type="button" className="ascent-naming__write" onClick={onWriteNaming} disabled={starting}>
                  {naming ? SUMMIT_COPY.namingOpen : SUMMIT_COPY.namingWrite}
                </button>
              </>
            )}
            <p className="ascent-dim__note">{DIMENSION_COPY.learning.note}</p>
          </section>
        ) : null}

        <SinceLastClimb newStones={since.newStones} refrainArrived={since.refrainArrived} />
      </div>
    </div>
  )
}

/**
 * The years behind you. Newest first, because "last year" is a shorter reach
 * than 2011 — and the open year sits at the head of it from 1 January, before it
 * holds anything, because it is the one you are standing in.
 *
 * A strip rather than a grid: it is a list of four-character labels, and at
 * fifteen of them it still reads in one line. It is the only thing on the Summit
 * allowed to scroll sideways, which is what keeps it from wrapping into a block
 * that competes with the mountain.
 */
function YearRail({
  years,
  shown,
  open,
  onPick,
}: {
  years: number[]
  shown: number
  open: number
  onPick: (year: number) => void
}) {
  if (years.length < 2) return null
  return (
    <nav className="ascent-years" aria-label={SUMMIT_COPY.yearRailLabel}>
      {years.map((y) => (
        <button
          key={y}
          type="button"
          className="ascent-years__year"
          data-on={y === shown ? 'true' : undefined}
          data-open={y === open ? 'true' : undefined}
          aria-current={y === shown ? 'true' : undefined}
          onClick={() => onPick(y)}
        >
          {y}
        </button>
      ))}
    </nav>
  )
}

/** The pair a stone stands for: an earlier ask, and the later moment that met
 *  it. Both verbatim, both opening the page they came from — the app pairs them
 *  and never writes either half. */
function StonePair({
  stone,
  onOpenEntry,
  onClose,
}: {
  stone: SummitStone
  onOpenEntry?: ((entryId: string) => void) | undefined
  onClose: () => void
}) {
  return (
    <div className="ascent-stone-pair">
      <div className="ascent-stone-pair__part">
        <span className="ascent-oneline__date">
          {stone.ask.dateLabel} · {SUMMIT_COPY.stoneAsk}
        </span>
        <button type="button" className="ascent-stone-pair__text" onClick={() => onOpenEntry?.(stone.ask.entryId)}>
          “{stone.ask.text}”
        </button>
      </div>
      <div className="ascent-stone-pair__part">
        <span className="ascent-oneline__date">
          {stone.later.dateLabel} · {SUMMIT_COPY.stoneLater}
        </span>
        <button type="button" className="ascent-stone-pair__text" onClick={() => onOpenEntry?.(stone.later.entryId)}>
          “{stone.later.text}”
        </button>
      </div>
      <button type="button" className="ascent-stone-pair__close" onClick={onClose}>
        {SUMMIT_COPY.stoneClose}
      </button>
    </div>
  )
}

/** Silent unless something actually arrived — which is most visits. */
function SinceLastClimb({
  newStones,
  refrainArrived,
}: {
  newStones: SummitStone[]
  refrainArrived: boolean
}) {
  if (newStones.length === 0 && !refrainArrived) return null

  let text: string
  if (newStones.length === 1) {
    const month = MONTHS[new Date(`${newStones[0]!.later.date}T00:00:00Z`).getUTCMonth()]!
    text = SUMMIT_COPY.sinceStone(month)
  } else if (newStones.length > 1) {
    text = SUMMIT_COPY.sinceStones(newStones.length)
  } else {
    text = SUMMIT_COPY.sinceRefrain
  }

  return <p className="ascent-summit__since">{text}</p>
}
