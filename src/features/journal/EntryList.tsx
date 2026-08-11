import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react'
import type { Entry } from '@/lib/types'
import { useSettings } from '@/hooks/useSettings'
import { deriveTitle } from './deriveTitle'
import { deriveEntryPreview } from '@/lib/entryLabels'
import { matchSnippet } from './search'
import {
  EntryContextMenu,
  type EntryMenuAction,
  type EntryMenuPhase,
} from './EntryContextMenu'
import { EntryBulkMenu, type EntryBulkAction, type EntryBulkMenuPhase } from './EntryBulkMenu'
import { useSuppressNativeContextMenu } from './useSuppressNativeContextMenu'
import { EntriesGroupToggle } from './EntriesGroupToggle'
import {
  flatIndexByEntryId,
  flattenDateGroups,
  groupEntries,
  groupMonthsByYear,
  groupYearsWithMonths,
  monthKeyForEntry,
  yearKeyForEntry,
  type EntriesGroupBy,
  type MonthGroup,
  type YearGroup,
  type YearSection,
} from './groupEntries'
import { nextEntryIdAfterDelete, orderedEntryIds } from './orderedEntryIds'
import { useEntryMultiSelect } from './useEntryMultiSelect'
import { useVirtualRange } from '@/hooks/useVirtualRange'
import { useEntryListKeyboard } from './useEntryListKeyboard'
import {
  copyEntriesMarkdown,
  copyEntriesText,
  exportEntriesZip,
} from './entryBulkActions'
import type { EntrySelectionChange } from './entrySelectionApi'
import {
  ENTRY_LIST_ROW_HEIGHT_PX,
  focusEntryRow,
  focusedEntryIdInList,
  scrollEntryIndexIntoView,
} from './entryListFocus'

const FLAT_VIRTUAL_THRESHOLD = 100
const EMPTY_SELECTED: Entry[] = []

interface Props {
  entries: Entry[]
  activeId: string | null
  /** True while a new entry is being composed but not yet persisted. */
  isNewEntry?: boolean
  onSelect: (entry: Entry) => void
  onEditEntry: (entry: Entry) => void
  /** Called after a row click selects (e.g. mobile closes the drawer). */
  onRowActivate?: () => void
  onMenuAction: (action: EntryMenuAction, entry: Entry) => void
  onDeleteEntries: (ids: string[], focusAfterId?: string | null) => void
  query: string
  onQueryChange: (q: string) => void
  fullWidth?: boolean
  onSelectionChange?: EntrySelectionChange
  /** Hide the list panel (desktop) — the discoverable handle for ⌘1. */
  onCollapse?: (() => void) | undefined
  /** True when the wall has the canvas — the panel stays, the mode changes. */
  pagesMode: boolean
  onPagesMode: (on: boolean) => void
}

