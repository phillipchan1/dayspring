import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useVirtualRange } from '@/features/journal/useVirtualRange'
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
import { buildWallItems, selectionOrder, yearRows, type WallItem } from './wallItems'
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
  /** Click — read the page in the Spread. */
  onOpen: (entryId: string) => void
  /** Double-click, or "Open to write" — leave for the editor. */
  onEdit: (entryId: string) => void
  onMenuAction: (action: EntryMenuAction, entry: Entry) => void
  onDeleteEntries: (ids: string[], focusAfterId?: string | null) => void
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
  density,
  markQuotes,
  lit,
  activeId,
  echoes,
  onOpen,
  onEdit,
  onMenuAction,
  onDeleteEntries,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const spec = DENSITY[density]
  const [cols, setCols] = useState(1)
  const [focusIdx, setFocusIdx] = useState(-1)
  const [topYear, setTopYear] = useState<string | null>(null)
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
      const next = Math.max(1, Math.min(spec.maxCols, Math.floor((w + spec.gap) / (spec.minWidth + spec.gap))))
      setCols((prev) => (prev === next ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [spec])

  const items: WallItem[] = useMemo(
    () => buildWallItems(entries, echoes, cols),
    [entries, echoes, cols],
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

  const yearRow = useMemo(() => yearRows(items, cols), [items, cols])

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

  const itemsRef = useRef(items)
  itemsRef.current = items

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
        case ' ':
          e.preventDefault()
          onOpen(list[base]!.entry.id)
          return
        case 'Escape':
          if (selectedIds.size === 0) return
          e.preventDefault()
          clearSelection()
          return
        case 'Backspace':
        case 'Delete': {
          e.preventDefault()
          const bulk = selectedRef.current
          if (bulk.length > 1) setBulkPhase({ kind: 'confirm', entries: bulk })
          else {
            const entry = list[base]!.entry
            setPhase({ kind: 'confirm', entry })
          }
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
      onOpen,
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
          aria-multiselectable
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
              <PageCard
                key={item.key}
                wallKey={item.key}
                entryId={item.entry.id}
                dateIso={item.entry.created_at}
                excerpt={excerpts.get(item.entry.id)!}
                dim={lit !== null && !lit.has(item.entry.id)}
                active={item.entry.id === activeId && !item.echo}
                selected={!item.echo && selectedIds.has(item.entry.id)}
                context={!item.echo && item.entry.id === menuTargetId}
                echo={item.echo}
                tabIndex={idx === focusIdx || (focusIdx < 0 && idx === 0) ? 0 : -1}
                onFocus={onCardFocus}
                onKeyDown={onCardKeyDown}
                onOpen={onOpen}
                onEdit={onEdit}
                onClick={multi.handleRowClick}
                onOpenMenu={openMenuAt}
              />
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
