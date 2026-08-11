import type { ReactNode } from 'react'
import type { Entry } from '@/lib/types'
import type { EntryMenuAction } from './EntryContextMenu'
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
  /** ⌘1 / rail "Entries" / mobile tab — goes to the Pages wall. */
  onToggleEntries: () => void
  /** The editor surface for the active entry. */
  mainSlot: ReactNode
  /** True when Looking back fills the main canvas. */
  reflectionsActive: boolean
  /** True when the Altar fills the main canvas. */
  altarActive: boolean
  /** True when the Lamp surface fills the main canvas. */
  scriptureActive: boolean
  /** True when the Pages wall fills the main canvas — i.e. you are in Entries. */
  pagesActive: boolean
  /** Open ⌘K — Find (instant, local) or Ask (the Well). */
  onFindOrAsk: () => void
  /** Set when reading an entry opened from Lamp / Altar / Ascent. */
  entryReturn: EntryReturnContext | null
  onReturnFromEntry: () => void
}
