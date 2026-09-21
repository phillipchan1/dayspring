import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SUMMIT_COPY } from '../ascent.config'
import type { LedgerStone } from './build'
import { MONTH_LONG, MONTH_SHORT } from './copy'
import { cameraFor, easeInOut, elev, farRidge, tMid, tOf, tween, type Camera, type Level } from './mountain'

const WEEKDAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ZOOM_MS = 950
const RIDGE_UP = 22 // the ridge line sits this far above the trail, in screen px

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

  const ticks: { t: number; label: string; big?: boolean; size: number }[] = []
  if (level === 'year') {
    for (let m = 0; m < 12; m++) ticks.push({ t: tOf(`${year}-${String(m + 1).padStart(2, '0')}-01`, year), label: MONTH_SHORT[m]!, big: true, size: 4 })
  } else if (level === 'season') {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const first = d.endsWith('-01')
      const monday = new Date(`${d}T00:00:00Z`).getUTCDay() === 1
      if (first) ticks.push({ t: tOf(d, year), label: MONTH_LONG[+d.slice(5, 7) - 1]!, big: true, size: 6 })
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
              return (
                <g key={k.t}>
                  <line x1={x} y1={y - k.size} x2={x} y2={y + k.size} stroke="var(--climb-tick)" />
                  {k.label ? (
                    <text className={`climb-mtn__lbl${k.big ? ' is-big' : ''}`} x={x} y={y + (level === 'season' ? 22 : 18)} textAnchor="middle">
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
                  return (
                    <g key={d}>
                      <ellipse
                        cx={x}
                        cy={y + 2}
                        rx={Math.min(34, W / 36)}
                        ry={7}
                        fill={past || now ? 'var(--ascent-gold)' : 'none'}
                        fillOpacity={now ? 0.95 : 0.55}
                        stroke={past || now ? 'none' : 'rgba(var(--ascent-glow-rgb), 0.6)'}
                        strokeDasharray="3 3"
                      />
                      <text className={`climb-mtn__lbl${now ? ' is-now' : ''}`} x={x} y={y + 26} textAnchor="middle">
                        {now ? 'today' : WEEKDAY[i]}
                      </text>
                      <text className="climb-mtn__lbl is-faint" x={x} y={y + 39} textAnchor="middle">
                        {short(d)}
                      </text>
                    </g>
                  )
                })
              : null}

            {level === 'year' && inView(1)
              ? (() => {
                  const px = X(1)
                  const py = Y(elev(1)) - RIDGE_UP
                  return (
                    <g>
                      <circle cx={px} cy={py} r={30} fill="url(#climb-glow)" opacity={0.35 + 0.65 * Math.min(1, Math.max(0, tNow))} />
                      <circle cx={px} cy={py} r={4.5} fill="var(--ascent-gold)" />
                      <text className="climb-mtn__lbl is-big" x={px} y={py - 14} textAnchor="middle">
                        Dec 31
                      </text>
                    </g>
                  )
                })()
              : null}

            {level !== 'year' && inView(pb)
              ? (() => {
                  const [x, y] = at(pb)
                  return (
                    <g opacity={0.75}>
                      <line x1={x} y1={y} x2={x} y2={y - 34} stroke="var(--ascent-gold)" strokeWidth={1.2} />
                      <path d={`M${x},${y - 34} l14,5 l-14,5 z`} fill="var(--ascent-gold)" />
                      <text className="climb-mtn__lbl is-big" x={x} y={y - 42} textAnchor="middle">
                        {today > to ? `closed ${short(to)}` : `closes ${short(to)}`}
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
                  <circle cx={x} cy={y} r={16} fill="transparent" />
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
                {level !== 'week' ? (
                  <text className="climb-mtn__lbl is-now is-big" x={X(tNow)} y={Y(elev(tNow)) - 16} textAnchor="middle">
                    you are here
                  </text>
                ) : null}
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
