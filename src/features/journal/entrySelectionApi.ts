import type { Entry } from '@/lib/types'

export interface EntrySelectionApi {
  clear: () => void
  requestDelete: () => void
}

export interface EntrySelectionState {
  entries: Entry[]
  /** Shift+arrow range in progress (pivot locked). */
  rangeActive: boolean
}

export type EntrySelectionChange = (state: EntrySelectionState, api: EntrySelectionApi) => void
