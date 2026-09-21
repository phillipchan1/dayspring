import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SUMMIT_COPY } from '../ascent.config'
import type { LedgerStone } from './build'
import { MONTH_LONG, MONTH_SHORT } from './copy'
import { cameraFor, easeInOut, elev, farRidge, tMid, tOf, tween, type Camera, type Level } from './mountain'

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ZOOM_MS = 950
const RIDGE_UP = 22 // the ridge line sits this far above the trail, in screen px

/**
 * Below this the mountain is a phone's width, and the labels have to give way.
 *
 * Every mark on this trail is drawn AT the point it names, which on a desktop
 * width leaves them tens of pixels apart and on a 393px iPhone piles them into
 * each other — twelve months, or seven days with their dates under them, inside
 * ~330px of trail that is also climbing diagonally. So at this width the labels
 * thin out (every other month, the day without its month) rather than shrink,
 * which would only make an unreadable pile a smaller one.
 */
const NARROW = 520

/** Roughly how wide a mono label is, per character, at the sizes used here. */
const CH = 6.2

/**
 * How far a label is kept off the edge of the scene.
 *
 * Wider than it looks like it needs to be, because `.climb-mtn__scene` is an
 * 18px-rounded box with `overflow: hidden` — and the two labels that end up in
 * a corner are January (bottom left, where the trail starts at the foot) and a
 * period's closing flag (top right). Clearing the straight edge is not enough;
 * this clears the curve.
 */
const EDGE = 12

/**
 * How close to the "you are here" marker a tick label may come before it is
 * dropped. The marker is the one label on the mountain that must always be
 * readable, and on a narrow trail the nearest month tick lands under it.
 */
const NOW_CLEARANCE = 46

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const short = (iso: string) => `${MONTH_SHORT[+iso.slice(5, 7) - 1]} ${+iso.slice(8, 10)}`
const fmt = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

