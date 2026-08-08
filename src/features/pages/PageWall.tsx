import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useVirtualRange } from '@/hooks/useVirtualRange'
import { useEntryMultiSelect } from '@/features/journal/useEntryMultiSelect'
import {
  EntryContextMenu,
  type EntryMenuAction,
  type EntryMenuPhase,
} from '@/features/journal/EntryContextMenu'
import {
  EntryBulkMenu,
  type EntryBulkAction,
  type EntryBulkMenuPhase,
} from '@/features/journal/EntryBulkMenu'
import { EntrySelectionBar } from '@/features/journal/EntrySelectionBar'
import { useSuppressNativeContextMenu } from '@/features/journal/useSuppressNativeContextMenu'
import {
  copyEntriesMarkdown,
  copyEntriesText,
  exportEntriesZip,
} from '@/features/journal/entryBulkActions'
import { nextEntryIdAfterDelete } from '@/features/journal/orderedEntryIds'
import type { Entry } from '@/lib/types'
import { PageCard } from './PageCard'
import {
  buildWallItems,
  collapseUnlit,
  monthAtRow,
  monthMarks,
  seamLabel,
  selectionOrder,
  yearRows,
  type WallItem,
} from './wallItems'
import { pageExcerpt, type PageExcerpt } from './pageExcerpt'
import { clampZoom, isReading, readingCols, specForZoom, wheelZoomDelta } from './zoom'
import { Leaf } from './Leaf'
import { claimTransitionName, withPageTransition } from './viewTransition'

interface Props {
  /** Wall order — newest first. */
  entries: Entry[]
  /** How close you're standing, 0 (far) → 1 (near). */
  zoom: number
  onZoom: (next: number) => void
  /** Quotes the writer marked, by entry id. */
  markQuotes: Map<string, string[]>
  /** Null when nothing is lit; otherwise the ids that carry every chosen filter. */
  lit: Set<string> | null
  /** Matcher for the lit words themselves. Null when nothing is lit. */
  match: RegExp | null
  activeId: string | null
  /** Interleave pages from earlier years. */
  echoes: boolean
  /** Click — read the page in the Spread. */
  onOpen: (entryId: string) => void
  /**
   * The page just closed in the Spread, if any.
   *
   * It claims the shared transition name for one beat so the reader shrinks
   * back into the card it grew out of rather than cutting away from it.
   */
  returningId: string | null
  /** Double-click, or "Open to write" — leave for the editor. */
  onEdit: (entryId: string) => void
  onMenuAction: (action: EntryMenuAction, entry: Entry) => void
  onDeleteEntries: (ids: string[], focusAfterId?: string | null) => void
  /** One page at a time — a phone can't hold two open. */
  single: boolean
  firstLineTitle: boolean
}

const EMPTY_SELECTED: Entry[] = []

/**
 * The wall.
 *
 * A uniform grid on purpose. Year markers are a sticky overlay rather than rows
 * in the flow, which keeps every row the same height — that's what lets a
 * 3,500-page archive window cleanly, and it means the year label behaves like a
 * thumb held in a book rather than a header you scroll past and lose.
 *
 * This is also where the entries list's capabilities live now — selecting,
 * renaming, exporting, deleting. Deliberately not a port of its machinery: most
 * of `useEntryListKeyboard` was arbitration between a list and an editor sharing
 * a screen, and they never share one again. What's left is a keydown handler
 * scoped to the grid by ordinary event bubbling.
 */
