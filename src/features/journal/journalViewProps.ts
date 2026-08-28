import type { ReactNode } from 'react'
import type { Entry } from '@/lib/types'
import type { EntryMenuAction } from './EntryContextMenu'
import type { EntrySelectionChange } from './entrySelectionApi'
import type { EntryReturnContext } from '@/lib/appHistory'
import type { Settings } from '@/lib/settings'
import type { SaveStatus } from '@/hooks/useAutosave'
import type { SlashCommandId } from '@/editor/slashDetect'

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
  /** The sidebar reports its multi-selection so the canvas can render it. */
  onSelectionChange?: EntrySelectionChange
  /** True when two or more entries are selected. */
  bulkActive: boolean
  bulkCount: number
  /** Shift+arrow range in progress — the editor stays hidden. */
  rangeSelectActive: boolean
  onEntryMenuAction: (action: EntryMenuAction, entry: Entry) => void
  /** `focusAfterId` — next page to browse after delete; `null` — blank new doc. */
  onDeleteEntries: (ids: string[], focusAfterId?: string | null) => void
  onNew: () => void
  /** True while a new entry is being composed but not yet persisted. */
  isNewEntry: boolean
  /** Route to the Reflections ("Looking back") surface. */
  onLookBack: () => void
  /** Route to the Lamp (scripture canon) surface. */
  onScripture: () => void
  /** Route to the Altar surface. */
  onAltar: () => void
  /** Altar is gated behind the `altar` feature flag until it's ready to ship. */
  altarEnabled: boolean
  onOpenSettings: () => void
  /** Force a full re-sync from the server (pull latest + flush outbox). */
  onSync: () => void
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  focus: FocusApi
  /** Mobile entries drawer. */
  sidebarOpen: boolean
  /** Open / dismiss the drawer as a history frame — Back and the scrim pop it. */
  onToggleSidebar: () => void
  /**
   * Close the drawer after a navigation made INSIDE it (opening an entry).
   *
   * Not `onToggleSidebar`: that pops the drawer's frame, and the navigation was
   * just committed onto that same frame — see `consumeDrawerFrame`.
   */
  onDrawerNavigated: () => void
  /** ⌘1 / rail "Pages" / mobile tab — the archive itself. */
  onPages: () => void
  /** The editor surface for the active entry. */
  mainSlot: ReactNode
  /** True when Looking back fills the main canvas. */
  reflectionsActive: boolean
  /** True when the Altar fills the main canvas. */
  altarActive: boolean
  /** True when the Lamp surface fills the main canvas. */
  scriptureActive: boolean
  /** True when the Pages wall fills the canvas. */
  pagesActive: boolean
  /** Open ⌘K — Find (instant, local) or Ask (the Well). */
  onFindOrAsk: () => void
  /** Set when reading an entry opened from Lamp / Altar / Ascent. */
  entryReturn: EntryReturnContext | null
  onReturnFromEntry: () => void

  /**
   * Run a capture command at the caret, the way `/ritual` would.
   *
   * The layout owns the blank-page door into the rituals, so it needs a way to
   * reach the editor's imperative handle without holding the ref itself.
   */
  onCommand: (cmd: SlashCommandId) => void
}
