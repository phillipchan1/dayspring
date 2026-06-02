// Tiny external store for connectivity / sync status, surfaced in the UI.

export interface SyncState {
  online: boolean
  pending: number // queued local writes not yet on the server
  lastSyncedAt: number | null
  /** True while a full library pull from the server is in flight (background). */
  pulling: boolean
}

let state: SyncState = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pending: 0,
  lastSyncedAt: null,
  pulling: false,
}

const listeners = new Set<() => void>()
function emit() {
  for (const l of listeners) l()
}

export const syncStore = {
  get(): SyncState {
    return state
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  setOnline(online: boolean): void {
    if (state.online === online) return
    state = { ...state, online }
    emit()
  },
  setPending(pending: number): void {
    if (state.pending === pending) return
    state = { ...state, pending }
    emit()
  },
  setSynced(ts: number): void {
    state = { ...state, online: true, lastSyncedAt: ts }
    emit()
  },
  setPulling(pulling: boolean): void {
    if (state.pulling === pulling) return
    state = { ...state, pulling }
    emit()
  },
}