/** The camera, eased toward its target whenever the period changes. */
function useCamera(target: Camera): Camera {
  const [cam, setCam] = useState(target)
  const camRef = useRef(cam)
  camRef.current = cam
  const key = `${target.t0}|${target.t1}|${target.y0}|${target.y1}`
  useEffect(() => {
    const from = camRef.current
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setCam(target)
      return
    }
    const start = performance.now()
    let raf = 0
    const step = (now: number) => {
      const k = easeInOut(Math.min(1, (now - start) / ZOOM_MS))
      setCam(tween(from, target, k))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return cam
}

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/**
 * THE CLIMB — one mountain for the whole year, seen from each altitude. The
 * year is the whole peak (Jan 1 at the foot, Dec 31 at the top); the season
 * is its shoulder, the month one stretch of trail, the week seven stepping
 * stones at your feet. The trail behind you is lit, a flag marks where this
 * chapter closes, and the stones — a prayer met by a later moment — are the
 * only marks the writer makes on it.
 */
export function ClimbMountain({
  level,
  from,
  to,
  today,
  stones,
  onOpenEntry,
}: {
  level: Level
  /** The period in view, inclusive YYYY-MM-DD. */
  from: string
  to: string
  today: string
  stones: LedgerStone[]
  onOpenEntry?: ((entryId: string) => void) | undefined
}) {
  // The climb is the year the period ends in; winter's December is the
  // ground before the foot.
  const year = +to.slice(0, 4)
  const cam = useCamera(cameraFor(level, from, to, year))
  const [ref, W] = useWidth()
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => setOpen(null), [level, from])

  const H = W > 0 && W < 600 ? 210 : 270
  const narrow = W > 0 && W < NARROW
  const X = (t: number) => ((t - cam.t0) / (cam.t1 - cam.t0)) * W
  const Y = (e: number) => H - ((e - cam.y0) / (cam.y1 - cam.y0)) * H
  const at = (t: number): [number, number] => [X(t), Y(elev(t))]
  const inView = (t: number) => t >= cam.t0 && t <= cam.t1
  const tNow = tMid(today, year)
  const pa = tOf(from, year)
  const pb = tOf(to, year) + 1 / 365

  const pts = (a: number, b: number, dy = 0) => {
    const lo = Math.max(a, cam.t0)
    const hi = Math.min(b, cam.t1)
    if (hi <= lo) return ''
    const n = Math.max(2, Math.ceil((260 * (hi - lo)) / (cam.t1 - cam.t0)))
    const out: string[] = []
    for (let i = 0; i <= n; i++) {
      const [x, y] = at(lo + ((hi - lo) * i) / n)
      out.push(`${x.toFixed(1)},${(y + dy).toFixed(1)}`)
    }
    return out.join(' ')
  }
  const far = (seed: number, base: number, amp: number, par: number) => {
    const cx = ((cam.t0 + cam.t1) / 2) * 4000 * par
    const out: string[] = []
    for (let x = 0; x <= W; x += 8) out.push(`${x},${(H * base - amp * farRidge(x + cx, seed)).toFixed(1)}`)
    return `0,${H} ${out.join(' ')} ${W},${H}`
  }

  /**
   * A label kept inside the scene.
   *
   * SVG text is simply clipped at the viewBox edge, and the first and last mark
   * on a phone-width mountain (January, Dec 31, the flag at a month's close) sit
   * right on it — so January read as "Ian". Pin those to the edge and let them
   * anchor from it instead of centring into the crop.
   */
  const fit = (x: number, text: string, size = CH): { x: number; anchor: 'start' | 'middle' | 'end' } => {
    const half = (text.length * size) / 2
    if (x - half < EDGE) return { x: EDGE, anchor: 'start' }
    if (x + half > W - EDGE) return { x: W - EDGE, anchor: 'end' }
    return { x, anchor: 'middle' }
  }
  /** A label's baseline, kept off the bottom edge for the same reason as `fit`. */
  const below = (y: number, drop: number) => Math.min(y + drop, H - 7)

  const ticks: { t: number; label: string; big?: boolean; size: number }[] = []
  if (level === 'year') {
    for (let m = 0; m < 12; m++) {
      // Twelve month names over ~330px of climbing trail overlap into a smear;
      // every other one still says which end of the year you are looking at.
      ticks.push({ t: tOf(`${year}-${String(m + 1).padStart(2, '0')}-01`, year), label: narrow && m % 2 === 1 ? '' : MONTH_SHORT[m]!, big: true, size: 4 })
    }
  } else if (level === 'season') {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const first = d.endsWith('-01')
      const monday = new Date(`${d}T00:00:00Z`).getUTCDay() === 1
      const month = +d.slice(5, 7) - 1
      if (first) ticks.push({ t: tOf(d, year), label: (narrow ? MONTH_SHORT[month] : MONTH_LONG[month])!, big: true, size: 6 })
      else if (monday) ticks.push({ t: tOf(d, year), label: '', size: 2.5 })
    }
  } else if (level === 'month') {
    const n = +to.slice(8, 10)
    for (let i = 1; i <= n; i++) {
      const d = `${from.slice(0, 8)}${String(i).padStart(2, '0')}`
      const lab = [1, 8, 15, 22, n].includes(i) ? String(i) : ''
      ticks.push({ t: tMid(d, year), label: lab, size: lab ? 4 : 2.5 })
    }
  }

  const visibleStones = stones.filter((s) => s.later.date <= today && inView(tMid(s.later.date, year)))
  const openStone = stones.find((s) => s.id === open) ?? null

  return (
    <div className="climb-mtn">
      <div ref={ref} className="climb-mtn__scene" style={{ height: H }}>
        {W > 0 ? (
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`Where you stand: ${from} to ${to}`}>
            <defs>
              <linearGradient id="climb-rock" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--climb-rock-top)" />
                <stop offset="100%" stopColor="var(--climb-rock-bottom)" />
              </linearGradient>
              <radialGradient id="climb-glow">
                <stop offset="0%" stopColor="var(--ascent-gold)" stopOpacity="0.55" />
                <stop offset="100%" stopColor="var(--ascent-gold)" stopOpacity="0" />
              </radialGradient>
            </defs>
            <polygon points={far(1.3, 0.42, 36, 0.15)} fill="var(--climb-far-1)" />
            <polygon points={far(4.1, 0.58, 30, 0.35)} fill="var(--climb-far-2)" />
            <polygon points={`0,${H} ${pts(cam.t0, cam.t1, -RIDGE_UP)} ${W},${H}`} fill="url(#climb-rock)" />

            {level !== 'year' ? (
              <polygon
                points={`${X(Math.max(pa, cam.t0))},${H} ${pts(pa, pb, -RIDGE_UP)} ${X(Math.min(pb, cam.t1))},${H}`}
                fill="var(--ascent-gold)"
                opacity="0.07"
              />
            ) : null}

            <polyline points={pts(-0.2, 1)} fill="none" stroke="var(--climb-trail)" strokeWidth="1.4" strokeDasharray="2 5" />
            <polyline points={pts(-1, Math.min(tNow, 2))} fill="none" stroke="var(--ascent-gold)" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />

            {ticks.filter((k) => inView(k.t)).map((k) => {
              const [x, y] = at(k.t)
              // "you are here" is the one label that must survive a collision;
              // a month tick sitting under it loses its name, not its mark.
              const underNow = narrow && level !== 'week' && inView(tNow) && Math.abs(x - X(tNow)) < NOW_CLEARANCE
              const lbl = k.label && !underNow ? fit(x, k.label) : null
              return (
                <g key={k.t}>
                  <line x1={x} y1={y - k.size} x2={x} y2={y + k.size} stroke="var(--climb-tick)" />
                  {lbl ? (
                    <text className={`climb-mtn__lbl${k.big ? ' is-big' : ''}`} x={lbl.x} y={below(y, level === 'season' ? 22 : 18)} textAnchor={lbl.anchor}>
                      {k.label}
                    </text>
                  ) : null}
                </g>
              )
            })}

            {level === 'week'
              ? Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(from, i)
                  const [x, y] = at(tMid(d, year))
                  const past = d < today
                  const now = d === today
                  // A stepping stone should read as one. `W / 36` is right from
                  // a tablet up and collapses to a 9px dash on a phone, where
                  // the days are still ~36px apart — so it gets a floor rather
                  // than a new formula, and desktop is left exactly as it was.
                  const rx = Math.max(13, Math.min(34, W / 36))
                  // "Sep 22" under every stone is ~37px of text in a ~36px slot,
                  // and the trail's rise slides each one under its neighbour. The
                  // month is already in the heading above; the day is not.
                  const under = narrow ? String(+d.slice(8, 10)) : short(d)
                  const name = fit(x, now ? 'today' : WEEKDAY[i]!)
                  const day = fit(x, under)
                  // Two lines, clamped as a pair — clamping each would stack
                  // the day on top of its own weekday at the foot of the trail.
                  const base = Math.min(y + 26, H - 20)
                  return (
                    <g key={d}>
                      <ellipse
                        cx={x}
                        cy={y + 2}
                        rx={rx}
                        ry={7}
                        fill={past || now ? 'var(--ascent-gold)' : 'none'}
                        fillOpacity={now ? 0.95 : 0.55}
                        stroke={past || now ? 'none' : 'rgba(var(--ascent-glow-rgb), 0.6)'}
                        strokeDasharray="3 3"
                      />
                      <text className={`climb-mtn__lbl${now ? ' is-now' : ''}`} x={name.x} y={base} textAnchor={name.anchor}>
                        {now ? 'today' : WEEKDAY[i]}
                      </text>
                      <text className="climb-mtn__lbl is-faint" x={day.x} y={base + 13} textAnchor={day.anchor}>
                        {under}
                      </text>
                    </g>
                  )
                })
              : null}

            {level === 'year' && inView(1)
              ? (() => {
                  const px = X(1)
                  const py = Y(elev(1)) - RIDGE_UP
                  const lbl = fit(px, 'Dec 31')
                  return (
                    <g>
                      <circle cx={px} cy={py} r={30} fill="url(#climb-glow)" opacity={0.35 + 0.65 * Math.min(1, Math.max(0, tNow))} />
                      <circle cx={px} cy={py} r={4.5} fill="var(--ascent-gold)" />
                      <text className="climb-mtn__lbl is-big" x={lbl.x} y={py - 14} textAnchor={lbl.anchor}>
                        Dec 31
                      </text>
                    </g>
                  )
                })()
              : null}

            {level !== 'year' && inView(pb)
              ? (() => {
                  const [x, y] = at(pb)
                  const text = today > to ? `closed ${short(to)}` : `closes ${short(to)}`
                  const lbl = fit(x, text)
                  return (
                    <g opacity={0.75}>
                      <line x1={x} y1={y} x2={x} y2={y - 34} stroke="var(--ascent-gold)" strokeWidth={1.2} />
                      <path d={`M${x},${y - 34} l14,5 l-14,5 z`} fill="var(--ascent-gold)" />
                      <text className="climb-mtn__lbl is-big" x={lbl.x} y={y - 42} textAnchor={lbl.anchor}>
                        {text}
                      </text>
                    </g>
                  )
                })()
              : null}

            {visibleStones.map((s) => {
              const [x, y] = at(tMid(s.later.date, year))
              const on = s.id === open
              return (
                <g
                  key={s.id}
                  className="climb-mtn__stone"
                  role="button"
                  tabIndex={0}
                  aria-label={SUMMIT_COPY.stoneLabel(fmt(s.later.date))}
                  aria-pressed={on}
                  onClick={() => setOpen(on ? null : s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setOpen(on ? null : s.id)
                    }
                  }}
                >
                  {/* The stone itself is ~7px across. This is the thumb's target:
                      44px on touch, where there is no cursor to aim with. */}
                  <circle cx={x} cy={y} r={narrow ? 22 : 16} fill="transparent" />
                  <circle cx={x} cy={y} r={on ? 14 : 10} fill="url(#climb-glow)" />
                  <circle cx={x - 1.5} cy={y - 1.5} r={3.2} fill="var(--ascent-gold)" />
                  <circle cx={x + 1.6} cy={y + 1.6} r={3.6} fill="var(--ascent-gold)" opacity={0.6} />
                  <circle cx={x} cy={y - 6} r={2.2} fill="var(--ascent-peak)" />
                </g>
              )
            })}

            {inView(tNow) && today <= to && today >= from ? (
              <g>
                <circle cx={X(tNow)} cy={Y(elev(tNow))} r={14} fill="url(#climb-glow)" className="climb-mtn__breathe" />
                <circle cx={X(tNow)} cy={Y(elev(tNow))} r={5} fill="var(--ascent-gold)" stroke="var(--ascent-peak)" strokeWidth={2} />
                {level !== 'week'
                  ? (() => {
                      const lbl = fit(X(tNow), 'you are here')
                      return (
                        <text className="climb-mtn__lbl is-now is-big" x={lbl.x} y={Y(elev(tNow)) - 16} textAnchor={lbl.anchor}>
                          you are here
                        </text>
                      )
                    })()
                  : null}
              </g>
            ) : null}
          </svg>
        ) : null}
      </div>

      {openStone ? (
        <div className="ascent-stone-pair">
          <div className="ascent-stone-pair__part">
            <span className="ascent-oneline__date">
              {fmt(openStone.ask.date)} · {SUMMIT_COPY.stoneAsk}
            </span>
            <button type="button" className="ascent-stone-pair__text" onClick={() => onOpenEntry?.(openStone.ask.entryId)}>
              “{openStone.ask.text}”
            </button>
          </div>
          <div className="ascent-stone-pair__part">
            <span className="ascent-oneline__date">
              {fmt(openStone.later.date)} · {SUMMIT_COPY.stoneLater}
            </span>
            <button type="button" className="ascent-stone-pair__text" onClick={() => onOpenEntry?.(openStone.later.entryId)}>
              “{openStone.later.text}”
            </button>
          </div>
          <button type="button" className="ascent-stone-pair__close" onClick={() => setOpen(null)}>
            {SUMMIT_COPY.stoneClose}
          </button>
        </div>
      ) : null}
    </div>
  )
}
