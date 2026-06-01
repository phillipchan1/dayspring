import type { ReactNode } from 'react'
import type { Entry } from '@/lib/types'
import type { EntryMenuAction } from './EntryContextMenu'
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
  onEntryMenuAction: (action: EntryMenuAction, entry: Entry) => void
  onDeleteEntries: (ids: string[]) => Promise<void>
  onNew: () => void
  query: string
  onQueryChange: (q: string) => void
  /** Route to the Reflections ("Looking back") surface. */
  onLookBack: () => void
  onOpenSettings: () => void
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
}
