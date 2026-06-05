/** Snapshot stored on each `history.pushState` / `replaceState` for in-app back/forward. */
export const APP_HISTORY_TAG = 'dayspring' as const

export type SettingsTab = 'appearance' | 'writing' | 'import' | 'shortcuts' | 'billing' | 'about'

/** Where the user was before opening an entry from Lamp, Altar, Ascent, or Threads. */
export type EntryReturnSurface = 'scripture' | 'altar' | 'reflections' | 'threads'

/** Internal navigation state for the Threads & Ropes surface. */
export type ThreadsNav =
  | { level: 'field' }
  | { level: 'rope';   ropeId: string; ropeName: string }
  | { level: 'thread'; threadId: string; threadName: string; ropeId: string | null; ropeName: string | null }
  | { level: 'entry';  entryId: string; threadId: string; threadName: string; ropeId: string | null; ropeName: string | null }

/** Drill-in overlay on the Ascent canvas (week scripture, theme quotes, etc.). */
export type AscentDrill =
  | { kind: 'scripture'; osisRef: string }
  | { kind: 'prayer' }
  | { kind: 'learning' }
  | { kind: 'theme'; themeId: string }

export interface EntryReturnContext {
  surface: EntryReturnSurface
  scriptureBook: string | null
  scriptureVerse: string | null
  /** Ascent altitude (0 = Valley/week … 3 = Summit) when returning from an entry preview. */
  ascentAltitude: number
  ascentDrill: AscentDrill | null
}

export const ENTRY_RETURN_LABEL: Record<EntryReturnSurface, string> = {
  scripture: 'Lamp',
  altar: 'Altar',
  reflections: 'Ascent',
  threads: 'Threads',
}

export interface AppHistoryState {
  tag: typeof APP_HISTORY_TAG
  surface: 'journal' | 'reflections' | 'altar' | 'scripture' | 'threads'
  entryId: string | null
  /** Open settings modal; `importSource` set on a pushed frame when viewing a source. */
  settings: { tab: SettingsTab; importSource: string | null } | null
  help: boolean
  sidebar: boolean
  restrictIds: string[] | null
  /** OSIS of the open Scripture book panel (null = canon map). Its own history
   *  frame so Back / Esc / the rail all close the panel predictably. */
  scriptureBook: string | null
  /** Verse osis_ref the book panel opens focused on (a returning-strip jump). */
  scriptureVerse: string | null
  /** Set when previewing an entry from Lamp/Altar/Ascent — Back returns here. */
  entryReturn: EntryReturnContext | null
  /** Ascent altitude index (0 = Valley/week … 3 = Summit). */
  ascentAltitude: number
  /** Open Ascent drill-in; its own history frame for mouse / browser Back. */
  ascentDrill: AscentDrill | null
  /** Threads & Ropes internal nav; its own history frame so Back works per level. */
  threadsNav: ThreadsNav | null
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
  entryReturn: null,
  ascentAltitude: 0,
  ascentDrill: null,
  threadsNav: null,
}

export function isAppHistoryState(value: unknown): value is AppHistoryState {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as AppHistoryState).tag === APP_HISTORY_TAG
  )
}

const ASCENT_ALTITUDE_MAX = 3

function normalizeAscentAltitude(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(ASCENT_ALTITUDE_MAX, Math.max(0, Math.round(value)))
}

function normalizeAscentDrill(value: unknown): AscentDrill | null {
  if (typeof value !== 'object' || value === null) return null
  const d = value as AscentDrill
  if (d.kind === 'scripture' && typeof d.osisRef === 'string') return d
  if (d.kind === 'prayer' || d.kind === 'learning') return { kind: d.kind }
  if (d.kind === 'theme' && typeof d.themeId === 'string') return d
  return null
}

function normalizeEntryReturn(value: unknown): EntryReturnContext | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as EntryReturnContext
  const validSurface: EntryReturnSurface[] = ['scripture', 'altar', 'reflections', 'threads']
  if (!validSurface.includes(r.surface)) return null
  return {
    surface: r.surface,
    scriptureBook: typeof r.scriptureBook === 'string' ? r.scriptureBook : null,
    scriptureVerse: typeof r.scriptureVerse === 'string' ? r.scriptureVerse : null,
    ascentAltitude: normalizeAscentAltitude(r.ascentAltitude),
    ascentDrill: normalizeAscentDrill(r.ascentDrill),
  }
}

