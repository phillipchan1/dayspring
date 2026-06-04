/**
 * Wave SVG for a strand row — ported from the prototype's strandSvg() function.
 * Warm tonal variation only; no rainbow lens colors.
 */

const TONE = ['#dda63f', '#cc9156', '#c0613d', '#e0b45a', '#b5772f'] as const

function wavePath(amp: number, phase: number, off: number): string {
  let d = `M 0 ${(17 + off).toFixed(1)}`
  for (let x = 0; x <= 600; x += 22) {
    const y = 17 + off + amp * Math.sin((x / 600) * Math.PI * 3 + phase)
    d += ` L ${x} ${y.toFixed(1)}`
  }
  return d
}

interface Props {
  /** Number of visible component threads in this strand. */
  count: number
}

export function StrandSvg({ count }: Props) {
  const spread = Math.min(9, (count - 1) * 4)
  const glowWidth = 8 + count * 3
  const glowOpacity = (0.1 + count * 0.02).toFixed(2)

  const comps: { d: string; stroke: string; width: number }[] = []

  for (let i = 0; i < count; i++) {
    const off =
      count === 1 ? 0 : (i - (count - 1) / 2) * ((spread / Math.max(1, count - 1)) * 2)
    comps.push({
      d: wavePath(3.2, i * 1.3, off),
      stroke: TONE[i % TONE.length] ?? TONE[0],
      width: count > 1 ? 2.2 : 1.8,
    })
  }

  return (
    <svg
      className="strand-svg"
      viewBox="0 0 600 34"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* ambient glow backing */}
      <path
        d={wavePath(3.5, 0, 0)}
        stroke="var(--tr-gold-soft)"
        strokeWidth={glowWidth}
        opacity={glowOpacity}
        vectorEffect="non-scaling-stroke"
        fill="none"
        strokeLinecap="round"
      />
      {/* individual thread lines */}
      {comps.map((c, i) => (
        <path
          key={i}
          d={c.d}
          stroke={c.stroke}
          strokeWidth={c.width}
          opacity={0.85}
          vectorEffect="non-scaling-stroke"
          fill="none"
          strokeLinecap="round"
        />
      ))}
    </svg>
  )
}
