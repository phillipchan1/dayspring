import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useVirtualRange } from '@/features/journal/useVirtualRange'
import type { Entry } from '@/lib/types'
import { PageCard } from './PageCard'
import { anniversaryLabel, findAnniversaries } from './anniversaries'
import { pageExcerpt, type PageExcerpt } from './pageExcerpt'
import { DENSITY, type PagesDensity } from './density'

interface Props {
  /** Wall order — newest first. */
  entries: Entry[]
  density: PagesDensity
  /** Quotes the writer marked, by entry id. */
  markQuotes: Map<string, string[]>
  /** Null when no subject is chosen; otherwise the ids that carry it. */
  lit: Set<string> | null
  activeId: string | null
  /** Interleave pages from earlier years. */
  echoes: boolean
  onOpen: (entryId: string) => void
}

interface WallItem {
  key: string
  entry: Entry
  echo?: string
}

/**
 * The wall.
 *
 * A uniform grid on purpose. Year markers are a sticky overlay rather than rows
 * in the flow, which keeps every row the same height — that's what lets a
 * 3,500-page archive window cleanly, and it means the year label behaves like a
 * thumb held in a book rather than a header you scroll past and lose.
 */
export function PageWall({
  entries,
  density,
  markQuotes,
  lit,
  activeId,
  echoes,
  onOpen,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const spec = DENSITY[density]
  const [cols, setCols] = useState(1)
  const [focusIdx, setFocusIdx] = useState(-1)
  const [topYear, setTopYear] = useState<string | null>(null)

  // Columns come from the real width, not a breakpoint — the panel is resizable
  // and the window is not the container.
  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      if (w <= 0) return
      const next = Math.max(1, Math.min(spec.maxCols, Math.floor((w + spec.gap) / (spec.minWidth + spec.gap))))
      setCols((prev) => (prev === next ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [spec])

  const items: WallItem[] = useMemo(() => {
    if (!echoes) return entries.map((entry) => ({ key: entry.id, entry }))

    // Spaced in ROWS, not pages: a fixed page gap puts two echoes on one screen
    // at eight columns and one every few screens at two.
    const found = findAnniversaries(entries, entries, Math.max(10, cols * 3))
    const byAnchor = new Map(found.map((a) => [a.anchorId, a]))
    const out: WallItem[] = []
    for (const entry of entries) {
      out.push({ key: entry.id, entry })
      const echo = byAnchor.get(entry.id)
      // A rendered id can repeat (the echo is a real page from elsewhere in the
      // wall), so the React key has to carry the anchor too.
      if (echo) {
        out.push({
          key: `echo:${entry.id}:${echo.entry.id}`,
          entry: echo.entry,
          echo: anniversaryLabel(echo),
        })
      }
    }
    return out
  }, [entries, echoes, cols])

  /**
   * Excerpts are memoized against the entry object and the density's line budget.
   * Recomputing 3,500 of these on a scroll frame is the one thing that would make
   * this surface feel slow, and Principle 3's latency rule is not only about the
   * editor.
   */
  const excerpts = useMemo(() => {
    const cache = new Map<string, PageExcerpt>()
    for (const item of items) {
      if (cache.has(item.entry.id)) continue
      cache.set(item.entry.id, pageExcerpt(item.entry, markQuotes.get(item.entry.id) ?? [], spec.lines))
    }
    return cache
  }, [items, markQuotes, spec.lines])

  const rowCount = Math.ceil(items.length / cols)
  const rowHeight = spec.cardHeight + spec.gap
  const virtual = useVirtualRange(scrollRef, rowCount, rowCount > 6, rowHeight)

  const firstIdx = virtual.start * cols
  const lastIdx = Math.min(items.length, virtual.end * cols)
  const slice = items.slice(firstIdx, lastIdx)

  // Years present, newest first — the scrubber's stops.
  const years = useMemo(() => {
    const seen: string[] = []
    for (const e of entries) {
      const y = String(new Date(e.created_at).getFullYear())
      if (seen[seen.length - 1] !== y && !seen.includes(y)) seen.push(y)
    }
    return seen
  }, [entries])

  /** First row index for each year — where the scrubber jumps to. */
  const yearRow = useMemo(() => {
    const map = new Map<string, number>()
    items.forEach((item, i) => {
      if (item.echo) return // an echo is out of order; it must not claim a year
      const y = String(new Date(item.entry.created_at).getFullYear())
      if (!map.has(y)) map.set(y, Math.floor(i / cols))
    })
    return map
  }, [items, cols])

  // The year of whatever is at the top of the viewport.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const read = () => {
      const row = Math.floor(el.scrollTop / rowHeight)
      const item = items[row * cols]
      setTopYear(item ? String(new Date(item.entry.created_at).getFullYear()) : null)
    }
    read()
    el.addEventListener('scroll', read, { passive: true })
    return () => el.removeEventListener('scroll', read)
  }, [items, cols, rowHeight])

  const scrollToRow = useCallback(
    (row: number) => {
      scrollRef.current?.scrollTo({ top: row * rowHeight, behavior: 'auto' })
    },
    [rowHeight],
  )

  // Move the roving focus. The target may be unmounted by windowing, so scroll
  // first and take focus on the next frame, once the row exists.
  const moveFocus = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, next))
      setFocusIdx(clamped)
      const row = Math.floor(clamped / cols)
      const el = scrollRef.current
      if (el) {
        const top = row * rowHeight
        if (top < el.scrollTop) el.scrollTo({ top, behavior: 'auto' })
        else if (top + spec.cardHeight > el.scrollTop + el.clientHeight) {
          el.scrollTo({ top: top + spec.cardHeight - el.clientHeight, behavior: 'auto' })
        }
      }
      requestAnimationFrame(() => {
        const item = items[clamped]
        if (!item) return
        const node = gridRef.current?.querySelector<HTMLElement>(
          `[data-wall-key="${CSS.escape(item.key)}"]`,
        )
        node?.focus()
      })
    },
    [items, cols, rowHeight, spec.cardHeight],
  )

  function onKeyDown(e: React.KeyboardEvent) {
    const base = focusIdx < 0 ? 0 : focusIdx
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        moveFocus(base + 1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        moveFocus(base - 1)
        break
      case 'ArrowDown':
        e.preventDefault()
        moveFocus(base + cols)
        break
      case 'ArrowUp':
        e.preventDefault()
        moveFocus(base - cols)
        break
      case 'Home':
        e.preventDefault()
        moveFocus(0)
        break
      case 'End':
        e.preventDefault()
        moveFocus(items.length - 1)
        break
      default:
    }
  }

  return (
    <div className="pg__wall-wrap">
      <div className="pg__scroll" ref={scrollRef}>
        <div
          ref={gridRef}
          className="pg__grid"
          role="grid"
          aria-label="Your pages"
          onKeyDown={onKeyDown}
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: `${spec.gap}px`,
            paddingTop: virtual.topSpacer,
            paddingBottom: virtual.bottomSpacer,
            // CSS reads the card height from here so the windowing math above
            // stays the only definition of it.
            ['--pg-card-h' as string]: `${spec.cardHeight}px`,
          }}
        >
          {slice.map((item, i) => {
            const idx = firstIdx + i
            return (
              <span
                key={item.key}
                data-wall-key={item.key}
                className="pg__cell"
                tabIndex={idx === focusIdx || (focusIdx < 0 && idx === 0) ? 0 : -1}
                onFocus={() => setFocusIdx(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpen(item.entry.id)
                  }
                }}
              >
                <PageCard
                  entryId={item.entry.id}
                  dateIso={item.entry.created_at}
                  excerpt={excerpts.get(item.entry.id)!}
                  dim={lit !== null && !lit.has(item.entry.id)}
                  active={item.entry.id === activeId && !item.echo}
                  echo={item.echo}
                  onOpen={onOpen}
                />
              </span>
            )
          })}
        </div>
      </div>

      {topYear ? (
        <span className="pg__year" aria-hidden>
          {topYear}
        </span>
      ) : null}

      {years.length > 1 ? (
        <nav className="pg__scrub" aria-label="Jump to a year">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              className="pg__scrub-y"
              data-on={y === topYear ? 'true' : undefined}
              onClick={() => scrollToRow(yearRow.get(y) ?? 0)}
            >
              {y}
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  )
}
