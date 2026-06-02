import { useCallback, useEffect, useRef, useState } from 'react'
import { SurfaceLoader } from '@/components/SurfaceLoader'
import { ALTITUDES, CONTROLS } from './ascent.config'
import {
  loadHillside,
  loadRidge,
  loadValley,
  type HillsideData,
  type RidgeData,
  type ValleyData,
} from './ascentData'
import { loadSummit, type SummitData } from './summitData'
import { Valley } from './Valley'
import { Hillside } from './Hillside'
import { Ridge } from './Ridge'
import { Summit } from './Summit'
import './Ascent.css'

interface Props {
  onOpenEntry?: ((entryId: string) => void) | undefined
}

/** undefined = loading, null = loaded-but-empty, value = ready. */
type Loaded<T> = T | null | undefined

const LAST = ALTITUDES.length - 1
const SWIPE_THRESHOLD = 56

/** True when focus is in a text field — so arrow keys don't hijack typing. */
function inTextField(): boolean {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || (el as HTMLElement).isContentEditable
}

/** Track the active palette so the Ascent gets a daybreak (light) treatment under
 *  the `dawn` theme and its night treatment under dark themes. Reacts live to
 *  theme switches via the `data-theme` attribute App sets on <html>. */
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
 * (Valley → Hillside → Ridge → Summit) on one mountain; climbing is the
 * synthesis. The higher you go, the less the app interprets.
 */
export function AscentView({ onOpenEntry }: Props) {
  const [idx, setIdx] = useState(0)
  const light = useIsLightTheme()
  const [valley, setValley] = useState<Loaded<ValleyData>>(undefined)
  const [hillside, setHillside] = useState<Loaded<HillsideData>>(undefined)
  const [ridge, setRidge] = useState<Loaded<RidgeData>>(undefined)
  const [summit, setSummit] = useState<Loaded<SummitData>>(undefined)

  useEffect(() => {
    let alive = true
    loadValley().then((d) => alive && setValley(d), () => alive && setValley(null))
    loadHillside().then((d) => alive && setHillside(d), () => alive && setHillside(null))
    loadRidge().then((d) => alive && setRidge(d), () => alive && setRidge(null))
    loadSummit().then((d) => alive && setSummit(d), () => alive && setSummit(null))
    return () => {
      alive = false
    }
  }, [])

  const up = useCallback(() => setIdx((v) => Math.min(v + 1, LAST)), [])
  const down = useCallback(() => setIdx((v) => Math.max(v - 1, 0)), [])

  // ↑/↓ keys ascend/descend (unless typing in a field).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (inTextField()) return
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
  }, [up, down])

  // Vertical swipe: swipe up = ascend, swipe down = descend.
  const touchY = useRef<number | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    touchY.current = e.touches[0]?.clientY ?? null
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchY.current
    touchY.current = null
    if (start == null) return
    const dy = (e.changedTouches[0]?.clientY ?? start) - start
    if (dy <= -SWIPE_THRESHOLD) up()
    else if (dy >= SWIPE_THRESHOLD) down()
  }

  const L = ALTITUDES[idx]!
  const loading = [valley, hillside, ridge, summit][idx] === undefined
  const air = light ? L.airLight : L.air

  return (
    <div
      className={`ascent${light ? ' ascent--light' : ''}`}
      style={{ '--a0': air[0], '--a1': air[1] } as React.CSSProperties}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="ascent-air" key={L.key} aria-hidden />
      <div className="ascent-stars" style={{ opacity: 1 - idx / LAST }} aria-hidden />

      {/* live announcement of the current altitude for screen readers */}
      <div className="ascent-sr" aria-live="polite">
        {L.alt} — {L.label}
      </div>

      <ClimbRail idx={idx} setIdx={setIdx} />

      <main className="ascent-main">
        <header className="ascent-head" key={`${L.key}-h`}>
          <span className="ascent-eyebrow">{L.alt}</span>
          <h1 className="ascent-title">{L.title}</h1>
          <p className="ascent-line">{L.line}</p>
        </header>

        <div className="ascent-terrain" key={`${L.key}-t`}>
          {loading ? (
            <SurfaceLoader label="Reading the land…" />
          ) : idx === 0 ? (
            <Valley data={valley ?? null} meta={L} onOpenEntry={onOpenEntry} />
          ) : idx === 1 ? (
            <Hillside data={hillside ?? null} meta={L} />
          ) : idx === 2 ? (
            <Ridge data={ridge ?? null} meta={L} />
          ) : (
            <Summit data={summit ?? null} onOpenEntry={onOpenEntry} />
          )}
        </div>

        <div className="ascent-ctrl">
          <button type="button" className="ascent-ctrl-btn" onClick={down} disabled={idx === 0}>
            {CONTROLS.descend}
          </button>
          <span className="ascent-ctrl-alt">
            {idx === LAST ? CONTROLS.atSummit : CONTROLS.toNext(ALTITUDES[idx + 1]!.label)}
          </span>
          <button
            type="button"
            className="ascent-ctrl-btn up"
            onClick={up}
            disabled={idx === LAST}
          >
            {CONTROLS.ascend}
          </button>
        </div>
      </main>
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