/** Fill defaults for frames saved before ascent navigation fields existed. */
export function normalizeAppHistory(state: AppHistoryState): AppHistoryState {
  return {
    ...DEFAULT_APP_HISTORY,
    ...state,
    tag: APP_HISTORY_TAG,
    entryReturn: normalizeEntryReturn(state.entryReturn),
    ascentAltitude: normalizeAscentAltitude(state.ascentAltitude),
    ascentDrill: normalizeAscentDrill(state.ascentDrill),
  }
}

export function readAppHistoryState(): AppHistoryState | null {
  return isAppHistoryState(history.state) ? normalizeAppHistory(history.state) : null
}

/** Merge a partial patch; nested `settings` replaces the whole settings slot when provided. */
export function mergeAppHistory(
  prev: AppHistoryState,
  patch: Partial<AppHistoryState>,
): AppHistoryState {
  const next: AppHistoryState = { ...prev, ...patch, tag: APP_HISTORY_TAG }
  if ('settings' in patch) next.settings = patch.settings ?? null
  return normalizeAppHistory(next)
}

export function appHistoryEqual(a: AppHistoryState, b: AppHistoryState): boolean {
  return (
    a.surface === b.surface &&
    a.entryId === b.entryId &&
    a.help === b.help &&
    a.sidebar === b.sidebar &&
    a.scriptureBook === b.scriptureBook &&
    a.scriptureVerse === b.scriptureVerse &&
    JSON.stringify(a.entryReturn) === JSON.stringify(b.entryReturn) &&
    a.ascentAltitude === b.ascentAltitude &&
    JSON.stringify(a.ascentDrill) === JSON.stringify(b.ascentDrill) &&
    JSON.stringify(a.threadsNav) === JSON.stringify(b.threadsNav) &&
    JSON.stringify(a.settings) === JSON.stringify(b.settings) &&
    JSON.stringify(a.restrictIds) === JSON.stringify(b.restrictIds)
  )
}

export const LAMP_PATH = '/lamp' as const
export const THREADS_PATH = '/threads' as const
export const LEGACY_SCRIPTURE_PATH = '/scripture' as const

export function normalizePathname(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/** User-facing path for a main canvas surface. */
export function pathForSurface(surface: AppHistoryState['surface']): string {
  if (surface === 'scripture') return LAMP_PATH
  if (surface === 'threads') return THREADS_PATH
  return '/'
}

/** Map a bookmarked path to a canvas surface, when history.state is missing. */
export function surfaceFromPath(pathname: string): AppHistoryState['surface'] | null {
  const p = normalizePathname(pathname)
  if (p === LAMP_PATH || p === LEGACY_SCRIPTURE_PATH) return 'scripture'
  if (p === THREADS_PATH) return 'threads'
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
/** Snapshot return context when leaving an alt canvas to read an entry. */
export function entryReturnFromState(state: AppHistoryState): EntryReturnContext | null {
  if (state.surface === 'scripture') {
    return {
      surface: 'scripture',
      scriptureBook: state.scriptureBook,
      scriptureVerse: state.scriptureVerse,
      ascentAltitude: 0,
      ascentDrill: null,
    }
  }
  if (state.surface === 'altar') {
    return {
      surface: 'altar',
      scriptureBook: null,
      scriptureVerse: null,
      ascentAltitude: 0,
      ascentDrill: null,
    }
  }
  if (state.surface === 'reflections') {
    return {
      surface: 'reflections',
      scriptureBook: null,
      scriptureVerse: null,
      ascentAltitude: state.ascentAltitude,
      ascentDrill: state.ascentDrill,
    }
  }
  if (state.surface === 'threads') {
    return {
      surface: 'threads',
      scriptureBook: null,
      scriptureVerse: null,
      ascentAltitude: 0,
      ascentDrill: null,
    }
  }
  return null
}

export function stripAuthUrlNoise(): void {
  if (!window.location.hash && !window.location.search) return
  const current = readAppHistoryState() ?? DEFAULT_APP_HISTORY
  history.replaceState(history.state, '', appHistoryUrl(current))
}
