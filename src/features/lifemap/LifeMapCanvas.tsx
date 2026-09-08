// The map itself — four regions, one per list, and everything you carry placed
// in the one it belongs to.
//
// WHAT IT ENCODES, and the rules that keep it legal:
//   · position   — which list it is in. Nothing else. Never significance.
//   · brightness — how recently you wrote it. The one axis, and it is a fact.
//   · colour     — amber if Dayspring found it, the same rule as the chips.
//   · SIZE       — never. Every mark is the same size, always. The moment a mark
//                  grows because something recurs more, the drawing is ranking
//                  the people in someone's life, and a ranking is a verdict
//                  rendered in geometry (Principle 1, D-016).
//
// Canvas rather than SVG because the layout relaxes over ~150 iterations to keep
// labels from colliding, and that is arithmetic, not markup.

import { useCallback, useEffect, useRef } from 'react'
import type { LifeMapItem, LifeMapSection } from './lifeMap'

/** Deterministic wobble — same input, same layout, every visit. */
function nz(a: number, b: number): number {
  return (
    Math.sin(a * 1.7 + b * 0.9) * 0.6 +
    Math.sin(a * 0.6 - b * 2.1) * 0.4 +
    Math.sin(a * 3.3 + b * 0.3) * 0.22
  )
}

/** 1 = written now, 0 = the far end of the archive. Brightness reads this. */
function recency(item: LifeMapItem, oldest: number, newest: number): number {
  if (!item.lastSeen) return 0.55
  const t = Date.parse(item.lastSeen)
  if (Number.isNaN(t) || newest <= oldest) return 0.55
  return Math.min(1, Math.max(0, (t - oldest) / (newest - oldest)))
}

interface Placed {
  x: number
  y: number
  bx: number
  by: number
  w: number
  item: LifeMapItem
  region: number
  r: number
}