export function EntryList({
  entries,
  activeId,
  isNewEntry = false,
  onSelect,
  onEditEntry,
  onRowActivate,
  onMenuAction,
  onDeleteEntries,
  query,
  onQueryChange,
  fullWidth = false,
  onSelectionChange,
  onCollapse,
  pagesMode,
  onPagesMode,
}: Props) {
  const { settings, update: updateSettings } = useSettings()
  const [phase, setPhase] = useState<EntryMenuPhase>({ kind: 'closed' })
  const [bulkPhase, setBulkPhase] = useState<EntryBulkMenuPhase>({ kind: 'closed' })
  const closeMenu = useCallback(() => setPhase({ kind: 'closed' }), [])
  const closeBulkMenu = useCallback(() => setBulkPhase({ kind: 'closed' }), [])
  const menuTargetId = phase.kind === 'closed' ? null : phase.entry.id
  const listRef = useRef<HTMLElement>(null)

  useSuppressNativeContextMenu(
    phase.kind !== 'closed' || bulkPhase.kind !== 'closed',
    () => {
      closeMenu()
      closeBulkMenu()
    },
  )

  const searching = query.trim().length > 0
  const groupBy: EntriesGroupBy = searching ? 'flat' : settings.entriesGroupBy
  const groups = useMemo(() => groupEntries(entries, groupBy), [entries, groupBy])
  const flatItems = useMemo(() => (groups ? flattenDateGroups(groups) : []), [groups])
  const flatIndexById = useMemo(() => flatIndexByEntryId(flatItems), [flatItems])
  const monthSections = useMemo(
    () => (groupBy === 'month' && !searching ? groupMonthsByYear(entries) : []),
    [entries, groupBy, searching],
  )
  const yearGroups = useMemo(
    () => (groupBy === 'year' && !searching ? groupYearsWithMonths(entries) : []),
    [entries, groupBy, searching],
  )
  const orderIds = useMemo(() => orderedEntryIds(entries, groups), [entries, groups])
  const multi = useEntryMultiSelect(orderIds)

  const activeEntry = useMemo(
    () => (activeId ? entries.find((e) => e.id === activeId) : undefined),
    [entries, activeId],
  )
  const activeMonthKey = activeEntry ? monthKeyForEntry(activeEntry) : null
  const activeYearKey = activeEntry ? yearKeyForEntry(activeEntry) : null

  const [expandedYears, setExpandedYears] = useState<Set<string>>(() => new Set())
  const yearInitRef = useRef(false)

  useEffect(() => {
    yearInitRef.current = false
    setExpandedYears(new Set())
  }, [groupBy])

  useEffect(() => {
    if (groupBy !== 'year' || yearGroups.length === 0) return
    if (!yearInitRef.current) {
      yearInitRef.current = true
      const seed = activeYearKey ?? yearGroups[0]!.key
      setExpandedYears(new Set([seed]))
      return
    }
    if (!activeYearKey) return
    setExpandedYears((prev) => {
      if (prev.has(activeYearKey)) return prev
      const next = new Set(prev)
      next.add(activeYearKey)
      return next
    })
  }, [groupBy, yearGroups, activeYearKey])

  const selectedEntries = useMemo(() => {
    if (multi.selectedIds.size === 0) return EMPTY_SELECTED
    return entries.filter((e) => multi.selectedIds.has(e.id))
  }, [entries, multi.selectedIds])

  const selectionSig = useMemo(() => {
    const ids = [...multi.selectedIds].sort().join('\0')
    return `${ids}|${multi.rangeActive ? 1 : 0}`
  }, [multi.selectedIds, multi.rangeActive])

  const selectionNotifyRef = useRef('')
  const selectionApiRef = useRef<{
    clear: () => void
    requestDelete: () => void
  }>({ clear: () => {}, requestDelete: () => {} })
  selectionApiRef.current.clear = multi.clearSelection
  selectionApiRef.current.requestDelete = () => {
    setBulkPhase({ kind: 'confirm', entries: selectedEntries })
  }

  const listVirtual = Boolean(groups) && flatItems.length >= FLAT_VIRTUAL_THRESHOLD
  const virtual = useVirtualRange(listRef, flatItems.length, listVirtual, ENTRY_LIST_ROW_HEIGHT_PX)
  const flatSlice = listVirtual ? flatItems.slice(virtual.start, virtual.end) : flatItems

  const scrollIndexForEntryId = useCallback(
    (entryId: string) => flatIndexById.get(entryId) ?? -1,
    [flatIndexById],
  )

  const menuOpen = phase.kind !== 'closed' || bulkPhase.kind !== 'closed'

  useEntryListKeyboard({
    listRef,
    orderIds,
    entries,
    activeId,
    flatVirtual: listVirtual,
    scrollIndexForEntryId,
    menuOpen,
    multi,
    onBrowse: onSelect,
    onEdit: onEditEntry,
    onDeleteSingle: (entry) => setPhase({ kind: 'confirm', entry }),
    onDeleteBulk: (bulk) => setBulkPhase({ kind: 'confirm', entries: bulk }),
    selectedEntries,
  })

  useEffect(() => {
    if (!onSelectionChange) return
    if (selectionNotifyRef.current === selectionSig) return
    selectionNotifyRef.current = selectionSig
    onSelectionChange(
      { entries: selectedEntries, rangeActive: multi.rangeActive },
      selectionApiRef.current,
    )
  }, [onSelectionChange, selectionSig, selectedEntries, multi.rangeActive])

  // Keep list focus during shift-range select (editor must not steal keys).
  useEffect(() => {
    if (!multi.rangeActive && multi.selectedIds.size === 0) return
    const listEl = listRef.current
    if (!listEl) return
    const focusId =
      focusedEntryIdInList(listEl) ??
      (multi.rangeActive ? multi.rangeExtentId : null) ??
      activeId ??
      [...multi.selectedIds][0]
    if (!focusId) return
    requestAnimationFrame(() => focusEntryRow(listEl, focusId))
  }, [multi.selectedIds, multi.rangeActive, multi.rangeExtentId, activeId])

  function openMenu(entry: Entry, x: number, y: number) {
    setBulkPhase({ kind: 'closed' })
    setPhase({ kind: 'menu', entry, x, y })
  }

  function openBulkMenu(entriesForMenu: Entry[], x: number, y: number) {
    setPhase({ kind: 'closed' })
    setBulkPhase({ kind: 'menu', entries: entriesForMenu, x, y })
  }

  function deleteEntriesAndRestoreFocus(ids: string[]) {
    if (ids.length === 0) return
    const nextId = nextEntryIdAfterDelete(orderIds, ids)
    const idSet = new Set(ids)
    const remaining = entries.filter((e) => !idSet.has(e.id))
    const nextEntry = nextId ? remaining.find((e) => e.id === nextId) : null
    const nextOrder = orderedEntryIds(remaining, groups)
    const nextIdx = nextId ? nextOrder.indexOf(nextId) : -1

    onDeleteEntries(ids, nextId ?? null)
    multi.endRange()
    if (nextEntry && nextId) {
      multi.navigateTo(nextId, 'single')
      multi.setAnchor(nextId)
      onSelect(nextEntry)
      requestAnimationFrame(() => {
        const listEl = listRef.current
        if (!listEl) return
        if (nextIdx >= 0) {
          const flatIdx = flatIndexById.get(nextId) ?? nextIdx
          scrollEntryIndexIntoView(listEl, flatIdx, listVirtual)
        }
        focusEntryRow(listEl, nextId)
      })
    } else {
      multi.clearSelection()
    }
  }

  function handleMenuAction(action: EntryMenuAction, entry: Entry) {
    if (action === 'delete') {
      void deleteEntriesAndRestoreFocus([entry.id])
      closeMenu()
      return
    }
    onMenuAction(action, entry)
    closeMenu()
  }

  async function handleBulkAction(action: EntryBulkAction, bulkEntries: Entry[]) {
    try {
      switch (action) {
        case 'copy-text':
          await copyEntriesText(bulkEntries)
          break
        case 'copy-markdown':
          await copyEntriesMarkdown(bulkEntries)
          break
        case 'export-zip':
          await exportEntriesZip(bulkEntries)
          break
        case 'delete':
          deleteEntriesAndRestoreFocus(bulkEntries.map((e) => e.id))
          break
      }
    } catch {
      /* parent surfaces load errors for delete */
    }
    closeBulkMenu()
  }

  function selectMonth(month: MonthGroup) {
    const entry = month.entries[0]
    if (entry) onSelect(entry)
  }

  function toggleYear(yearKey: string) {
    setExpandedYears((prev) => {
      const next = new Set(prev)
      if (next.has(yearKey)) next.delete(yearKey)
      else next.add(yearKey)
      return next
    })
  }

  function collapseOtherYears() {
    setExpandedYears(activeYearKey ? new Set([activeYearKey]) : new Set())
  }

  const showYearCollapse = groupBy === 'year' && yearGroups.length > 2

  function blockNativeMenu(e: React.MouseEvent) {
    e.preventDefault()
  }

  const countLabel = searching
    ? `${entries.length} match${entries.length === 1 ? '' : 'es'}`
    : multi.selectionCount >= 2
      ? `${multi.selectionCount} selected`
      : 'Journal'

  return (
    <aside
      ref={listRef}
      className={`entry-list${fullWidth ? ' entry-list--drawer' : ''}`}
      onContextMenu={blockNativeMenu}
    >
      <div className="entry-list__head" onContextMenu={blockNativeMenu}>
        <label className="entry-list__search-bar">
          <svg
            className="entry-list__search-icon"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            data-entry-search
            className="entry-list__search-input"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search entries..."
            onContextMenu={blockNativeMenu}
          />
        </label>
        {!searching && (
          <EntriesGroupToggle
            value={settings.entriesGroupBy}
            onChange={(entriesGroupBy) => updateSettings({ entriesGroupBy })}
            pagesMode={pagesMode}
            onPagesMode={onPagesMode}
          />
        )}
      </div>

      <div className="entry-list__body" onContextMenu={blockNativeMenu}>
        <div className="entry-list__journal-header">
          <span
            className={
              searching || multi.selectionCount >= 2
                ? 'entry-list__count'
                : 'entry-list__label'
            }
          >
            {countLabel}
          </span>
          <div className="entry-list__journal-actions">
            {showYearCollapse && multi.selectionCount < 2 && (
              <button
                type="button"
                className="entry-list__collapse-years"
                onClick={collapseOtherYears}
                title="Collapse other years"
                aria-label="Collapse other years"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 15l-6-6-6 6" />
                </svg>
              </button>
            )}
            {onCollapse && !fullWidth && (
              <button
                type="button"
                className="entry-list__collapse"
                onClick={onCollapse}
                title="Hide entries (⌘1)"
                aria-label="Hide entries list"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {isNewEntry && !searching && (
          <div className="entry-list__new-row">
            <span className="entry-row__title">New Entry</span>
          </div>
        )}

        {entries.length === 0 ? (
          <p className="entry-list__empty">{searching ? 'No matches.' : 'Nothing yet. Start writing →'}</p>
        ) : groupBy === 'month' && !searching ? (
          <MonthView
            sections={monthSections}
            activeMonthKey={activeMonthKey}
            onSelectMonth={selectMonth}
          />
        ) : groupBy === 'year' && !searching ? (
          <YearView
            years={yearGroups}
            expandedYears={expandedYears}
            activeYearKey={activeYearKey}
            activeMonthKey={activeMonthKey}
            onToggleYear={toggleYear}
            onSelectMonth={selectMonth}
          />
        ) : groups ? (
          <div
            className="entry-list__groups"
            style={
              listVirtual
                ? { paddingTop: virtual.topSpacer, paddingBottom: virtual.bottomSpacer }
                : undefined
            }
          >
            {flatSlice.map((item) =>
              item.kind === 'header' ? (
                <h3
                  key={item.key}
                  className={`entry-list__date-header${item.first ? ' entry-list__date-header--first' : ''}`}
                >
                  {item.label}
                </h3>
              ) : (
                <EntryRow
                  key={item.entry.id}
                  bare
                  entry={item.entry}
                  activeId={activeId}
                  menuTargetId={menuTargetId}
                  selected={multi.selectedIds.has(item.entry.id)}
                  query={query}
                  showEntryPreview={settings.showEntryPreview}
                  onSelect={onSelect}
                  onEditEntry={onEditEntry}
                  {...(onRowActivate ? { onRowActivate } : {})}
                  onRowClick={multi.handleRowClick}
                  onOpenMenu={openMenu}
                  onOpenBulkMenu={openBulkMenu}
                  selectedEntries={selectedEntries}
                />
              ),
            )}
          </div>
        ) : null}
      </div>

      <EntryContextMenu
        phase={phase}
        onClose={closeMenu}
        onAction={handleMenuAction}
        onRequestDelete={(entry) => setPhase({ kind: 'confirm', entry })}
      />
      <EntryBulkMenu
        phase={bulkPhase}
        onClose={closeBulkMenu}
        onAction={(action, bulkEntries) => void handleBulkAction(action, bulkEntries)}
        onRequestDelete={(bulkEntries) => setBulkPhase({ kind: 'confirm', entries: bulkEntries })}
      />
    </aside>
  )
}

interface MonthViewProps {
  sections: YearSection[]
  activeMonthKey: string | null
  onSelectMonth: (month: MonthGroup) => void
}

function MonthView({ sections, activeMonthKey, onSelectMonth }: MonthViewProps) {
  return (
    <div className="entry-list__month-view">
      {sections.map((section, sectionIndex) => (
        <section key={section.key} className="entry-list__year-section">
          <h3
            className={`entry-list__section-label${sectionIndex > 0 ? ' entry-list__section-label--spaced' : ''}`}
          >
            {section.label}
          </h3>
          {section.months.map((month) => {
            const active = month.key === activeMonthKey
            return (
              <button
                key={month.key}
                type="button"
                className="entry-list__month-row"
                data-active={active ? 'true' : undefined}
                onClick={() => onSelectMonth(month)}
              >
                <span className="entry-list__month-label">{month.label}</span>
                <span className="entry-list__count-badge">{month.entries.length}</span>
              </button>
            )
          })}
        </section>
      ))}
    </div>
  )
}

interface YearViewProps {
  years: YearGroup[]
  expandedYears: Set<string>
  activeYearKey: string | null
  activeMonthKey: string | null
  onToggleYear: (yearKey: string) => void
  onSelectMonth: (month: MonthGroup) => void
}

function YearView({
  years,
  expandedYears,
  activeYearKey,
  activeMonthKey,
  onToggleYear,
  onSelectMonth,
}: YearViewProps) {
  return (
    <div className="entry-list__year-view">
      <h3 className="entry-list__section-label entry-list__section-label--first">Years</h3>
      {years.map((year) => {
        const expanded = expandedYears.has(year.key)
        const yearActive = year.key === activeYearKey
        return (
          <section key={year.key} className="entry-list__year-block">
            <button
              type="button"
              className="entry-list__year-row"
              data-expanded={expanded ? 'true' : undefined}
              data-active={yearActive ? 'true' : undefined}
              aria-expanded={expanded}
              onClick={() => onToggleYear(year.key)}
            >
              <span className="entry-list__year-label">{year.label}</span>
              <span className="entry-list__count-badge">{year.count}</span>
            </button>
            {expanded && (
              <div className="entry-list__year-months">
                {year.months.map((month) => {
                  const active = month.key === activeMonthKey
                  return (
                    <button
                      key={month.key}
                      type="button"
                      className="entry-list__year-month-row"
                      data-active={active ? 'true' : undefined}
                      onClick={() => onSelectMonth(month)}
                    >
                      <span className="entry-list__year-month-label">{month.label}</span>
                      <span className="entry-list__count-badge entry-list__count-badge--sm">
                        {month.entries.length}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}


interface EntryRowProps {
  entry: Entry
  bare?: boolean
  activeId: string | null
  menuTargetId: string | null
  selected: boolean
  query: string
  showEntryPreview: boolean
  onSelect: (entry: Entry) => void
  onEditEntry: (entry: Entry) => void
  onRowActivate?: () => void
  onRowClick: ReturnType<typeof useEntryMultiSelect>['handleRowClick']
  onOpenMenu: (entry: Entry, x: number, y: number) => void
  onOpenBulkMenu: (entries: Entry[], x: number, y: number) => void
  selectedEntries: Entry[]
}

const LONG_PRESS_MS = 500
const LONG_PRESS_MOVE_PX = 10

const EntryRow = memo(function EntryRow({
  entry,
  bare = false,
  activeId,
  menuTargetId,
  selected,
  query,
  showEntryPreview,
  onSelect,
  onEditEntry,
  onRowActivate,
  onRowClick,
  onOpenMenu,
  onOpenBulkMenu,
  selectedEntries,
}: EntryRowProps) {
  const active = entry.id === activeId
  const context = entry.id === menuTargetId
  const derived = deriveTitle(entry.body_markdown)
  const untitled = !derived
  const title = derived || 'Untitled'
  const snippet = matchSnippet(entry.body_markdown, query)
  const preview = showEntryPreview && !query ? deriveEntryPreview(entry.body_markdown) : null

  // Touch gestures: long-press opens the context menu (no right-click on touch),
  // a plain tap opens the entry. Mouse keeps right-click + click/double-click.
  const pointerTypeRef = useRef<string>('mouse')
  const longPressedRef = useRef(false)
  const pressOriginRef = useRef<{ x: number; y: number } | null>(null)
  const longPressTimerRef = useRef<number | undefined>(undefined)

  const openMenuAt = (x: number, y: number) => {
    const inBulk = selectedEntries.length > 1 && selectedEntries.some((e) => e.id === entry.id)
    if (inBulk) onOpenBulkMenu(selectedEntries, x, y)
    else onOpenMenu(entry, x, y)
  }

  const cancelLongPress = () => {
    if (longPressTimerRef.current !== undefined) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = undefined
    }
    pressOriginRef.current = null
  }

  const row = (
      <button
        type="button"
        className="entry-row"
        data-entry-row
        data-entry-id={entry.id}
        data-active={active ? 'true' : undefined}
        data-selected={selected ? 'true' : undefined}
        data-context={context ? 'true' : undefined}
        data-untitled={untitled ? 'true' : undefined}
        data-has-preview={preview ? 'true' : undefined}
        title={active ? `${title} — Tab or Enter to edit` : title}
        onPointerDown={(e) => {
          pointerTypeRef.current = e.pointerType
          longPressedRef.current = false
          if (e.pointerType === 'mouse') return
          const { clientX: x, clientY: y } = e
          pressOriginRef.current = { x, y }
          cancelLongPress()
          longPressTimerRef.current = window.setTimeout(() => {
            longPressedRef.current = true
            longPressTimerRef.current = undefined
            openMenuAt(x, y)
          }, LONG_PRESS_MS)
        }}
        onPointerMove={(e) => {
          const origin = pressOriginRef.current
          if (!origin) return
          if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > LONG_PRESS_MOVE_PX) {
            cancelLongPress()
          }
        }}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onClick={(e) => {
          // A long-press already opened the menu — swallow the trailing click.
          if (longPressedRef.current) {
            longPressedRef.current = false
            e.preventDefault()
            return
          }
          // NOTE: a touch tap in the desktop list used to route straight to
          // onEditEntry. On iPad — and on a landscape iPhone, which is also >767px
          // and so takes the desktop layout — that meant every tap threw the
          // software keyboard up just to read an entry. A tap now browses on every
          // device; double-tap and the editor surface itself still open for writing.
          const result = onRowClick(entry.id, e)
          if (result === 'open') {
            onSelect(entry)
            onRowActivate?.()
            e.currentTarget.focus()
          } else if (result === 'range') {
            e.currentTarget.focus()
          }
        }}
        onDoubleClick={(e) => {
          e.preventDefault()
          onEditEntry(entry)
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          // Touch long-press is handled by the timer above; only act on a real
          // mouse right-click here so we don't open the menu twice.
          if (pointerTypeRef.current === 'mouse') openMenuAt(e.clientX, e.clientY)
        }}
      >
        <span className="entry-row__title">{title}</span>
        {snippet ? <span className="entry-row__snippet">{snippet}</span> : null}
        {preview && !snippet ? <span className="entry-row__preview">{preview}</span> : null}
      </button>
  )

  return bare ? row : <li>{row}</li>
}, entryRowPropsEqual)

function entryRowPropsEqual(prev: EntryRowProps, next: EntryRowProps): boolean {
  return (
    prev.entry.id === next.entry.id &&
    prev.entry.body_markdown === next.entry.body_markdown &&
    prev.activeId === next.activeId &&
    prev.menuTargetId === next.menuTargetId &&
    prev.selected === next.selected &&
    prev.query === next.query &&
    prev.bare === next.bare &&
    prev.showEntryPreview === next.showEntryPreview
  )
}
