/**
 * ONE MOUNTAIN — the geometry. The whole year is one climb: Jan 1 at the foot,
 * Dec 31 at the peak, the far side falling away after. Each altitude is a
 * CAMERA on the same mountain — the week is the ground at your feet, the year
 * is the whole peak — so stepping up the rail pulls back rather than swapping.
 *
 * Position is the calendar only. Nothing here reads what was written: the dot
 * moves because a day passed, which keeps the climb from becoming a streak.
 */

export type Level = 'week' | 'month' | 'season' | 'year'

export interface Camera {
  t0: number
  t1: number
  y0: number
  y1: number
}

const utc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

/** Where a day sits on the climb of `year`: 0 = Jan 1, 1 = the next Jan 1. */
export function tOf(iso: string, year: number): number {
  const y0 = Date.UTC(year, 0, 1)
  const y1 = Date.UTC(year + 1, 0, 1)
  return (utc(iso) - y0) / (y1 - y0)
}

/** The middle of a day, so a marker sits on its day rather than its dawn. */
export function tMid(iso: string, year: number): number {
  return tOf(iso, year) + 0.5 / 365
}

/** Detail at every scale (season, month, week, a few days), amplitude in
 *  proportion to wavelength — so each zoom has its own ground, not a ruler. */
const WAVES = [
  { l: 0.25, a: 0.07, p: 0.7 },
  { l: 1 / 12, a: 0.13, p: 2.1 },
  { l: 1 / 52, a: 0.15, p: 4.2 },
  { l: 3 / 365, a: 0.12, p: 1.3 },
]

export function elev(t: number): number {
  let base: number
  if (t < 0) base = -0.02 * Math.tanh(-t * 8)
  else if (t <= 1) base = Math.pow(t, 1.18)
  else base = 1 - Math.pow(t - 1, 1.1) * 3.6
  const inClimb = t < 0 ? Math.max(0, 1 + t * 10) : t > 1 ? Math.max(0, 1 - (t - 1) * 10) : 1
  let d = 0
  for (const w of WAVES) d += w.a * w.l * Math.sin((2 * Math.PI * t) / w.l + w.p)
  return base + d * inClimb
}

/** The far ranges behind — parallax, drawn at screen scale so they never balloon. */
export function farRidge(x: number, seed: number): number {
  return 0.5 * Math.sin(x * 0.006 + seed) + 0.3 * Math.sin(x * 0.017 + seed * 2) + 0.2 * Math.sin(x * 0.041 + seed * 3)
}

/** The camera that frames one period (inclusive `from`–`to`) of the climb. */
export function cameraFor(level: Level, from: string, to: string, year: number): Camera {
  const a = tOf(from, year)
  const b = tOf(to, year) + 1 / 365
  const span = b - a
  const isYear = level === 'year'
  const t0 = a - (isYear ? 0.07 : span * 0.22)
  const t1 = b + (isYear ? 0.16 : span * 0.22)
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i <= 120; i++) {
    const e = elev(t0 + ((t1 - t0) * i) / 120)
    lo = Math.min(lo, e)
    hi = Math.max(hi, e)
  }
  const r = Math.max(hi - lo, span * 0.25)
  return { t0, t1, y0: lo - r * (isYear ? 0.08 : 0.55), y1: hi + r * (isYear ? 0.32 : 0.55) }
}

/** A camera partway between two — zoomed in log-width so it moves like a
 *  camera pulling back, not a slide. `k` is 0–1, already eased. */
export function tween(from: Camera, to: Camera, k: number): Camera {
  const w = Math.exp(Math.log(from.t1 - from.t0) + (Math.log(to.t1 - to.t0) - Math.log(from.t1 - from.t0)) * k)
  const c = (from.t0 + from.t1) / 2 + ((to.t0 + to.t1) / 2 - (from.t0 + from.t1) / 2) * k
  const h = Math.exp(Math.log(from.y1 - from.y0) + (Math.log(to.y1 - to.y0) - Math.log(from.y1 - from.y0)) * k)
  const m = (from.y0 + from.y1) / 2 + ((to.y0 + to.y1) / 2 - (from.y0 + from.y1) / 2) * k
  return { t0: c - w / 2, t1: c + w / 2, y0: m - h / 2, y1: m + h / 2 }
}

export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