export function LifeMapCanvas({ sections }: { sections: LifeMapSection[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null)

  const draw = useCallback(() => {
    const canvas = ref.current
    const host = canvas?.parentElement
    if (!canvas || !host) return

    const w = host.clientWidth || 720
    const h = 380
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.height = `${h}px`
    const x = canvas.getContext('2d')
    if (!x) return
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
    x.clearRect(0, 0, w, h)

    const cs = getComputedStyle(document.documentElement)
    const ink = cs.getPropertyValue('--text-bright').trim() || '#2a2118'
    const amber = cs.getPropertyValue('--dayspring-amber').trim() || '#c4913c'
    const faint = cs.getPropertyValue('--text-faint').trim() || '#b4a78f'
    const plate = cs.getPropertyValue('--bg-input').trim() || '#f3ece0'

    // Everything on the map: current era only. `earlier` lives behind its
    // expander in the lists, and drawing it here would crowd the years you are
    // actually in with the ones you have left.
    const all = sections.flatMap((s, si) =>
      s.items.map((item) => ({ item, region: si })),
    )
    if (all.length === 0) return

    const stamps = all
      .map((a) => (a.item.lastSeen ? Date.parse(a.item.lastSeen) : NaN))
      .filter((n) => !Number.isNaN(n))
    const oldest = stamps.length ? Math.min(...stamps) : 0
    const newest = stamps.length ? Math.max(...stamps) : 1

    const anchors = [
      { x: w * 0.22, y: h * 0.26 },
      { x: w * 0.78, y: h * 0.26 },
      { x: w * 0.22, y: h * 0.74 },
      { x: w * 0.78, y: h * 0.74 },
    ]

    x.font = '400 11.5px Newsreader, Georgia, serif'
    const pts: Placed[] = all.map(({ item, region }, k) => {
      const a = anchors[region] ?? anchors[0]!
      const bx = a.x + nz(k * 1.9, 3) * 74
      const by = a.y + nz(k * 1.1, 7) * 52
      return {
        x: bx,
        y: by,
        bx,
        by,
        w: x.measureText(item.label).width + 18,
        item,
        region,
        r: recency(item, oldest, newest),
      }
    })

    // Relax so labels never overlap. Wide, flat collision ellipse — labels are
    // long and short, so x and y must not be treated alike.
    for (let it = 0; it < 150; it++) {
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i]!
          const b = pts[j]!
          const dx = a.x - b.x
          const dy = (a.y - b.y) * 2.7
          const d = Math.sqrt(dx * dx + dy * dy) || 0.01
          const need = (a.w + b.w) / 2 + 7
          if (d < need) {
            const q = ((need - d) / d) * 0.5
            a.x += dx * q
            a.y += (dy / 2.7) * q
            b.x -= dx * q
            b.y -= (dy / 2.7) * q
          }
        }
      }
      for (const p of pts) {
        p.x += (p.bx - p.x) * 0.06
        p.y += (p.by - p.y) * 0.06
        p.x = Math.max(p.w / 2 + 6, Math.min(w - p.w / 2 - 6, p.x))
        p.y = Math.max(18, Math.min(h - 20, p.y))
      }
    }

    for (const a of anchors) {
      const g = x.createRadialGradient(a.x, a.y, 0, a.x, a.y, Math.min(w, h) * 0.34)
      g.addColorStop(0, hexA(ink, 0.04))
      g.addColorStop(1, hexA(ink, 0))
      x.fillStyle = g
      x.fillRect(0, 0, w, h)
    }

    x.textAlign = 'center'
    x.textBaseline = 'top'
    for (const p of pts) {
      const found = p.item.provenance === 'found'
      const col = found ? amber : ink
      const alpha = 0.22 + p.r * 0.66
      mark(x, p, col, alpha)
      x.font = '400 11.5px Newsreader, Georgia, serif'
      x.fillStyle = hexA(ink, 0.3 + p.r * 0.52)
      x.fillText(p.item.label, p.x, p.y + 7)
    }

    x.font = '600 10.5px Inter, system-ui, sans-serif'
    x.textBaseline = 'middle'
    const corners: [number, number, CanvasTextAlign][] = [
      [14, 16, 'left'],
      [w - 14, 16, 'right'],
      [14, h - 14, 'left'],
      [w - 14, h - 14, 'right'],
    ]
    sections.forEach((s, i) => {
      const c = corners[i]
      if (!c) return
      x.textAlign = c[2]
      x.fillStyle = plate
      x.fillStyle = hexA(faint, 0.9)
      x.fillText(s.label.toUpperCase(), c[0], c[1])
    })
  }, [sections])

  useEffect(() => {
    draw()
    const id = requestAnimationFrame(draw)
    const host = ref.current?.parentElement
    const ro = host && 'ResizeObserver' in window ? new ResizeObserver(() => draw()) : null
    if (host && ro) ro.observe(host)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', draw)
    return () => {
      cancelAnimationFrame(id)
      ro?.disconnect()
      mq.removeEventListener('change', draw)
    }
  }, [draw])

  return (
    <div className="lifemap__stage">
      <canvas
        ref={ref}
        aria-label="A map of the people, places, domains and matters in your journal, each placed in its list. Brightness shows how recently you wrote it."
      />
    </div>
  )
}

/** One mark per kind. Same size for every one — see the header. */
function mark(x: CanvasRenderingContext2D, p: Placed, col: string, alpha: number) {
  x.save()
  x.fillStyle = hexA(col, alpha)
  x.strokeStyle = hexA(col, alpha)
  x.lineWidth = 1.3
  const { x: px, y: py } = p
  switch (p.item.section) {
    case 'person':
      x.beginPath()
      x.arc(px, py, 3.5, 0, Math.PI * 2)
      x.fill()
      break
    case 'place':
      x.beginPath()
      x.moveTo(px, py - 4.3)
      x.lineTo(px + 4.3, py)
      x.lineTo(px, py + 4.3)
      x.lineTo(px - 4.3, py)
      x.closePath()
      x.fill()
      break
    case 'domain':
      x.fillRect(px - 3.4, py - 3.4, 6.8, 6.8)
      break
    default:
      x.setLineDash([2, 1.7])
      x.beginPath()
      x.arc(px, py, 3.8, 0, Math.PI * 2)
      x.stroke()
  }
  x.restore()
}

/** Theme tokens are hex; canvas needs alpha. */
function hexA(hex: string, a: number): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1]!, 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a.toFixed(3)})`
}
