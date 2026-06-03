import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppNavigation } from '@/context/AppNavigation'
import type { AscentDrill } from '@/lib/appHistory'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { ALTITUDES, CONTROLS } from './ascent.config'
import { loadAscent, type LoadedAscent } from './data'
import type { AltitudeData, Theme } from './data/types'
import { Hillside } from './Hillside'
import { LensRow } from './LensRow'
import { Ridge } from './Ridge'
import { Summit } from './Summit'
import { Valley } from './Valley'
import { LearningDrillIn } from './drilldowns/LearningDrillIn'
import { PrayerDrillIn } from './drilldowns/PrayerDrillIn'
import { ScriptureDrillIn } from './drilldowns/ScriptureDrillIn'
import { ThemeDrillIn } from './drilldowns/ThemeDrillIn'
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

function findTheme(data: AltitudeData | null, themeId: string): Theme | null {
  return data?.words?.themes.find((t) => t.id === themeId) ?? null
}
const SWIPE_THRESHOLD = 56

/** True when focus is in a text field — so arrow keys don't hijack typing. */
function inTextField(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable
}

/** Light (dawn) vs night palette, reacting live to the <html data-theme> switch. */
function useIsLightTheme(): boolean {
  const [light, setLight] = useState(() => document.documentElement.dataset.theme === 'dawn')
  useEffect(() => {
    const el = document.documentElement
    const update = () => setLight(el.dataset.theme === 'dawn')
    update()
    const obs = new MutationObserver(update)
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
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

  useEffect(() => {
    let alive = true
    loadAscent().then(
      (d) => alive && setAscent(d),
      () => alive && setAscent(null),
    )
    return () => {
      alive = false
    }
  }, [])

  const setAltitude = useCallback(
    (next: number) => go({ ascentAltitude: clampAltitude(next) }, { replace: true }),
    [go],
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

  // Vertical swipe: up = ascend, down = descend.
  const touchY = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    touchY.current = e.touches[0]?.clientY ?? null
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchY.current
    touchY.current = null
    if (start == null || drill) return
    const dy = (e.changedTouches[0]?.clientY ?? start) - start
    if (dy <= -SWIPE_THRESHOLD) up()
    else if (dy >= SWIPE_THRESHOLD) down()
  }

  const L = ALTITUDES[idx]!
  const loading = ascent === undefined
  const air = light ? L.airLight : L.air

  const pushDrill = useCallback((next: AscentDrill) => go({ ascentDrill: next }), [go])
  const openScripture = useCallback(
    (osisRef: string) => pushDrill({ kind: 'scripture', osisRef }),
    [pushDrill],
  )
  const openPrayer = useCallback(() => pushDrill({ kind: 'prayer' }), [pushDrill])
  const openLearning = useCallback(() => pushDrill({ kind: 'learning' }), [pushDrill])
  const openTheme = useCallback(
    (theme: Theme) => pushDrill({ kind: 'theme', themeId: theme.id }),
    [pushDrill],
  )
  const closeDrill = useCallback(() => back(), [back])

  // Esc closes a drill-in (browser / mouse Back use the same history frame).
  useEffect(() => {
    if (!drill) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || inTextField()) return
      e.preventDefault()
      closeDrill()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [drill, closeDrill])

  const altitude = ascent ? [ascent.week, ascent.month, ascent.quarter, ascent.year][idx]! : null
  const themeDrill =
    drill?.kind === 'theme' ? findTheme(altitude, drill.themeId) : null

  return (
    <div
      className={`ascent${light ? ' ascent--light' : ''}`}
      style={{ '--a0': air[0], '--a1': air[1] } as React.CSSProperties}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
        </header>

        <LensRow />

        <div className="ascent-terrain" key={`${L.key}-t`}>
          {loading ? (
            <SurfaceLoader label="Reading the land…" />
          ) : idx === 0 ? (
            <Valley
              data={altitude}
              onOpenEntry={onOpenEntry}
              onScriptureDrill={openScripture}
              onThemeDrill={openTheme}
            />
          ) : idx === 1 ? (
            <Hillside
              data={altitude}
              onOpenEntry={onOpenEntry}
              onScriptureDrill={openScripture}
              onPrayerDrill={openPrayer}
              onLearningDrill={openLearning}
              onThemeDrill={openTheme}
            />
          ) : idx === 2 ? (
            <Ridge
              data={altitude}
              onOpenEntry={onOpenEntry}
              onScriptureDrill={openScripture}
              onPrayerDrill={openPrayer}
              onLearningDrill={openLearning}
              onThemeDrill={openTheme}
            />
          ) : (
            <Summit
              data={ascent?.year ?? null}
              onOpenEntry={onOpenEntry}
              onScriptureDrill={openScripture}
              onPrayerDrill={openPrayer}
              onLearningDrill={openLearning}
              onThemeDrill={openTheme}
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

      {drill?.kind === 'scripture' && ascent ? (
        <ScriptureDrillIn
          osisRef={drill.osisRef}
          windows={ascent.windows}
          onClose={closeDrill}
          onOpenEntry={onOpenEntry}
        />
      ) : null}
      {drill?.kind === 'learning' && altitude?.learning ? (
        <LearningDrillIn data={altitude.learning} onClose={closeDrill} onOpenEntry={onOpenEntry} />
      ) : null}
      {drill?.kind === 'prayer' && altitude?.prayer ? (
        <PrayerDrillIn data={altitude.prayer} onClose={closeDrill} onOpenEntry={onOpenEntry} />
      ) : null}
      {themeDrill ? (
        <ThemeDrillIn data={themeDrill} onClose={closeDrill} onOpenEntry={onOpenEntry} />
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
