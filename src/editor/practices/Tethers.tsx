import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

export interface TetherKey {
  key: string
  /** Which writing movement drew it — the tone at the close; null while writing. */
  tone: number | null
}

interface Props {
  /** The quotes to draw lines for, in the order they sit in the answer(s). */
  keys: readonly TetherKey[]
  /** Where each quote sits on the right-hand page, found fresh every frame. */
  targets: () => Map<string, HTMLElement>
  /** The quote being followed: its line is drawn heavier, the rest recede. */
  lit: string | null
  /** A word the pointer rests on: a faint bracket where a line would leave from. */
  rest: { n: number; offset: number } | null
}

const GOLD = 'rgb(var(--scripture-gold, 196, 145, 60))'
/** Movement tones at the close: gold, the accent, and a quiet violet. */
const TONES = [GOLD, 'var(--accent)', 'color-mix(in srgb, #8a74c0 80%, var(--text-dim))']

/**
 * The lines between a passage and what was written from it.
 *
 * Each quote's words are marked by a bracket in the leaf's right margin,
 * spanning the lines they sit on, and the line leaves from the bracket — a line
 * drawn from the words themselves cut straight across the passage. The other
 * end is the quote in the answer. A column that has scrolled its end out of
 * view gets a dashed line to its edge, pointing the way.
 *
 * One SVG over the composer, measured every frame and written only when
 * something moved: no React state, so drawing never re-renders the page.
 */
export function Tethers({ keys, targets, lit, rest }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const props = useRef({ keys, targets, lit, rest })
  props.current = { keys, targets, lit, rest }

  useEffect(() => {
    let raf = 0
    let last = ''
    const frame = () => {
      raf = requestAnimationFrame(frame)
      const svg = svgRef.current
      const rail = document.querySelector<HTMLElement>('.rc--facing .rc__rail')
      const page = document.querySelector<HTMLElement>('.rc--facing .rc__desk')
      if (!svg || !rail || !page) return
      const { keys, targets, lit, rest } = props.current
      const lr = rail.getBoundingClientRect()
      const pr = page.getBoundingClientRect()
      const x1 = lr.right - 18
      const found = targets()
      let out = ''
      let lane = 0

      const bracket = (rects: DOMRect[]) => {
        const top = Math.min(...rects.map((r) => r.top)) + 3
        const bot = Math.max(...rects.map((r) => r.bottom)) - 3
        return { top, bot, mid: (top + bot) / 2 }
      }
      const clampY = (y: number, r: DOMRect) => Math.min(Math.max(y, r.top + 10), r.bottom - 10)
      const curve = (xa: number, ya: number, xb: number, yb: number) => {
        const dx = Math.max(50, (xb - xa) * 0.5)
        return `M${xa.toFixed(1)},${ya.toFixed(1)} C${(xa + dx).toFixed(1)},${ya.toFixed(1)} ${(xb - dx).toFixed(1)},${yb.toFixed(1)} ${xb.toFixed(1)},${yb.toFixed(1)}`
      }

      for (const { key, tone } of keys) {
        const words = [...rail.querySelectorAll<HTMLElement>('.psg__w[data-keys]')].filter((w) =>
          (w.dataset.keys ?? '').split(' ').includes(key),
        )
        const target = found.get(key)
        if (words.length === 0 || !target) continue
        const b = bracket(words.flatMap((w) => [...w.getClientRects()]))
        const tr = target.getBoundingClientRect()
        const color = tone == null ? GOLD : TONES[tone % TONES.length]!
        const on = lit === key
        const faded = lit != null && !on
        const op = faded ? 0.15 : on ? 1 : 0.62
        const x = x1 - (lane++ % 3) * 5
        const off1 = b.mid < lr.top + 8 || b.mid > lr.bottom - 8
        const y1 = clampY(b.mid, lr)
        const yRaw = tr.top + Math.min(14, tr.height / 2)
        const off2 = yRaw < pr.top + 8 || yRaw > pr.bottom - 8
        const y2 = clampY(yRaw, pr)
        const x2 = off2 ? pr.left + 18 : tr.left - 6
        if (!off1) {
          const t = Math.max(b.top, lr.top + 4)
          const bb = Math.min(b.bot, lr.bottom - 4)
          if (bb > t) out += `<path d="M${x},${t.toFixed(1)} L${x},${bb.toFixed(1)}" stroke="${color}" stroke-width="${on ? 3 : 2}" opacity="${op}"/>`
        }
        out += `<path d="${curve(off1 ? lr.right - 18 : x, y1, x2, y2)}" stroke="${color}" stroke-width="${on ? 2.2 : 1.3}" opacity="${op}"${off1 || off2 ? ' stroke-dasharray="3 4"' : ''}/>`
        out += `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="${on ? 3.2 : 2.4}" fill="${color}" opacity="${op}"/>`
      }

      // The line-to-be: from the words being chosen to where they will land.
      const pend = [...rail.querySelectorAll<HTMLElement>('.psg__w[data-pending]')]
      const ghost = page.querySelector<HTMLElement>('.rc__ghost')
      if (pend.length) {
        const b = bracket(pend.flatMap((w) => [...w.getClientRects()]))
        out += `<path d="M${x1},${b.top.toFixed(1)} L${x1},${b.bot.toFixed(1)}" stroke="${GOLD}" stroke-width="2" opacity=".9"/>`
        if (ghost) {
          const gr = ghost.getBoundingClientRect()
          out += `<path d="${curve(x1, clampY(b.mid, lr), gr.left - 6, clampY(gr.top + 14, pr))}" stroke="${GOLD}" stroke-width="1.4" opacity=".85" stroke-dasharray="4 5"/>`
        }
      } else if (rest) {
        const w = rail.querySelector<HTMLElement>(`.psg__w[data-v="${rest.n}"][data-start="${rest.offset}"]`)
        if (w) {
          const r = w.getBoundingClientRect()
          out += `<path d="M${x1},${(r.top + 4).toFixed(1)} L${x1},${(r.bottom - 4).toFixed(1)}" stroke="${GOLD}" stroke-width="2" opacity=".35" stroke-dasharray="2 3"/>`
        }
      }

      if (out !== last) {
        svg.innerHTML = out
        last = out
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return createPortal(
    <svg ref={svgRef} className="rc__tethers" aria-hidden="true" />,
    document.body,
  )
}
