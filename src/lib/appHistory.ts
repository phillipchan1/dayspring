/** Snapshot stored on each `history.pushState` / `replaceState` for in-app back/forward. */
export const APP_HISTORY_TAG = 'dayspring' as const

export type SettingsTab = 'appearance' | 'writing' | 'import' | 'shortcuts' | 'about'

export interface AppHistoryState {
  tag: typeof APP_HISTORY_TAG
  surface: 'journal' | 'reflections' | 'altar' | 'scripture'
  entryId: string | null
  settings: { tab: SettingsTab; importSource: string | null } | null
  help: boolean
  sidebar: boolean
  restrictIds: string[] | null
  /** OSIS of the open Scripture book panel (null = canon map). Its own history
   *  frame so Back / Esc / the rail all close the panel predictably. */
  scriptureBook: string | null
  /** Verse osis_ref the book panel opens focused on (a returning-strip jump). */
  scriptureVerse: string | null
}

export const DEFAULT_APP_HISTORY: AppHistoryState = {
  tag: APP_HISTORY_TAG,
  surface: 'journal',
  entryId: null,
  settings: null,
  help: false,
  sidebar: false,
  restrictIds: null,
  scriptureBook: null,
  scriptureVerse: null,
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
    a.scriptureBook === b.scriptureBook &&
    a.scriptureVerse === b.scriptureVerse &&
    JSON.stringify(a.settings) === JSON.stringify(b.settings) &&
    JSON.stringify(a.restrictIds) === JSON.stringify(b.restrictIds)
  )
}

export const LAMP_PATH = '/lamp' as const
export const LEGACY_SCRIPTURE_PATH = '/scripture' as const

export function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/** User-facing path for a main canvas surface (Lamp only has a dedicated segment). */
export function pathForSurface(surface: AppHistoryState['surface']): string {
  return surface === 'scripture' ? LAMP_PATH : '/'
}

/** Map a bookmarked path to a canvas surface, when history.state is missing. */
export function surfaceFromPath(pathname: string): AppHistoryState['surface'] | null {
  const p = normalizePathname(pathname)
  if (p === LAMP_PATH || p === LEGACY_SCRIPTURE_PATH) return 'scripture'
  return null
}

export function isLegacyScripturePath(pathname: string): boolean {
  return normalizePathname(pathname) === LEGACY_SCRIPTURE_PATH
}

/** Canonical app URL for a history frame (no OAuth hash/query). */
export function appHistoryUrl(state: AppHistoryState): string {
  return `${window.location.origin}${pathForSurface(state.surface)}`
}

export function pushAppHistory(state: AppHistoryState): void {
  history.pushState(state, '', appHistoryUrl(state))
}

export function replaceAppHistory(state: AppHistoryState): void {
  history.replaceState(state, '', appHistoryUrl(state))
}

/** Remove Supabase OAuth tokens from the address bar after sign-in. */
export function stripAuthUrlNoise(): void {
  if (!window.location.hash && !window.location.search) return
  const current = readAppHistoryState() ?? DEFAULT_APP_HISTORY
  history.replaceState(history.state, '', appHistoryUrl(current))
}
