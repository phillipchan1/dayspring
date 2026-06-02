import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Entry } from '@/lib/types'
import { isTauri, MAC_TRAFFIC_INSET } from '@/lib/platform'
import { useSettings } from '@/hooks/useSettings'
import { deriveTitle } from './deriveTitle'
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
  formatEntryRowDate,
  groupEntries,
  type EntriesGroupBy,
  type EntryGroup,
} from './groupEntries'
import { orderedEntryIds } from './orderedEntryIds'
import { useEntryGroupCollapse } from './useEntryGroupCollapse'
import { useEntryMultiSelect } from './useEntryMultiSelect'
import { useVirtualRange } from './useVirtualRange'
import { useEntryListKeyboard } from './useEntryListKeyboard'
import {
  copyEntriesMarkdown,
  copyEntriesText,
  exportEntriesZip,
} from './entryBulkActions'
import type { EntrySelectionChange } from './entrySelectionApi'
import { focusEntryRow, focusedEntryIdInList } from './entryListFocus'

const NATIVE = isTauri()
const FLAT_VIRTUAL_THRESHOLD = 100
const EMPTY_SELECTED: Entry[] = []

interface Props {
  entries: Entry[]
  activeId: string | null
  onSelect: (entry: Entry) => void
  onEditEntry: (entry: Entry) => void
  /** Called after a row click selects (e.g. mobile closes the drawer). */
  onRowActivate?: () => void
  onMenuAction: (action: EntryMenuAction, entry: Entry) => void
  onDeleteEntries: (ids: string[]) => Promise<void>
  query: string
  onQueryChange: (q: string) => void
  fullWidth?: boolean
  onSelectionChange?: EntrySelectionChange
  /** Hide the list panel (desktop) — the discoverable handle for ⌘1. */
  onCollapse?: (() => void) | undefined
}

