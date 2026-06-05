/**
 * Warmth-band rendering — PURE (no React, no DOM). The abstract encoding of a
 * rope's heft/lenses/pools into a soft band of light plus its self-labeling
 * caption. Kept dependency-free so it can be unit-tested and previewed in a
 * static harness with real data, and so the React component and any harness can
 * never drift. See AltitudeBands for the wrapper.
 */

import type { WarmthBand } from '@/features/threads/data'

// ── hue: which parts of life the band wove through ────────────────────────────

const LENS_HUE: Record<string, string> = {
  trading: '#e8b873', frontier: '#cf964f', provision: '#d98a4a', family: '#d39a5e',
  sce: '#c98a4b', scripture: '#d98a4a', relationship: '#be9070', prayer: '#e6c06a',
  presence: '#e6c06a', health: '#a9b06a', purity: '#c79ac0', emotion: '#8fa6c8',
}
export function hueFor(lens: string): string {
  const k = lens.toLowerCase()
  for (const key of Object.keys(LENS_HUE)) if (k.includes(key)) return LENS_HUE[key]!
  return '#e8b873'
}

// ── the band SVG — soft light, not a chart bar ────────────────────────────────

/** Build the warmth-band SVG markup. `id` must be DOM-unique (gradient/filter refs). */
export function warmthSvg(heft: number, lenses: string[], pools: number[], id: string): string {
  const H = Math.round(Math.min(56, 16 + Math.sqrt(heft) * 8))
  const op = Math.min(0.9, 0.4 + heft * 0.04)
  const tones = (lenses.length ? lenses : ['gold']).map(hueFor)
  const stops = tones.length > 1
    ? tones.map((c, k) => `<stop offset="${Math.round((k / (tones.length - 1)) * 100)}%" stop-color="${c}"/>`).join('')
    : `<stop offset="0%" stop-color="${tones[0]}" stop-opacity=".55"/><stop offset="50%" stop-color="${tones[0]}"/><stop offset="100%" stop-color="${tones[0]}" stop-opacity=".55"/>`
  const nB = pools.length || 1
  const poolEls = pools.map((p, k) => {
    if (p <= 0.05) return ''
    const x = ((k + 0.5) / nB) * 600
    const rx = 26 + heft * 2.2
    return `<ellipse cx="${x.toFixed(0)}" cy="${(H / 2).toFixed(0)}" rx="${rx.toFixed(0)}" ry="${(H * 0.6).toFixed(0)}" fill="#f0c587" opacity="${(p * 0.45).toFixed(2)}"/>`
  }).join('')
  return `<svg viewBox="0 0 600 ${H}" preserveAspectRatio="none" style="width:100%;height:${H}px;display:block">
    <defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient>
    <filter id="b${id}" x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation="3.6"/></filter></defs>
    <g filter="url(#b${id})"><rect x="4" y="3" width="592" height="${H - 6}" rx="${((H - 6) / 2).toFixed(0)}" fill="url(#g${id})" opacity="${op.toFixed(2)}"/>${poolEls}</g></svg>`
}

// ── deterministic self-labeling caption (plain language, no counts) ───────────

export function shortLens(lens: string): string {
  const k = lens.toLowerCase()
  if (k.includes('prayer') || k.includes('presence')) return 'prayer'
  if (k.includes('relationship')) return 'relationships'
  if (k.includes('emotion')) return 'emotion'
  return lens.toLowerCase()
}

function recurrencePhrase(heft: number): string {
  if (heft <= 1) return 'touched once'
  if (heft === 2) return 'touched twice'
  if (heft <= 4) return 'returned to more than once'
  return 'kept returning'
}

/** Calendar month (0–11) → season. */
const SEASON_BY_MONTH = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter']

function whenPhrase(pools: number[], horizon: number): string | null {
  if (pools.length <= 1) return null
  let peak = 0
  for (let i = 1; i < pools.length; i++) if (pools[i]! > pools[peak]!) peak = i
  const avg = pools.reduce((a, b) => a + b, 0) / pools.length
  if (pools[peak]! - avg < 0.3) return 'steady throughout'
  // Quarter / year: map the peak bucket to its real calendar month (the trailing
  // window ends now) and name the season — truthful, never a guessed season.
  if (horizon >= 2) {
    const monthsBack = horizon === 3 ? 12 : 3
    const monthsAgo = Math.round((1 - (peak + 0.5) / pools.length) * monthsBack)
    const d = new Date()
    d.setMonth(d.getMonth() - monthsAgo)
    return `warmest in ${SEASON_BY_MONTH[d.getMonth()]}`
  }
  // Week / month: positional, since a season name would over-claim at that scale.
  const pos = peak / (pools.length - 1)
  const span = horizon === 0 ? 'the week' : 'the month'
  if (pos < 0.34) return `warmest early in ${span}`
  if (pos > 0.66) return `warmest late in ${span}`
  return horizon === 0 ? 'warmest midweek' : 'warmest mid-month'
}

function lensPhrase(lenses: string[]): string | null {
  const ls = lenses.map(shortLens)
  if (ls.length === 0) return null
  if (ls.length === 1) return ls[0]!
  if (ls.length === 2) return `${ls[0]} & ${ls[1]} woven`
  return `${ls.slice(0, -1).join(', ')} & ${ls[ls.length - 1]} woven`
}

export function captionFor(band: Pick<WarmthBand, 'heft' | 'pools' | 'lenses'>, horizon: number): string {
  const parts = [recurrencePhrase(band.heft), whenPhrase(band.pools, horizon), lensPhrase(band.lenses)]
  return parts.filter(Boolean).join(' · ')
}