export function PageWall({
  entries,
  zoom,
  onZoom,
  markQuotes,
  lit,
  match,
  activeId,
  echoes,
  onOpen,
  returningId,
  onEdit,
  onMenuAction,
  onDeleteEntries,
  single,
  firstLineTitle,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  // Memoized: it's a dependency of the column-measuring layout effect, and a
  // fresh object every render would tear down and rebuild the ResizeObserver on
  // every scroll frame.
  const spec = useMemo(() => specForZoom(zoom), [zoom])
  // Close enough to read: cells stop being cards and become whole pages.
  const reading = isReading(zoom)
  const [cols, setCols] = useState(1)
  const [focusIdx, setFocusIdx] = useState(-1)
  const [topYear, setTopYear] = useState<string | null>(null)
  const [topMonth, setTopMonth] = useState<string | null>(null)
  // Seams the reader has opened back up. Cleared whenever the filter changes —
  // an expansion belongs to the question you asked, not to the wall.
  const [expandedSeams, setExpandedSeams] = useState<ReadonlySet<string>>(() => new Set())
  useEffect(() => setExpandedSeams(new Set()), [lit])
  const [phase, setPhase] = useState<EntryMenuPhase>({ kind: 'closed' })
  const [bulkPhase, setBulkPhase] = useState<EntryBulkMenuPhase>({ kind: 'closed' })

  const closeMenu = useCallback(() => setPhase({ kind: 'closed' }), [])
  const closeBulkMenu = useCallback(() => setBulkPhase({ kind: 'closed' }), [])
  const menuTargetId = phase.kind === 'closed' ? null : phase.entry.id

  useSuppressNativeContextMenu(phase.kind !== 'closed' || bulkPhase.kind !== 'closed', () => {
    closeMenu()
    closeBulkMenu()
  })

  // Columns come from the real width, not a breakpoint — the panel is resizable
  // and the window is not the container.
  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      if (w <= 0) return
      const fits = Math.floor((w + spec.gap) / (spec.minWidth + spec.gap))
      const cap = reading ? readingCols(single) : spec.maxCols
      const next = Math.max(1, Math.min(cap, fits))
      setCols((prev) => (prev === next ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [spec, reading, single])

  const items: WallItem[] = useMemo(
    () => collapseUnlit(buildWallItems(entries, echoes, cols), lit, expandedSeams),
    [entries, echoes, cols, lit, expandedSeams],
  )

  /** Echo cards take focus and open, but are never selection targets — see wallItems. */
  const orderIds = useMemo(() => selectionOrder(items), [items])
  const multi = useEntryMultiSelect(orderIds)
  const { selectedIds, clearSelection, selectRangeTo, beginRange, endRange, navigateTo, setAnchor } =
    multi

  const selectedEntries = useMemo(() => {
    if (selectedIds.size === 0) return EMPTY_SELECTED
    return entries.filter((e) => selectedIds.has(e.id))
  }, [entries, selectedIds])
  const selectedRef = useRef(selectedEntries)
  selectedRef.current = selectedEntries

  /**
   * Excerpts are memoized against the entries alone — NOT against the zoom.
   *
   * They are built once at the largest budget any card can want and sliced per
   * card. Keying this on the line budget instead would rebuild 3,500 excerpts on
   * every frame of a pinch, which is the one thing that would make this surface
   * feel slow. Principle 3's latency rule is not only about the editor.
   */
  const excerpts = useMemo(() => {
    const cache = new Map<string, PageExcerpt>()
    for (const item of items) {
      if (item.seam || cache.has(item.entry.id)) continue
      cache.set(
        item.entry.id,
        pageExcerpt(item.entry, markQuotes.get(item.entry.id) ?? [], undefined, match),
      )
    }
    return cache
  }, [items, markQuotes, match])

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

  const yearRow = useMemo(() => yearRows(items, cols), [items, cols])

  /**
   * Where the months begin.
   *
   * Drawn as an overlay in the gutter, never as rows: the windowing math needs
   * every row the same height. Only the marks inside the rendered window are
   * laid out, so a decade of months costs nothing to scroll past.
   */
  const months = useMemo(() => monthMarks(items, cols), [items, cols])
  const visibleMonths = useMemo(
    // Row 0 is deliberately skipped: its rule would be drawn in the gap ABOVE
    // the first row, which doesn't exist. The sticky label already says which
    // month you're at when you're at the top.
    () => months.filter((m) => m.row > virtual.start && m.row < virtual.end),
    [months, virtual.start, virtual.end],
  )

  // The year of whatever is at the top of the viewport.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const read = () => {
      const row = Math.floor(el.scrollTop / rowHeight)
      const item = items[row * cols]
      setTopYear(item ? String(new Date(item.entry.created_at).getFullYear()) : null)
      setTopMonth(monthAtRow(items, cols, row))
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

  const itemsRef = useRef(items)
  itemsRef.current = items

  /**
   * Zoom, anchored.
   *
   * The page you were looking at has to stay under your cursor the whole way in
   * and out — without this the wall slides out from under you and the gesture
   * reads as broken rather than as moving closer. We remember which ITEM was at
   * the top of the viewport, then put it back after the new geometry lands.
   */
  const anchorRef = useRef<number | null>(null)

  const zoomBy = useCallback(
    (delta: number) => {
      const el = scrollRef.current
      if (el) anchorRef.current = Math.floor(el.scrollTop / rowHeight) * cols
      onZoom(clampZoom(zoom + delta))
    },
    [zoom, onZoom, rowHeight, cols],
  )

  // Layout effect, not an effect: restore the scroll position in the same frame
  // the new geometry paints, or the wall visibly jumps and then corrects itself.
  useLayoutEffect(() => {
    const idx = anchorRef.current
    if (idx === null) return
    anchorRef.current = null
    const el = scrollRef.current
    if (el) el.scrollTop = Math.floor(idx / cols) * rowHeight
  }, [cols, rowHeight])

  /**
   * Pinch and ⌘-scroll.
   *
   * A native non-passive listener because the handler must `preventDefault` —
   * React's onWheel is registered passively, so the browser would zoom the whole
   * page out from under the app instead.
   */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      // A trackpad pinch arrives as ctrlKey+wheel; ⌘-scroll is the deliberate
      // keyboard-modified version of the same intent.
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = wheelZoomDelta(e.deltaY, e.deltaMode)
      if (delta !== 0) zoomBy(delta)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomBy])

  /**
   * Open a page as a movement.
   *
   * The card claims the shared name synchronously, BEFORE the state change, so
   * it is carrying it when the browser snapshots the outgoing state. Exactly one
   * element may hold a given name at a time, which is why it is stamped on the
   * one card being opened rather than declared in CSS for all of them.
   */
  const openWithTransition = useCallback(
    (entryId: string) => {
      // Already reading — a click is just a click, not a second way in.
      if (reading) return
      const node = gridRef.current?.querySelector<HTMLElement>(
        `[data-wall-key="${CSS.escape(entryId)}"]`,
      )
      const release = claimTransitionName(node)
      // Opening a page IS zooming to it. The card claims the shared name first
      // so it is carrying it when the outgoing state is captured, and the leaf
      // it becomes claims it on the way in (`returningId`).
      withPageTransition(() => onOpen(entryId))
      window.setTimeout(release, 600)
    },
    [onOpen, reading],
  )

  /**
   * Bring the page you zoomed to into view.
   *
   * Opening a page is a zoom, so the wall has to land on it rather than wherever
   * it happened to be scrolled. Runs on the id, not on every geometry change, so
   * it doesn't fight ordinary scrolling once you are there.
   */
  const landedRef = useRef<string | null>(null)
  useLayoutEffect(() => {
    if (!returningId || landedRef.current === returningId) return
    const idx = itemsRef.current.findIndex((it) => !it.seam && it.entry.id === returningId)
    if (idx < 0) return
    landedRef.current = returningId
    scrollRef.current?.scrollTo({ top: Math.floor(idx / cols) * rowHeight, behavior: 'auto' })
  }, [returningId, cols, rowHeight])

  // Coming back: the card the reader shrinks into has to be carrying the name
  // by the time the browser snapshots the incoming state.
  useLayoutEffect(() => {
    if (!returningId) return
    const node = gridRef.current?.querySelector<HTMLElement>(
      `[data-wall-key="${CSS.escape(returningId)}"]`,
    )
    const release = claimTransitionName(node)
    const t = window.setTimeout(release, 600)
    return () => {
      window.clearTimeout(t)
      release()
    }
  }, [returningId])

  const focusCard = useCallback((key: string): boolean => {
    const node = gridRef.current?.querySelector<HTMLElement>(
      `[data-wall-key="${CSS.escape(key)}"]`,
    )
    node?.focus()
    return Boolean(node)
  }, [])

  /**
   * Move the roving focus.
   *
   * Scroll first, then focus, because windowing may not have mounted the target
   * yet. The common case by far is a neighbour that is already on screen, so try
   * synchronously and only wait a frame when the card genuinely isn't there —
   * one arrow key should not cost a frame, and `requestAnimationFrame` does not
   * fire at all while the document is hidden, which would strand the focus ring
   * on a card the user has already arrowed away from.
   */
  const moveFocus = useCallback(
    (next: number): WallItem | null => {
      const list = itemsRef.current
      const clamped = Math.max(0, Math.min(list.length - 1, next))
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
      const item = list[clamped] ?? null
      if (item && !focusCard(item.key)) {
        requestAnimationFrame(() => focusCard(item.key))
      }
      return item
    },
    [cols, rowHeight, spec.cardHeight, focusCard],
  )

  const openMenuAt = useCallback(
    (entryId: string, x: number, y: number) => {
      const entry = entries.find((e) => e.id === entryId)
      if (!entry) return
      const bulk = selectedRef.current
      // Right-clicking inside a multi-selection acts on the whole selection —
      // right-clicking outside one acts on the card under the cursor.
      if (bulk.length > 1 && bulk.some((e) => e.id === entryId)) {
        setPhase({ kind: 'closed' })
        setBulkPhase({ kind: 'menu', entries: bulk, x, y })
      } else {
        setBulkPhase({ kind: 'closed' })
        setPhase({ kind: 'menu', entry, x, y })
      }
    },
    [entries],
  )

  /**
   * Delete, then put the focus somewhere sensible.
   *
   * `nextEntryIdAfterDelete` picks the survivor the way the list did — the entry
   * that slides into the deleted one's place — which on a grid means the card
   * that is now physically where your eye already is.
   */
  const deleteAndRestoreFocus = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      const nextId = nextEntryIdAfterDelete(orderIds, ids)
      onDeleteEntries(ids, nextId ?? null)
      endRange()
      if (nextId) {
        navigateTo(nextId, 'single')
        setAnchor(nextId)
        // A frame, unconditionally: the card that slides into the gap does not
        // exist until the deletion has re-rendered the wall.
        requestAnimationFrame(() => focusCard(nextId))
      } else {
        clearSelection()
      }
    },
    [orderIds, onDeleteEntries, endRange, navigateTo, setAnchor, clearSelection, focusCard],
  )

  const handleMenuAction = useCallback(
    (action: EntryMenuAction, entry: Entry) => {
      if (action === 'delete') {
        deleteAndRestoreFocus([entry.id])
        closeMenu()
        return
      }
      onMenuAction(action, entry)
      closeMenu()
    },
    [deleteAndRestoreFocus, onMenuAction, closeMenu],
  )

  const handleBulkAction = useCallback(
    async (action: EntryBulkAction, bulk: Entry[]) => {
      try {
        switch (action) {
          case 'copy-text':
            await copyEntriesText(bulk)
            break
          case 'copy-markdown':
            await copyEntriesMarkdown(bulk)
            break
          case 'export-zip':
            await exportEntriesZip(bulk)
            break
          case 'delete':
            deleteAndRestoreFocus(bulk.map((e) => e.id))
            break
        }
      } catch {
        /* the parent surfaces load errors for delete */
      }
      closeBulkMenu()
    },
    [deleteAndRestoreFocus, closeBulkMenu],
  )

  const onCardFocus = useCallback((key: string) => {
    const idx = itemsRef.current.findIndex((it) => it.key === key)
    if (idx >= 0) setFocusIdx(idx)
  }, [])

  /**
   * Keys, scoped to the grid.
   *
   * Shift-extension routes through `moveFocus` rather than doing its own scroll
   * maths, because `moveFocus` is the one place that knows the target may not be
   * mounted yet.
   */
  const onCardKeyDown = useCallback(
    (key: string, e: React.KeyboardEvent) => {
      const list = itemsRef.current
      const base = list.findIndex((it) => it.key === key)
      if (base < 0) return
      const visibleRows = Math.max(1, Math.floor((scrollRef.current?.clientHeight ?? 0) / rowHeight))

      const step = (delta: number) => {
        e.preventDefault()
        const landed = moveFocus(base + delta)
        if (!landed || landed.echo) return
        if (e.shiftKey) {
          if (!multi.rangePivotId) beginRange(list[base]?.entry.id ?? landed.entry.id)
          selectRangeTo(landed.entry.id)
        }
      }

      switch (e.key) {
        case 'ArrowRight':
          return step(1)
        case 'ArrowLeft':
          return step(-1)
        case 'ArrowDown':
          return step(cols)
        case 'ArrowUp':
          return step(-cols)
        case 'PageDown':
          return step(cols * visibleRows)
        case 'PageUp':
          return step(-cols * visibleRows)
        case 'Home':
          return step(-base)
        case 'End':
          return step(list.length - 1 - base)
        case 'Enter':
        case ' ': {
          e.preventDefault()
          const item = list[base]!
          // Enter on a seam opens the run back up rather than opening the one
          // page that happens to sit at its head.
          if (item.seam) setExpandedSeams((prev) => new Set(prev).add(item.key))
          else openWithTransition(item.entry.id)
          return
        }
        case 'Escape':
          if (selectedIds.size === 0) return
          e.preventDefault()
          clearSelection()
          return
        case 'Backspace':
        case 'Delete': {
          e.preventDefault()
          const bulk = selectedRef.current
          if (bulk.length > 1) {
            setBulkPhase({ kind: 'confirm', entries: bulk })
            return
          }
          // A seam is not a page. Deleting "47 pages" from a keystroke aimed at
          // a placeholder is not a thing anyone should be able to do by accident.
          const item = list[base]!
          if (item.seam) return
          setPhase({ kind: 'confirm', entry: item.entry })
          return
        }
        default:
          // ⌘A over a grid of your own pages is what everyone expects it to be.
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
            e.preventDefault()
            multi.setSelectedIds(new Set(orderIds))
          }
      }
    },
    [
      cols,
      rowHeight,
      moveFocus,
      beginRange,
      selectRangeTo,
      clearSelection,
      selectedIds.size,
      openWithTransition,
      orderIds,
      multi,
    ],
  )

  return (
    <div className="pg__wall-wrap">
      <div className="pg__scroll" ref={scrollRef}>
        <div
          ref={gridRef}
          className="pg__grid"
          role="grid"
          aria-label="Your pages"
          data-cols={cols}
          data-reading={reading ? 'true' : undefined}
          aria-multiselectable
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: `${spec.gap}px`,
            paddingTop: virtual.topSpacer,
            paddingBottom: virtual.bottomSpacer,
            position: 'relative',
            // CSS reads the card height from here so the windowing math above
            // stays the only definition of it.
            ['--pg-card-h' as string]: `${spec.cardHeight}px`,
            // The spine between two open pages is drawn from the gutter.
            ['--pg-gutter' as string]: `${spec.gap}px`,
          }}
        >
          {/*
            Month rules, in the gutter.
            Absolutely positioned against the grid so they take no row and shift
            nothing — the alternative, a header in the flow, is exactly what
            makes rows uneven and windowing impossible.
          */}
          {visibleMonths.map((m) => (
            <span
              key={`${m.year}-${m.month}`}
              className="pg__month-rule"
              style={{ top: `${(m.row - virtual.start) * rowHeight}px` }}
              aria-hidden
            >
              {m.label}
            </span>
          ))}

          {slice.map((item, i) => {
            const idx = firstIdx + i
            if (item.seam) {
              const { count, fromIso, toIso } = item.seam
              return (
                <button
                  key={item.key}
                  type="button"
                  className="pg__seam"
                  data-wall-key={item.key}
                  tabIndex={idx === focusIdx || (focusIdx < 0 && idx === 0) ? 0 : -1}
                  onFocus={() => onCardFocus(item.key)}
                  onKeyDown={(e) => onCardKeyDown(item.key, e)}
                  onClick={() =>
                    setExpandedSeams((prev) => new Set(prev).add(item.key))
                  }
                  title="Show these pages"
                >
                  <span className="pg__seam-edges" aria-hidden />
                  <span className="pg__seam-n">{seamLabel(count, fromIso, toIso)}</span>
                </button>
              )
            }
            if (reading) {
              return (
                <div
                  key={item.key}
                  className="pg__leaf-cell"
                  data-wall-key={item.key}
                  tabIndex={idx === focusIdx || (focusIdx < 0 && idx === 0) ? 0 : -1}
                  onFocus={() => onCardFocus(item.key)}
                  onKeyDown={(e) => onCardKeyDown(item.key, e)}
                >
                  <Leaf
                    entry={item.entry}
                    shared={item.entry.id === returningId}
                    markQuotes={markQuotes.get(item.entry.id) ?? []}
                    firstLineTitle={firstLineTitle}
                    onEdit={onEdit}
                  />
                </div>
              )
            }
            return (
              <PageCard
                key={item.key}
                wallKey={item.key}
                entryId={item.entry.id}
                dateIso={item.entry.created_at}
                excerpt={excerpts.get(item.entry.id)!}
                maxLines={spec.lines}
                match={match}
                dim={lit !== null && !lit.has(item.entry.id)}
                active={item.entry.id === activeId && !item.echo}
                selected={!item.echo && selectedIds.has(item.entry.id)}
                context={!item.echo && item.entry.id === menuTargetId}
                echo={item.echo}
                tabIndex={idx === focusIdx || (focusIdx < 0 && idx === 0) ? 0 : -1}
                onFocus={onCardFocus}
                onKeyDown={onCardKeyDown}
                onOpen={openWithTransition}
                onEdit={onEdit}
                onClick={multi.handleRowClick}
                onOpenMenu={openMenuAt}
              />
            )
          })}
        </div>
      </div>

      {/*
        Where you are — the year like a thumb in the book, the month like a
        finger on the page. One stacked block so the two can't collide as the
        numeral resizes with the viewport.
      */}
      {topYear ? (
        <div className="pg__where" aria-hidden>
          <span className="pg__year">{topYear}</span>
          {topMonth ? <span className="pg__month-now">{topMonth}</span> : null}
        </div>
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

      {/*
        Floating over the wall rather than tucked into a panel header. The old
        bulk bar needed a whole separate canvas component to be legible in a
        260px sidebar; here there is room for it to simply be where the pages
        are.
      */}
      {selectedEntries.length >= 2 ? (
        <div className="pg__selection">
          <EntrySelectionBar
            layout="wall"
            count={selectedEntries.length}
            onCopyText={() => void copyEntriesText(selectedEntries)}
            onCopyMarkdown={() => void copyEntriesMarkdown(selectedEntries)}
            onExportZip={() => void exportEntriesZip(selectedEntries)}
            onDelete={() => setBulkPhase({ kind: 'confirm', entries: selectedEntries })}
            onClear={clearSelection}
          />
        </div>
      ) : null}

      <EntryContextMenu
        phase={phase}
        onClose={closeMenu}
        onAction={handleMenuAction}
        onRequestDelete={(entry) => setPhase({ kind: 'confirm', entry })}
      />
      <EntryBulkMenu
        phase={bulkPhase}
        onClose={closeBulkMenu}
        onAction={(action, bulk) => void handleBulkAction(action, bulk)}
        onRequestDelete={(bulk) => setBulkPhase({ kind: 'confirm', entries: bulk })}
      />
    </div>
  )
}
