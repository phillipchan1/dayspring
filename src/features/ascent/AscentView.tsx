import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppNavigation } from '@/context/AppNavigation'
import type { AscentDrill } from '@/lib/appHistory'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { SurfaceArrival } from '@/features/journal/SurfaceArrival'
import { useProcessingJobs, isActive } from '@/hooks/useProcessingJobs'
import { ALTITUDES, CONTROLS } from './ascent.config'
import { track } from '@/lib/analytics'
import { loadAscent, type LoadedAscent } from './data'
import { AltitudeBands } from './AltitudeBands'
import { LensRow } from './LensRow'
import { Summit } from './Summit'
import { BandDrillIn } from './drilldowns/BandDrillIn'
import { ScriptureDrillIn } from './drilldowns/ScriptureDrillIn'
import './Ascent.css'

interface Props {
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/** undefined = loading, null = failed/empty, value = ready. */
type Loaded<T> = T | null | undefined

const LAST = ALTITUDES.length - 1

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
 * (Valley → Hillside → Ridge → Summit) on one mountain; the SAME four dimensions
 * persist and only change resolution. The volume INVERTS as you climb: the
 * higher you go, the more it is the user's own words and the less the app speaks.
 */
export function AscentView({ onOpenEntry }: Props) {
  const { state, go, back } = useAppNavigation()
  const idx = clampAltitude(state.ascentAltitude)
  const drill = state.ascentDrill
  const light = useIsLightTheme()
  const [ascent, setAscent] = useState<Loaded<LoadedAscent>>(undefined)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let alive = true
    loadAscent().then(
      (d) => alive && setAscent(d),
      () => alive && setAscent(null),
    )
    return () => {
      alive = false
    }
  }, [reloadKey])

  const setAltitude = useCallback(
    (next: number) => {
      const clamped = clampAltitude(next)
      // Only on an actual move. ↑ at the Summit clamps back to the Summit, and
      // the rail's current station is still a button — both would otherwise
      // report a climb that never happened, inflating the one signal VISION
      // Bet 1 rests on.
      //
      // Reported by internal key (week/month/quarter/year), never by the
      // terrain names in ascent.config — those are display copy.
      if (clamped !== idx) {
        track('ascent_altitude_changed', { altitude: ALTITUDES[clamped]!.key })
      }
      go({ ascentAltitude: clamped }, { replace: true })
    },
    [go, idx],
  )
  const up = useCallback(() => setAltitude(idx + 1), [idx, setAltitude])
  const down = useCallback(() => setAltitude(idx - 1), [idx, setAltitude])

  // ↑/↓ ascend/descend — unless typing or a drill-in is open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (inTextField() || drill) return
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
  // The fixed climb rail and the sticky ascend/descend controls own altitude now.

  const L = ALTITUDES[idx]!
  const loading = ascent === undefined
  const air = light ? L.airLight : L.air

  const pushDrill = useCallback((next: AscentDrill) => go({ ascentDrill: next }), [go])
  const openScripture = useCallback(
    (osisRef: string) => pushDrill({ kind: 'scripture', osisRef }),
    [pushDrill],
  )
  // Drill-ins close themselves on Esc / scrim / Back (DrillSheet owns Escape and
  // stops it propagating). closeDrill pops the one pushed history frame.
  const closeDrill = useCallback(() => back(), [back])

  const altitude = ascent ? [ascent.week, ascent.month, ascent.quarter, ascent.year][idx]! : null

  // While the import backfill is still building rollups, an empty altitude is
  // "not computed yet", not "nothing to say" — show honest progress instead.
  const { byKind } = useProcessingJobs()
  const reflectionsJob = byKind.reflections
  const altitudeEmpty = !altitude || (!altitude.words && !altitude.scripture)
  const backfilling = !!reflectionsJob && isActive(reflectionsJob.status) && altitudeEmpty

  // Fill in live: when the reflections backfill finishes, reload so the built
  // rollups appear without the user having to leave and come back.
  const reflectionsActive = reflectionsJob ? isActive(reflectionsJob.status) : false
  const wasActiveRef = useRef(reflectionsActive)
  useEffect(() => {
    if (wasActiveRef.current && !reflectionsActive) setReloadKey((k) => k + 1)
    wasActiveRef.current = reflectionsActive
  }, [reflectionsActive])

  return (
    <div
      className={`ascent${light ? ' ascent--light' : ''}`}
      style={{ '--a0': air[0], '--a1': air[1] } as React.CSSProperties}
    >
      <div className="ascent-air" key={L.key} aria-hidden />
      <div className="ascent-stars" style={{ opacity: 1 - idx / LAST }} aria-hidden />

      <div className="ascent-sr" aria-live="polite">
        {L.alt} — {L.label}
      </div>

      <ClimbRail idx={idx} setIdx={setAltitude} />

      <div className="ascent-scroll">
      <main className="ascent-main">
        <header className="ascent-head" key={`${L.key}-h`}>
          <span className="ascent-eyebrow">{L.alt}</span>
          <h1 className="ascent-title">{L.title}</h1>
          <p className="ascent-line">{L.line}</p>
          {altitude?.words?.periodLabel ? (
            <p className="ascent-period">
              {altitude.words.periodLabel}
              {idx === 0 ? ' · refreshed daily' : ''}
            </p>
          ) : null}
        </header>

        <SurfaceArrival surface="reflections" />

        <LensRow />

        <div className="ascent-terrain" key={`${L.key}-t`}>
          {loading ? (
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
          ) : (
            <Summit
              words={ascent?.year?.words ?? null}
              scripture={ascent?.year?.scripture ?? null}
              onScriptureDrill={openScripture}
              onOpenEntry={onOpenEntry}
            />
          )}
        </div>

        <div className="ascent-ctrl">
          <button type="button" className="ascent-ctrl-btn" onClick={down} disabled={idx === 0}>
            {CONTROLS.descend}
          </button>
          <span className="ascent-ctrl-alt">
            {idx === LAST ? CONTROLS.atSummit : CONTROLS.toNext(ALTITUDES[idx + 1]!.label)}
          </span>
          <button type="button" className="ascent-ctrl-btn up" onClick={up} disabled={idx === LAST}>
            {CONTROLS.ascend}
          </button>
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

function ClimbRail({ idx, setIdx }: { idx: number; setIdx: (i: number) => void }) {
  return (
    <nav className="ascent-rail" aria-label="Altitude">
      <div className="ascent-rail__track">
        <div className="ascent-rail__fill" style={{ height: `${(idx / LAST) * 100}%` }} aria-hidden />
        {ALTITUDES.map((l, i) => (
          <button
            key={l.key}
            type="button"
            className={`ascent-station${i === idx ? ' on' : ''}${i < idx ? ' below' : ''}`}
            style={{ bottom: `${(i / LAST) * 100}%` }}
            onClick={() => setIdx(i)}
            aria-current={i === idx ? 'true' : undefined}
            aria-label={`${l.alt} — ${l.label}`}
          >
            <span className="ascent-station__dot" aria-hidden />
            <span className="ascent-station__label">
              <em>{l.alt}</em>
              {l.label}
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
