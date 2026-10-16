import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAppNavigation } from '@/context/AppNavigation'
import { ENTRY_RETURN_LABEL, type AscentDrill } from '@/lib/appHistory'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { SurfaceArrival } from '@/features/journal/SurfaceArrival'
import { useProcessingJobs, isActive } from '@/hooks/useProcessingJobs'
import { useCarriedPeriod } from '@/hooks/useCarriedPeriod'
import { carryPeriod, periodEyebrow, periodName, periodWindow, type Grain } from '@/lib/period'
import { ALTITUDES, EMPTY_COPY, LEDGER_ALTITUDES } from './ascent.config'
import { useFeatureFlag } from '@/features/flags'
import { ALLOWS_INTERNAL_UI } from '@/lib/releaseChannel'
import { MonthView, SeasonView, todayIso } from './ledger/ClimbViews'
import { NowStrip } from './ledger/NowStrip'
import { monthStrip, seasonStrip, weekLabel, weekStrip } from './ledger/strips'
import { ClimbMountain } from './ledger/ClimbMountain'
import type { LedgerStone } from './ledger/build'
import { loadYearLedger } from './ledger/load'
import type { Level } from './ledger/mountain'
import { LEDGER_COPY, MONTH_LONG } from './ledger/copy'
import { seasonOf } from './ledger/seasons'
import { loadAscent, loadWeekAt, readCachedAscent, type AltitudeData, type LoadedAscent } from './data'
import { AltitudeBands } from './AltitudeBands'
import { LensRow } from './LensRow'
import { Summit } from './Summit'
import { BandDrillIn } from './drilldowns/BandDrillIn'
import { ScriptureDrillIn } from './drilldowns/ScriptureDrillIn'
import { SurfaceBar } from '@/components/SurfaceBar'
import { RoomHead } from '@/components/RoomHead'
import { WhenControl } from '@/components/WhenControl'
import './Ascent.css'

interface Props {
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/** undefined = loading, null = failed/empty, value = ready. */
type Loaded<T> = T | null | undefined

const LAST = ALTITUDES.length - 1

/** Altitude index → the grain it stands for, in the shared vocabulary. The tier
 *  is still called 'quarter' in the rollup schema; out loud it is the season. */
const ALTITUDE_GRAIN: Grain[] = ['week', 'month', 'season', 'year']

function clampAltitude(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0
  return Math.min(LAST, Math.max(0, Math.round(n)))
}

/** True when focus is in a text field — so arrow keys don't hijack typing. */
function inTextField(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable
}

/** Light vs night palette, reacting live to the <html data-appearance> switch. */
function useIsLightTheme(): boolean {
  const [light, setLight] = useState(() => document.documentElement.dataset.appearance === 'light')
  useEffect(() => {
    const el = document.documentElement
    const update = () => setLight(el.dataset.appearance === 'light')
    update()
    const obs = new MutationObserver(update)
    obs.observe(el, { attributes: true, attributeFilter: ['data-appearance'] })
    return () => obs.disconnect()
  }, [])
  return light
}

/**
 * THE ASCENT — Looking Back as elevation over one terrain. Four altitudes
 * (week → month → season → year) on one mountain; the SAME four dimensions
 * persist and only change resolution. The volume INVERTS as you climb: the
 * higher you go, the more it is the user's own words and the less the app speaks.
 */
export function AscentView({ onOpenEntry }: Props) {
  const { state, go, back } = useAppNavigation()
  const idx = clampAltitude(state.ascentAltitude)
  const drill = state.ascentDrill
  const light = useIsLightTheme()
  // Paint the last climb the moment the surface mounts — the Ascent is a place
  // you step in and out of, and it shouldn't make you wait for the same reads
  // twice. Whatever is on screen is then revalidated behind (below), so a return
  // visit is instant AND current.
  const [ascent, setAscent] = useState<Loaded<LoadedAscent>>(() => readCachedAscent())
  const [reloadKey, setReloadKey] = useState(0)

  // Mirror of `ascent` for the load effect, which must not re-run when it lands.
  const shownRef = useRef(ascent)
  shownRef.current = ascent

  useEffect(() => {
    let alive = true
    // Content already on screen → go to the network for the fresh copy. Nothing on
    // screen → take the cache if there is one, since the wait is what's visible.
    const warm = !!shownRef.current
    loadAscent({ fresh: warm }).then(
      (d) => alive && setAscent(d),
      // A failed revalidate must not blank a climb the user is reading; only a
      // cold load has an error state to show.
      () => alive && !warm && setAscent(null),
    )
    return () => {
      alive = false
    }
  }, [reloadKey])

  // Climbing carries the period OUT to the other Remember surfaces: step up to
  // the Ridge, cross to the Altar, and you are still in that season. It does not
  // carry IN — altitude here is navigational (history frames, arrow keys, the
  // When), and letting stored state override a history frame is how a back
  // button starts lying about where it came from.
  const [, carry] = useCarriedPeriod('year')
  const grain = ALTITUDE_GRAIN[idx]!
  // How far back through this altitude's periods the reader has stepped — the
  // When's ‹ ›. A climb starts every height at now.
  const [offset, setOffsetState] = useState(0)
  useEffect(() => setOffsetState(0), [idx])
  const setAltitude = useCallback(
    (next: number) => {
      const clamped = clampAltitude(next)
      go({ ascentAltitude: clamped }, { replace: true })
      setOffsetState(0)
      carry(ALTITUDE_GRAIN[clamped]!)
    },
    [go, carry],
  )
  const setOffset = useCallback(
    (next: number) => {
      const n = Math.max(0, Math.floor(next))
      setOffsetState(n)
      carryPeriod(grain, n)
    },
    [grain],
  )
  const up = useCallback(() => setAltitude(idx + 1), [idx, setAltitude])
  const down = useCallback(() => setAltitude(idx - 1), [idx, setAltitude])

  // ↑/↓ ascend/descend — unless typing or a drill-in is open. With ⌥ they are
  // the When's own keys (WhenControl), which climb too; left alone here so one
  // press is one step.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (inTextField() || drill) return
      if (e.altKey || e.metaKey || e.ctrlKey) return
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        up()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        down()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [up, down, drill])