export function EntryList({
  entries,
  activeId,
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
  const groups = groupEntries(entries, groupBy)
  const collapse = useEntryGroupCollapse(groups, groupBy, activeId, entries, entries.length)
  const orderIds = useMemo(() => orderedEntryIds(entries, groups), [entries, groups])
  const multi = useEntryMultiSelect(orderIds)

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

  const flatVirtual =
    !groups && !searching && entries.length >= FLAT_VIRTUAL_THRESHOLD
  const virtual = useVirtualRange(listRef, entries.length, flatVirtual)
  const flatSlice = flatVirtual ? entries.slice(virtual.start, virtual.end) : entries

  const menuOpen = phase.kind !== 'closed' || bulkPhase.kind !== 'closed'

  useEntryListKeyboard({
    listRef,
    orderIds,
    entries,
    activeId,
    flatVirtual,
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

  function handleMenuAction(action: EntryMenuAction, entry: Entry) {
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
          await onDeleteEntries(bulkEntries.map((e) => e.id))
          multi.clearSelection()
          break
      }
    } catch {
      /* parent surfaces load errors for delete */
    }
    closeBulkMenu()
  }

  function blockNativeMenu(e: React.MouseEvent) {
    e.preventDefault()
  }

  const countLabel = searching
    ? `${entries.length} match${entries.length === 1 ? '' : 'es'}`
    : multi.selectionCount >= 2
      ? `${multi.selectionCount} selected`
      : `${entries.length} entries`

  return (
    <aside
      ref={listRef}
      className={`entry-list${fullWidth ? ' entry-list--drawer' : ''}`}
      onContextMenu={blockNativeMenu}
    >
      <div
        className="entry-list__head"
        style={
          NATIVE && !fullWidth
            ? {
                paddingTop: MAC_TRAFFIC_INSET.sidebarTop,
                paddingLeft: MAC_TRAFFIC_INSET.sidebarX,
                paddingRight: MAC_TRAFFIC_INSET.sidebarX,
              }
            : undefined
        }
        onContextMenu={blockNativeMenu}
      >
        <input
          data-entry-search
          className="entry-list__search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search entries…"
          onContextMenu={blockNativeMenu}
        />
        {!searching && (
          <EntriesGroupToggle
            value={settings.entriesGroupBy}
            onChange={(entriesGroupBy) => updateSettings({ entriesGroupBy })}
          />
        )}
        <div className="entry-list__count-row">
          <span className="entry-list__count">{countLabel}</span>
          {groups && collapse.showBulkActions && multi.selectionCount < 2 && (
              <span className="entry-list__bulk">
                <button type="button" className="entry-list__bulk-btn" onClick={collapse.collapseOlder}>
                  Collapse older
                </button>
                {entries.length < 200 && (
                  <>
                    <span className="entry-list__bulk-sep" aria-hidden>
                      ·
                    </span>
                    <button type="button" className="entry-list__bulk-btn" onClick={collapse.expandAll}>
                      Expand all
                    </button>
                  </>
                )}
              </span>
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

      {entries.length === 0 ? (
        <p className="entry-list__empty" onContextMenu={blockNativeMenu}>
          {searching ? 'No matches.' : 'Nothing yet. Start writing →'}
        </p>
      ) : groups ? (
        <div className="entry-list__groups" onContextMenu={blockNativeMenu}>
          {groups.map((group) => (
            <EntryGroupSection
              key={group.key}
              group={group}
              expanded={collapse.isExpanded(group.key)}
              onToggle={() => collapse.toggle(group.key)}
              activeId={activeId}
              menuTargetId={menuTargetId}
              selectedIds={multi.selectedIds}
              query={query}
              groupBy={groupBy}
              onSelect={onSelect}
              onEditEntry={onEditEntry}
              {...(onRowActivate ? { onRowActivate } : {})}
              onRowClick={multi.handleRowClick}
              onOpenMenu={openMenu}
              onOpenBulkMenu={openBulkMenu}
              selectedEntries={selectedEntries}
            />
          ))}
        </div>
      ) : (
        <ul
          className="entry-list__flat"
          style={
            flatVirtual
              ? { paddingTop: virtual.topSpacer, paddingBottom: virtual.bottomSpacer }
              : undefined
          }
          onContextMenu={blockNativeMenu}
        >
          {flatSlice.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              activeId={activeId}
              menuTargetId={menuTargetId}
              selected={multi.selectedIds.has(entry.id)}
              query={query}
              groupBy="flat"
              onSelect={onSelect}
              onEditEntry={onEditEntry}
              {...(onRowActivate ? { onRowActivate } : {})}
              onRowClick={multi.handleRowClick}
              onOpenMenu={openMenu}
              onOpenBulkMenu={openBulkMenu}
              selectedEntries={selectedEntries}
            />
          ))}
        </ul>
      )}

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

interface EntryGroupSectionProps {
  group: EntryGroup
  expanded: boolean
  onToggle: () => void
  activeId: string | null
  menuTargetId: string | null
  selectedIds: Set<string>
  query: string
  groupBy: EntriesGroupBy
  onSelect: (entry: Entry) => void
  onEditEntry: (entry: Entry) => void
  onRowActivate?: () => void
  onRowClick: ReturnType<typeof useEntryMultiSelect>['handleRowClick']
  onOpenMenu: (entry: Entry, x: number, y: number) => void
  onOpenBulkMenu: (entries: Entry[], x: number, y: number) => void
  selectedEntries: Entry[]
}

function EntryGroupSection({
  group,
  expanded,
  onToggle,
  activeId,
  menuTargetId,
  selectedIds,
  query,
  groupBy,
  onSelect,
  onEditEntry,
  onRowActivate,
  onRowClick,
  onOpenMenu,
  onOpenBulkMenu,
  selectedEntries,
}: EntryGroupSectionProps) {
  const count = group.entries.length

  return (
    <section className="entry-list__group" data-expanded={expanded ? 'true' : 'false'}>
      <button
        type="button"
        className="entry-list__group-toggle"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className="entry-list__group-chevron" aria-hidden />
        <span className="entry-list__group-label">{group.label}</span>
        <span className="entry-list__group-count">{count}</span>
      </button>
      {expanded && (
        <ul className="entry-list__group-list">
          {group.entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              activeId={activeId}
              menuTargetId={menuTargetId}
              selected={selectedIds.has(entry.id)}
              query={query}
              groupBy={groupBy}
              onSelect={onSelect}
              onEditEntry={onEditEntry}
              {...(onRowActivate ? { onRowActivate } : {})}
              onRowClick={onRowClick}
              onOpenMenu={onOpenMenu}
              onOpenBulkMenu={onOpenBulkMenu}
              selectedEntries={selectedEntries}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface EntryRowProps {
  entry: Entry
  activeId: string | null
  menuTargetId: string | null
  selected: boolean
  query: string
  groupBy: EntriesGroupBy
  onSelect: (entry: Entry) => void
  onEditEntry: (entry: Entry) => void
  onRowActivate?: () => void
  onRowClick: ReturnType<typeof useEntryMultiSelect>['handleRowClick']
  onOpenMenu: (entry: Entry, x: number, y: number) => void
  onOpenBulkMenu: (entries: Entry[], x: number, y: number) => void
  selectedEntries: Entry[]
}

function EntryRow({
  entry,
  activeId,
  menuTargetId,
  selected,
  query,
  groupBy,
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
  const title = deriveTitle(entry.body_markdown) || 'Untitled'
  const snippet = matchSnippet(entry.body_markdown, query)
  const dateLabel = formatEntryRowDate(entry.created_at, groupBy)

  return (
    <li>
      <button
        type="button"
        className="entry-row"
        data-entry-row
        data-entry-id={entry.id}
        data-active={active ? 'true' : undefined}
        data-selected={selected ? 'true' : undefined}
        data-context={context ? 'true' : undefined}
        title={active ? `${title} — Tab or Enter to edit` : title}
        onClick={(e) => {
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
          const inBulk =
            selectedEntries.length > 1 && selectedEntries.some((x) => x.id === entry.id)
          if (inBulk) onOpenBulkMenu(selectedEntries, e.clientX, e.clientY)
          else onOpenMenu(entry, e.clientX, e.clientY)
        }}
      >
        <span className="entry-row__title">{title}</span>
        {snippet ? <span className="entry-row__snippet">{snippet}</span> : null}
        <span className="entry-row__meta">
          {dateLabel} · {entry.word_count} w
        </span>
      </button>
    </li>
  )
}
