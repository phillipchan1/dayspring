import type { ReactNode } from 'react'
import type { Entry } from '@/lib/types'
import type { Settings } from '@/lib/settings'
import type { SaveStatus } from '@/hooks/useAutosave'

export interface FocusApi {
  active: boolean
  enter: () => void
  exit: () => void
  toggle: () => void
}

export type ViewMode = 'write' | 'read'

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
  onNew: () => void
  query: string
  onQueryChange: (q: string) => void
  mode: ViewMode
  onToggleMode: () => void
  /** Route to the Reflections ("Looking back") surface. */
  onLookBack: () => void
  onOpenSettings: () => void
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  focus: FocusApi
  /** The active surface (editor in write mode, reader in read mode). */
  mainSlot: ReactNode
}