  // No vertical swipe-to-change-altitude: it fought the content scroll on touch
  // (a swipe to read further down also jumped altitude, which felt inverted).
  // The When owns altitude and period now — in the bar, or under the title on a
  // phone — where the climb rail, its ↑ ↓, the month pills, the year tabs and
  // the ascend / descend row used to share the job between them.

  // The year's ledger (alpha): the climb told back, named by the calendar.
  const ledgerOn = useFeatureFlag('yearLedger') || ALLOWS_INTERNAL_UI
  const today = todayIso()
  const told = ledgerOn && idx > 0

  // The period on show, from the one calendar — anchored on the writer's own
  // day (noon UTC of it), so a late evening never shows tomorrow's month.
  const anchor = useMemo(() => new Date(`${today}T12:00:00Z`), [today])
  const win = periodWindow(grain, offset, anchor)
  const fromIso = win.from.toISOString().slice(0, 10)
  const toIso = win.to.toISOString().slice(0, 10)
  const ym = fromIso.slice(0, 7)
  const season = seasonOf(fromIso)
  const shownYear = win.from.getUTCFullYear()

  // ONE MOUNTAIN over the whole climb: it stays mounted across altitudes, so
  // stepping up zooms the camera out rather than swapping the page, and stepping
  // back a period pans it.
  const level: Level = grain
  const [mFrom, mTo]: [string, string] = level === 'season' ? [season.from, season.to] : [fromIso, toIso]
  const mountainYear = +mTo.slice(0, 4)
  const [ledgerStones, setLedgerStones] = useState<{ year: number; stones: LedgerStone[] } | null>(null)
  useEffect(() => {
    if (!ledgerOn) return
    let alive = true
    loadYearLedger(mountainYear).then(
      (l) => alive && setLedgerStones({ year: mountainYear, stones: l.stones }),
      () => alive && setLedgerStones({ year: mountainYear, stones: [] }),
    )
    return () => {
      alive = false
    }
  }, [ledgerOn, mountainYear])

