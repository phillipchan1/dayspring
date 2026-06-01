/** Snapshot stored on each `history.pushState` / `replaceState` for in-app back/forward. */
export const APP_HISTORY_TAG = 'dayspring' as const

export type SettingsTab = 'appearance' | 'writing' | 'import' | 'shortcuts' | 'about'

export interface AppHistoryState {
  tag: typeof APP_HISTORY_TAG
  surface: 'journal' | 'reflections'
  entryId: string | null
  settings: { tab: SettingsTab; importSource: string | null } | null
  help: boolean
  sidebar: boolean
  restrictIds: string[] | null
}

export const DEFAULT_APP_HISTORY: AppHistoryState = {
  tag: APP_HISTORY_TAG,
  surface: 'journal',
  entryId: null,
  settings: null,
  help: false,
  sidebar: false,
  restrictIds: null,
}

export function isAppHistoryState(value: unknown): value is AppHistoryState {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as AppHistoryState).tag === APP_HISTORY_TAG
  )
}

export function readAppHistoryState(): AppHistoryState | null {
  return isAppHistoryState(history.state) ? history.state : null
}

/** Merge a partial patch; nested `settings` replaces the whole settings slot when provided. */
export function mergeAppHistory(
  prev: AppHistoryState,
  patch: Partial<AppHistoryState>,
): AppHistoryState {
  const next: AppHistoryState = { ...prev, ...patch, tag: APP_HISTORY_TAG }
  if ('settings' in patch) next.settings = patch.settings ?? null
  return next
}

export function appHistoryEqual(a: AppHistoryState, b: AppHistoryState): boolean {
  return (
    a.surface === b.surface &&
    a.entryId === b.entryId &&
    a.help === b.help &&
    a.sidebar === b.sidebar &&
    JSON.stringify(a.settings) === JSON.stringify(b.settings) &&
    JSON.stringify(a.restrictIds) === JSON.stringify(b.restrictIds)
  )
}

/** Canonical app URL without OAuth hash fragments or query noise. */
export function appHistoryUrl(): string {
  return `${window.location.origin}${window.location.pathname}`
}

export function pushAppHistory(state: AppHistoryState): void {
  history.pushState(state, '', appHistoryUrl())
}

export function replaceAppHistory(state: AppHistoryState): void {
  history.replaceState(state, '', appHistoryUrl())
}

/** Remove Supabase OAuth tokens from the address bar after sign-in. */
export function stripAuthUrlNoise(): void {
  if (!window.location.hash && !window.location.search) return
  history.replaceState(history.state, '', appHistoryUrl())
}
