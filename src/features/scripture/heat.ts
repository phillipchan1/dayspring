// Shared "First Light" heat ramp — ember (low engagement) → gold (high). The
// endpoints come from theme tokens so the canon map and the book view glow with
// the same warmth. Read once at module load.

const EMBER = readRgb('--scripture-ember', [197, 106, 110])
const GOLD = readRgb('--scripture-gold', [243, 189, 118])

function readRgb(varName: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof window === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  const parts = raw.split(',').map((n) => parseInt(n, 10))
  return parts.length === 3 && parts.every((n) => Number.isFinite(n))
    ? (parts as [number, number, number])
    : fallback
}

/** A warmth value 0..1 → an rgb() string along the ember→gold ramp. */
export function heatColor(t: number): string {
  const r = Math.round(EMBER[0] + (GOLD[0] - EMBER[0]) * t)
  const g = Math.round(EMBER[1] + (GOLD[1] - EMBER[1]) * t)
  const b = Math.round(EMBER[2] + (GOLD[2] - EMBER[2]) * t)
  return `rgb(${r}, ${g}, ${b})`
}

/** A cell's warmth, 0..1, from its distinct-entry count against the busiest cell. */
export function intensity(count: number, max: number): number {
  if (count <= 0) return 0
  if (max <= 1) return 1
  return Math.min(1, 0.4 + 0.6 * ((count - 1) / (max - 1)))
}
