import { useCallback, useRef, useState } from 'react'
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
import { useSuppressNativeContextMenu } from './useSuppressNativeContextMenu'
import { EntriesGroupToggle } from './EntriesGroupToggle'
import {
  formatEntryRowDate,
  groupEntries,
  type EntriesGroupBy,
  type EntryGroup,
} from './groupEntries'
import { useEntryGroupCollapse } from './useEntryGroupCollapse'
import { useVirtualRange } from './useVirtualRange'

const NATIVE = isTauri()
const FLAT_VIRTUAL_THRESHOLD = 100

interface Props {
  entries: Entry[]
  activeId: string | null
  onSelect: (entry: Entry) => void
  onMenuAction: (action: EntryMenuAction, entry: Entry) => void
  query: string
  onQueryChange: (q: string) => void
  fullWidth?: boolean
}

export function EntryList({
  entries,
  activeId,
  onSelect,
  onMenuAction,
  query,
  onQueryChange,
  fullWidth = false,
}: Props) {
  const { settings, update: updateSettings } = useSettings()
  const [phase, setPhase] = useState<EntryMenuPhase>({ kind: 'closed' })
  const closeMenu = useCallback(() => setPhase({ kind: 'closed' }), [])
  const menuTargetId = phase.kind === 'closed' ? null : phase.entry.id
  const listRef = useRef<HTMLElement>(null)

  useSuppressNativeContextMenu(phase.kind !== 'closed', closeMenu)

  const searching = query.trim().length > 0
  const groupBy: EntriesGroupBy = searching ? 'flat' : settings.entriesGroupBy
  const groups = groupEntries(entries, groupBy)
  const collapse = useEntryGroupCollapse(groups, groupBy, activeId, entries, entries.length)

  const flatVirtual =
    !groups && !searching && entries.length >= FLAT_VIRTUAL_THRESHOLD
  const virtual = useVirtualRange(listRef, entries.length, flatVirtual)
  const flatSlice = flatVirtual ? entries.slice(virtual.start, virtual.end) : entries

  function openMenu(entry: Entry, x: number, y: number) {
    setPhase({ kind: 'menu', entry, x, y })
  }

  function handleMenuAction(action: EntryMenuAction, entry: Entry) {
    onMenuAction(action, entry)
    closeMenu()
  }

  function blockNativeMenu(e: React.MouseEvent) {
    e.preventDefault()
  }

  const countLabel = searching
    ? `${entries.length} match${entries.length === 1 ? '' : 'es'}`
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
              query={query}
              groupBy={groupBy}
              onSelect={onSelect}
              onOpenMenu={openMenu}
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
              query={query}
              groupBy="flat"
              onSelect={onSelect}
              onOpenMenu={openMenu}
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
    </aside>
  )
}

interface EntryGroupSectionProps {
  group: EntryGroup
  expanded: boolean
  onToggle: () => void
  activeId: string | null
  menuTargetId: string | null
  query: string
  groupBy: EntriesGroupBy
  onSelect: (entry: Entry) => void
  onOpenMenu: (entry: Entry, x: number, y: number) => void
}

function EntryGroupSection({
  group,
  expanded,
  onToggle,
  activeId,
  menuTargetId,
  query,
  groupBy,
  onSelect,
  onOpenMenu,
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
              query={query}
              groupBy={groupBy}
              onSelect={onSelect}
              onOpenMenu={onOpenMenu}
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
  query: string
  groupBy: EntriesGroupBy
  onSelect: (entry: Entry) => void
  onOpenMenu: (entry: Entry, x: number, y: number) => void
}

function EntryRow({
  entry,
  activeId,
  menuTargetId,
  query,
  groupBy,
  onSelect,
  onOpenMenu,
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
        data-context={context ? 'true' : undefined}
        onClick={() => onSelect(entry)}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onOpenMenu(entry, e.clientX, e.clientY)
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