  // A past week is read when it is stepped to; the climb above holds only this one.
  const [pastWeek, setPastWeek] = useState<{ from: string; data: AltitudeData | null } | null>(null)
  useEffect(() => {
    if (idx !== 0 || offset === 0) return
    let alive = true
    loadWeekAt(periodWindow('week', offset, anchor)).then(
      (data) => alive && setPastWeek({ from: fromIso, data }),
      () => alive && setPastWeek({ from: fromIso, data: null }),
    )
    return () => {
      alive = false
    }
  }, [idx, offset, anchor, fromIso])

  // How far back the When may step: the Summit says which years have anything.
  const [summitYears, setSummitYears] = useState<number[] | null>(null)
  const maxOffset = useCallback(
    (g: Grain): number => {
      if (g === 'week') return 104
      if (!ledgerOn) return 0
      if (g === 'month') return 60
      if (g === 'season') return 20
      const oldest = summitYears && summitYears.length > 0 ? Math.min(...summitYears) : +today.slice(0, 4)
      return Math.max(0, +today.slice(0, 4) - oldest)
    },
    [ledgerOn, summitYears, today],
  )

  const L = ALTITUDES[idx]!
  const head = ledgerOn ? LEDGER_ALTITUDES[L.key] : { title: L.title, line: L.line }
  const loading = ascent === undefined

  const pushDrill = useCallback((next: AscentDrill) => go({ ascentDrill: next }), [go])
  const openScripture = useCallback(
    (osisRef: string) => pushDrill({ kind: 'scripture', osisRef }),
    [pushDrill],
  )
  // Drill-ins close themselves on Esc / scrim / Back (DrillSheet owns Escape and
  // stops it propagating). closeDrill pops the one pushed history frame.
  const closeDrill = useCallback(() => back(), [back])

  const mountainStones: LedgerStone[] =
    ledgerStones && ledgerStones.year === mountainYear && ledgerStones.stones.length > 0
      ? ledgerStones.stones
      : ascent && ascent.year.year === mountainYear
        ? ascent.year.stones.map((st) => ({ ...st, threadId: '' }))
        : []

  const pastWeekData = idx === 0 && offset > 0 ? (pastWeek && pastWeek.from === fromIso ? pastWeek : undefined) : null
  const altitude =
    pastWeekData !== null
      ? (pastWeekData?.data ?? null)
      : ascent
        ? [ascent.week, ascent.month, ascent.quarter, ascent.year][idx]!
        : null
  const weekReading = pastWeekData === undefined

  // While the import backfill is still building rollups, an empty altitude is
  // "not computed yet", not "nothing to say" — show honest progress instead.
  const { byKind } = useProcessingJobs()
  const reflectionsJob = byKind.reflections
  const altitudeEmpty = !altitude || (!altitude.words && !altitude.scripture)
  const backfilling = !told && offset === 0 && !!reflectionsJob && isActive(reflectionsJob.status) && altitudeEmpty

  // Fill in live: when the reflections backfill finishes, reload so the built
  // rollups appear without the user having to leave and come back.
  const reflectionsActive = reflectionsJob ? isActive(reflectionsJob.status) : false
  const wasActiveRef = useRef(reflectionsActive)
  useEffect(() => {
    if (wasActiveRef.current && !reflectionsActive) setReloadKey((k) => k + 1)
    wasActiveRef.current = reflectionsActive
  }, [reflectionsActive])

  // The light line: where the reader stands in the period on show — the
  // sentence the strip under the mountain used to say in grey, said once, up
  // here, in the light line every room keeps in the same place.
  const lightLine = !ledgerOn
    ? ''
    : grain === 'week'
      ? weekStrip(today, fromIso).note
      : grain === 'month'
        ? monthStrip(ym, today).note
        : grain === 'season'
          ? seasonStrip(season, today).note
          : offset === 0
            ? LEDGER_COPY.nowNote(MONTH_LONG[+today.slice(5, 7) - 1]!, shownYear)
            : `${shownYear} closed on Dec 31.`

