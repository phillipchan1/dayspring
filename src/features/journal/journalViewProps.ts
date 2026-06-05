import type { ReactNode } from 'react'
import type { Entry } from '@/lib/types'
import type { EntryMenuAction } from './EntryContextMenu'
import type { EntrySelectionChange } from './entrySelectionApi'
import type { EntryReturnContext } from '@/lib/appHistory'
import type { Settings } from '@/lib/settings'
import type { SaveStatus } from '@/hooks/useAutosave'

export interface FocusApi {
  active: boolean
  enter: () => void
  exit: () => void
  toggle: () => void
}

/** Everything a layout (desktop or mobile) needs. State lives in JournalScreen. */
export interface JournalViewProps {
  userEmail: string
  entries: Entry[]
  activeId: string | null
  words: number
  status: SaveStatus
  lastSavedAt: number | null
  saveError: string | null
  onSelect: (entry: Entry) => void
  /** Load entry and focus the editor for typing (Enter / double-click). */
  onEditEntry: (entry: Entry) => void
  /** Sidebar reports multi-select state for the main canvas. */
  onSelectionChange?: EntrySelectionChange
  /** True when two or more entries are selected. */
  bulkActive: boolean
  bulkCount: number
  /** Shift+arrow range in progress — editor stays hidden. */
  rangeSelectActive: boolean
  onEntryMenuAction: (action: EntryMenuAction, entry: Entry) => void
  /** `focusAfterId` — next row to browse after delete; `null` — blank new doc. */
  onDeleteEntries: (ids: string[], focusAfterId?: string | null) => void
  onNew: () => void
  query: string
  onQueryChange: (q: string) => void
  /** Route to the Reflections ("Looking back") surface. */
  onLookBack: () => void
  /** Route to the Lamp (scripture canon) surface. */
  onScripture: () => void
  /** Route to the Altar surface. */
  onAltar: () => void
  onOpenSettings: () => void
  /** Force a full re-sync from the server (pull latest + flush outbox). */
  onSync: () => void
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  focus: FocusApi
  sidebarOpen: boolean
  onToggleSidebar: () => void
  /** Desktop entries-panel open state — lifted to JournalScreen so ⌘K can open
   *  it (mobile uses `sidebarOpen` for its drawer and ignores these). */
  entriesOpen: boolean
  onToggleEntries: () => void
  /** The editor surface for the active entry. */
  mainSlot: ReactNode
  /** True when Looking back fills the main canvas (rail + entries stay visible). */
  reflectionsActive: boolean
  /** True when the Altar fills the main canvas. */
  altarActive: boolean
  /** True when the Lamp surface fills the main canvas. */
  scriptureActive: boolean
  /** Set when reading an entry opened from Lamp / Altar / Ascent. */
  entryReturn: EntryReturnContext | null
  onReturnFromEntry: () => void
}
