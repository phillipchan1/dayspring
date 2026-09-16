/**
 * THE TRAIL — the one definition of the path up the mountain.
 *
 * The SVG draws this `d`; the stones are placed along it by the same arithmetic.
 * Both from one source, because a stone that sits a few pixels off its own trail
 * reads as a rendering bug rather than a memorial.
 *
 * Deliberately no `getPointAtLength`: measuring the live DOM would tie the
 * placement to layout timing, and jsdom implements none of the SVG geometry
 * interface, so a measured trail could not be tested at all. A cubic evaluated
 * here is pure, deterministic and identical on every platform.
 */

interface Cubic {
  p0: [number, number]
  c1: [number, number]
  c2: [number, number]
  p3: [number, number]
}

/** The two cubics of the climb, bottom-left ground → peak. */
const SEGMENTS: Cubic[] = [
  { p0: [120, 280], c1: [200, 235], c2: [180, 196], p3: [260, 172] },
  { p0: [260, 172], c1: [330, 150], c2: [285, 112], p3: [300, 52] },
]

/** The same curve as an SVG `d`, so the drawing and the maths cannot drift. */
export const TRAIL_D = SEGMENTS.map((s, i) =>
  i === 0
    ? `M${s.p0[0]},${s.p0[1]} C${s.c1[0]},${s.c1[1]} ${s.c2[0]},${s.c2[1]} ${s.p3[0]},${s.p3[1]}`
    : `C${s.c1[0]},${s.c1[1]} ${s.c2[0]},${s.c2[1]} ${s.p3[0]},${s.p3[1]}`,
).join(' ')

/** The peak, where the trail ends — the glow and the dot sit here. */
export const PEAK: [number, number] = [300, 48]

/** The mountain's silhouette, drawn under the trail. */
export const RIDGE_POINTS = '300,48 560,280 40,280'
export const GROUND_Y = 280

function cubicAt(s: Cubic, t: number): [number, number] {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const c = 3 * u * t * t
  const d = t * t * t
  return [
    a * s.p0[0] + b * s.c1[0] + c * s.c2[0] + d * s.p3[0],
    a * s.p0[1] + b * s.c1[1] + c * s.c2[1] + d * s.p3[1],
  ]
}

/** Arc-length lookup, built once. Sampling evenly in `t` and re-indexing by
 *  distance is what makes two stones a month apart sit a month apart, rather
 *  than bunching wherever the curve happens to bend. */
const SAMPLES = 512
const LUT: { at: [number, number]; dist: number }[] = (() => {
  const out: { at: [number, number]; dist: number }[] = []
  let dist = 0
  let prev: [number, number] | null = null
  for (const seg of SEGMENTS) {
    for (let i = 0; i <= SAMPLES; i++) {
      const pt = cubicAt(seg, i / SAMPLES)
      if (prev) dist += Math.hypot(pt[0] - prev[0], pt[1] - prev[1])
      out.push({ at: pt, dist })
      prev = pt
    }
  }
  return out
})()

const TOTAL = LUT[LUT.length - 1]!.dist

/**
 * The point `fraction` of the way along the trail, 0 = the ground, 1 = the peak.
 * Out-of-range fractions clamp: a stone can only be set somewhere on the trail.
 */
export function pointOnTrail(fraction: number): { x: number; y: number } {
  const f = Math.min(1, Math.max(0, fraction))
  const target = f * TOTAL
  // The LUT is sorted by distance, so a binary search finds the span in ~9 steps.
  let lo = 0
  let hi = LUT.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (LUT[mid]!.dist < target) lo = mid + 1
    else hi = mid
  }
  const b = LUT[lo]!
  const a = LUT[lo > 0 ? lo - 1 : 0]!
  const span = b.dist - a.dist
  const t = span > 0 ? (target - a.dist) / span : 0
  return {
    x: a.at[0] + (b.at[0] - a.at[0]) * t,
    y: a.at[1] + (b.at[1] - a.at[1]) * t,
  }
}
