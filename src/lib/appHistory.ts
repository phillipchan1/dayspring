/** Snapshot stored on each `history.pushState` / `replaceState` for in-app back/forward. */
export const APP_HISTORY_TAG = 'dayspring' as const

export type SettingsTab = 'appearance' | 'writing' | 'import' | 'shortcuts' | 'billing' | 'about'

/** Where the user was before opening an entry from Lamp, Altar, Ascent, or Pages. */
export type EntryReturnSurface = 'scripture' | 'altar' | 'reflections' | 'pages'

/** Drill-in overlay on the Ascent canvas (a verse's rise, or a rope's tended life). */
export type AscentDrill =
  | { kind: 'scripture'; osisRef: string }
  | { kind: 'band'; bandId: string; bandKind: 'rope' | 'thread'; label: string }

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
  pages: 'Pages',
}

/**
 * A canvas surface.
 *
 * `pages` is a surface but NOT a rail destination — it's reached from the Entries
 * panel's view switcher. Architecturally it takes the canvas like the Return
 * surfaces do; in the product it belongs to Entries, which is why the rail still
 * shows four ways to return.
 */
export type Surface = 'journal' | 'reflections' | 'altar' | 'scripture' | 'pages'

export interface AppHistoryState {
  tag: typeof APP_HISTORY_TAG
  surface: Surface
  entryId: string | null
  /** Open settings modal; `importSource` set on a pushed frame when viewing a source. */
  settings: { tab: SettingsTab; importSource: string | null } | null
  help: boolean
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
  /** Subject lighting the Pages wall (`word:<text>` or `c:<concordance id>`). */
  pagesSubject: string | null
  /** The Pages weather panel, on its own frame so Back closes it. */
  pagesPanel: 'weather' | null
  /** Entry open in the Pages Spread. Its own frame, so Esc/Back close the reader
   *  and leave you on the wall rather than the editor. */
  pagesSpreadId: string | null
}

export const DEFAULT_APP_HISTORY: AppHistoryState = {
  tag: APP_HISTORY_TAG,
  surface: 'journal',
  entryId: null,
  settings: null,
  help: false,
  scriptureBook: null,
  scriptureVerse: null,
  entryReturn: null,
  ascentAltitude: 0,
  ascentDrill: null,
  pagesSubject: null,
  pagesPanel: null,
  pagesSpreadId: null,
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
  if (d.kind === 'band' && typeof d.bandId === 'string' && (d.bandKind === 'rope' || d.bandKind === 'thread') && typeof d.label === 'string') return d
  return null
}

/** Coerce a surface to a live one — folds the retired 'threads' surface (and any
 *  unknown value from a stale history frame) into Ascent, so Back never strands. */
function normalizeSurface(value: unknown): Surface {
  if (
    value === 'reflections' ||
    value === 'altar' ||
    value === 'scripture' ||
    value === 'journal' ||
    value === 'pages'
  )
    return value
  // Retired surfaces fold home rather than stranding a saved frame:
  // 'threads' became Ascent, and 'well' was deleted outright (D-020).
  if (value === 'threads') return 'reflections'
  if (value === 'well') return 'pages'
  return 'journal'
}

function normalizeEntryReturn(value: unknown): EntryReturnContext | null {
  if (typeof value !== 'object' || value === null) return null
  const r = value as EntryReturnContext
  // A stale entryReturn pointing at the retired 'threads' surface → reflections.
  if ((r.surface as string) === 'threads') r.surface = 'reflections'
  const validSurface: EntryReturnSurface[] = ['scripture', 'altar', 'reflections', 'pages']
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
/**
 * A stale frame keeps whatever extra keys it was saved with — `sidebar` and
 * `restrictIds` were removed with the entries panel, and the spread below leaves
 * them sitting inert on old frames rather than throwing. Nothing reads them.
 */
export function normalizeAppHistory(state: AppHistoryState): AppHistoryState {
  return {
    ...DEFAULT_APP_HISTORY,
    ...state,
    tag: APP_HISTORY_TAG,
    surface: normalizeSurface(state.surface),
    entryReturn: normalizeEntryReturn(state.entryReturn),
    ascentAltitude: normalizeAscentAltitude(state.ascentAltitude),
    ascentDrill: normalizeAscentDrill(state.ascentDrill),
    pagesSubject: typeof state.pagesSubject === 'string' ? state.pagesSubject : null,
    pagesPanel: state.pagesPanel === 'weather' ? 'weather' : null,
    pagesSpreadId: typeof state.pagesSpreadId === 'string' ? state.pagesSpreadId : null,
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
    a.scriptureBook === b.scriptureBook &&
    a.scriptureVerse === b.scriptureVerse &&
    JSON.stringify(a.entryReturn) === JSON.stringify(b.entryReturn) &&
    a.ascentAltitude === b.ascentAltitude &&
    a.pagesSubject === b.pagesSubject &&
    a.pagesPanel === b.pagesPanel &&
    a.pagesSpreadId === b.pagesSpreadId &&
    JSON.stringify(a.ascentDrill) === JSON.stringify(b.ascentDrill) &&
    JSON.stringify(a.settings) === JSON.stringify(b.settings)
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
  return '/'
}

/** Map a bookmarked path to a canvas surface, when history.state is missing.
 *  The retired /threads path redirects to Ascent (Threads folded in). */
export function surfaceFromPath(pathname: string): AppHistoryState['surface'] | null {
  const p = normalizePathname(pathname)
  if (p === LAMP_PATH || p === LEGACY_SCRIPTURE_PATH) return 'scripture'
  if (p === THREADS_PATH) return 'reflections'
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
  if (state.surface === 'pages') {
    return {
      surface: 'pages',
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
