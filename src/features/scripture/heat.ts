// Shared "First Light" heat ramp — ember (low engagement) → gold (high). The
// endpoints come from theme tokens so the canon map and the book view glow with
// the same warmth.

import { useEffect, useReducer } from 'react'

const FALLBACK_EMBER: Rgb = [197, 106, 110]
const FALLBACK_GOLD: Rgb = [243, 189, 118]

type Rgb = [number, number, number]

let cachedTheme: string | null = null
let ember: Rgb = FALLBACK_EMBER
let gold: Rgb = FALLBACK_GOLD

function readRgb(varName: string, fallback: Rgb): Rgb {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  const parts = raw.split(',').map((n) => parseInt(n, 10))
  return parts.length === 3 && parts.every((n) => Number.isFinite(n)) ? (parts as Rgb) : fallback
}

/**
 * The ramp's endpoints for the palette currently on screen, re-read whenever
 * [data-theme] changes. Most themes leave the ramp alone — it's the Scripture
 * surface's signature — but Vigil overrides it to stay monochrome, so the
 * endpoints can no longer be resolved once at module load.
 */
function endpoints(): readonly [Rgb, Rgb] {
  const theme = typeof document === 'undefined' ? '' : document.documentElement.dataset.theme ?? ''
  if (theme !== cachedTheme) {
    cachedTheme = theme
    ember = readRgb('--scripture-ember', FALLBACK_EMBER)
    gold = readRgb('--scripture-gold', FALLBACK_GOLD)
  }
  return [ember, gold]
}

/** A warmth value 0..1 → an rgb() string along the ember→gold ramp. */
export function heatColor(t: number): string {
  const [lo, hi] = endpoints()
  const r = Math.round(lo[0] + (hi[0] - lo[0]) * t)
  const g = Math.round(lo[1] + (hi[1] - lo[1]) * t)
  const b = Math.round(lo[2] + (hi[2] - lo[2]) * t)
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Re-render on a palette change. Every heatColor() call site bakes its result
 * into an inline style, so switching themes has to push a render or the grid
 * keeps the previous ramp until something unrelated re-renders it.
 */
export function useHeatRamp(): void {
  const [, repaint] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => repaint())
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
}

/** A cell's warmth, 0..1, from its distinct-entry count against the busiest cell. */
export function intensity(count: number, max: number): number {
  if (count <= 0) return 0
  if (max <= 1) return 1
  return Math.min(1, 0.4 + 0.6 * ((count - 1) / (max - 1)))
}
