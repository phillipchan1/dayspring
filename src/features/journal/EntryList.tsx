import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Entry } from '@/lib/types'
import { Brand } from '@/components/Mark'
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
import { EntrySelectionBar } from './EntrySelectionBar'
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
import {
  copyEntriesMarkdown,
  copyEntriesText,
  exportEntriesZip,
} from './entryBulkActions'
import { isInEditor } from './keyboard'

const NATIVE = isTauri()
const FLAT_VIRTUAL_THRESHOLD = 100

interface Props {
  entries: Entry[]
  activeId: string | null
  onSelect: (entry: Entry) => void
  onMenuAction: (action: EntryMenuAction, entry: Entry) => void
  onDeleteEntries: (ids: string[]) => Promise<void>
  query: string
  onQueryChange: (q: string) => void
  fullWidth?: boolean
}

export function EntryList({
  entries,
  activeId,
  onSelect,
  onMenuAction,
  onDeleteEntries,
  query,
  onQueryChange,
  fullWidth = false,
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

  const selectedEntries = useMemo(
    () => entries.filter((e) => multi.selectedIds.has(e.id)),
    [entries, multi.selectedIds],
  )

  const menuOpen = phase.kind !== 'closed' || bulkPhase.kind !== 'closed'

  useEffect(() => {
    if (multi.selectionCount < 2) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (phase.kind !== 'closed' || bulkPhase.kind !== 'closed') return
      e.preventDefault()
      e.stopPropagation()
      multi.clearSelection()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [multi.selectionCount, multi.clearSelection, phase.kind, bulkPhase.kind])

  const flatVirtual =
    !groups && !searching && entries.length >= FLAT_VIRTUAL_THRESHOLD
  const virtual = useVirtualRange(listRef, entries.length, flatVirtual)
  const flatSlice = flatVirtual ? entries.slice(virtual.start, virtual.end) : entries

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
    : `${entries.length} entries`

  const showSelectionBar = multi.selectionCount >= 2

  return (
    <aside
      ref={listRef}
      className={`entry-list${fullWidth ? ' entry-list--drawer' : ''}`}
      onContextMenu={blockNativeMenu}
      onKeyDown={(e) => {
        if (multi.selectionCount < 2) return
        if (e.key === 'Escape' && !menuOpen) {
          e.preventDefault()
          multi.clearSelection()
          return
        }
        if (e.key !== 'Backspace' && e.key !== 'Delete') return
        if (isInEditor(e.target) || (e.target as HTMLElement).closest('[data-entry-search]')) return
        e.preventDefault()
        setBulkPhase({ kind: 'confirm', entries: selectedEntries })
      }}
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
        {!fullWidth && (
          <Brand showMark={false} wordmarkRem={1.1} className="entry-list__brand" />
        )}
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
        {showSelectionBar ? (
          <EntrySelectionBar
            count={multi.selectionCount}
            onCopyText={() => void copyEntriesText(selectedEntries)}
            onCopyMarkdown={() => void copyEntriesMarkdown(selectedEntries)}
            onExportZip={() => void exportEntriesZip(selectedEntries)}
            onDelete={() => setBulkPhase({ kind: 'confirm', entries: selectedEntries })}
            onClear={multi.clearSelection}
          />
        ) : (
          <div className="entry-list__count-row">
            <span className="entry-list__count">{countLabel}</span>
            {groups && collapse.showBulkActions && (
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
          </div>
        )}
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
        data-active={active ? 'true' : undefined}
        data-selected={selected ? 'true' : undefined}
        data-context={context ? 'true' : undefined}
        onClick={(e) => {
          const result = onRowClick(entry.id, e)
          if (result === 'open') onSelect(entry)
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