  const when = (layout: 'bar' | 'row') => (
    <WhenControl
      spans={ALTITUDE_GRAIN}
      span={grain}
      offset={offset}
      onSpan={(span) => setAltitude(ALTITUDE_GRAIN.indexOf(span as Grain))}
      onOffset={setOffset}
      maxOffset={maxOffset}
      layout={layout}
      keys={layout === 'bar'}
      now={anchor}
    />
  )

  return (
    <div
      // `framed`: the frame's bar over the climb (see `.ascent--framed`). The
      // other places that draw the Ascent's parts (store shots, the flagship)
      // have no bar.
      className={`ascent ascent--framed${light ? ' ascent--light' : ''}`}
      // The sky's colours come from the palette (Ascent.css); this only says how
      // far up it is.
      data-altitude={L.key}
    >
      <div className="ascent-air" key={L.key} aria-hidden />
      <div className="ascent-stars" style={{ opacity: 1 - idx / LAST }} aria-hidden />
      <SurfaceBar label={ENTRY_RETURN_LABEL.reflections} when={when('bar')} />

      <div className="ascent-sr" aria-live="polite">
        {L.alt} — {periodName(grain, offset, anchor)}
      </div>

      <div className="ascent-scroll">
        <main className={`room-frame ascent-frame${ledgerOn ? ' is-wide' : ''}`}>
          <div className="ascent-rise" key={`${L.key}-h`}>
            <RoomHead
              eyebrow={periodEyebrow(grain, offset, anchor)}
              title={head.title.replace(/\.$/, '')}
              dek={head.line}
              light={lightLine}
              phoneWhen={when('row')}
            />
          </div>

          <div className="room-stage">
            {ledgerOn ? (
              <ClimbMountain level={level} from={mFrom} to={mTo} today={today} stones={mountainStones} onOpenEntry={onOpenEntry} />
            ) : null}
            {ledgerOn && idx === 0 ? (
              // The week gets what the month and season have: its name, then
              // where we stand in it and when it closes.
              <div className="climb">
                <h2 className="climb__title">{weekLabel(fromIso)}</h2>
                <NowStrip strip={weekStrip(today, fromIso)} />
              </div>
            ) : null}

            <SurfaceArrival surface="reflections" />

            {/* "Watching this season" belonged to the rollup lenses; the told-back
                climb reads its own threads, so the bar only confused the page. */}
            {ledgerOn ? null : <LensRow />}

            <div className="ascent-terrain" key={`${L.key}-t`}>
              {told && idx === 1 ? (
                <MonthView onOpenEntry={onOpenEntry} ym={ym} />
              ) : told && idx === 2 ? (
                <SeasonView onOpenEntry={onOpenEntry} season={season} />
              ) : loading || weekReading ? (
                <SurfaceLoader label="Reading the land…" />
              ) : backfilling ? (
                <SurfaceLoader
                  label="Preparing your reflections…"
                  progress={{ completed: reflectionsJob!.completed, total: reflectionsJob!.total }}
                />
              ) : idx < LAST ? (
                <AltitudeBands
                  words={altitude?.words ?? null}
                  scripture={altitude?.scripture ?? null}
                  onScriptureDrill={openScripture}
                  onOpenEntry={onOpenEntry}
                />
              ) : ascent ? (
                <Summit
                  view={ascent.year}
                  scripture={ascent.year.scripture}
                  onScriptureDrill={openScripture}
                  onOpenEntry={onOpenEntry}
                  year={shownYear}
                  onYears={setSummitYears}
                />
              ) : (
                <p className="ascent-empty">{EMPTY_COPY.year.empty}</p>
              )}
            </div>
          </div>
        </main>
      </div>

      {drill?.kind === 'band' ? (
        <BandDrillIn
          bandId={drill.bandId}
          bandKind={drill.bandKind}
          label={drill.label}
          onClose={closeDrill}
        />
      ) : null}
      {drill?.kind === 'scripture' && ascent ? (
        <ScriptureDrillIn
          osisRef={drill.osisRef}
          windows={ascent.windows}
          onClose={closeDrill}
          onOpenEntry={onOpenEntry}
        />
      ) : null}
    </div>
  )
}
