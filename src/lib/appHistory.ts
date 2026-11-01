import { periodName, writersDay, type Grain } from './period'

/** Snapshot stored on each `history.pushState` / `replaceState` for in-app back/forward. */
export const APP_HISTORY_TAG = 'dayspring' as const

export type SettingsTab = 'appearance' | 'writing' | 'import' | 'shortcuts' | 'billing' | 'about'

/** Where the user was before opening an entry from Lamp, Altar, Ascent, or Pages. */
export type EntryReturnSurface = 'scripture' | 'altar' | 'reflections' | 'pages'

/** Drill-in overlay on the Ascent canvas (a verse's rise, or a rope's tended life). */
export type AscentDrill =
  | { kind: 'scripture'; osisRef: string }
  | { kind: 'band'; bandId: string; bandKind: 'rope' | 'thread'; label: string }

/**
 * Where the reader stood on the Ascent when they left it for an entry — kept on
 * the Ascent's own frame, so the way back lands on the same spot instead of the
 * top of the same page, and the thing they opened can be found and marked.
 */
export interface AscentSeat {
  /** The scroller's `scrollTop`. */
  top: number
  /** The entry they opened from here. */
  entryId: string | null
  /** Which of the controls that open it they pressed — a page can offer the
   *  same entry twice (a month's highlights, then its list), and the one to find
   *  again is the one under their hand, not the first in the document. */
  nth: number
}

export interface EntryReturnContext {
  surface: EntryReturnSurface
  scriptureBook: string | null
  scriptureVerse: string | null
  /** Ascent altitude (0 = Valley/week … 3 = Summit) when returning from an entry preview. */
  ascentAltitude: number
  /** Periods back from now at that altitude (0 = this month, 1 = last month …).
   *  Absent on a ticket from another surface, and on one saved before it existed. */
  ascentOffset?: number
  ascentDrill: AscentDrill | null
  /** Pages lighting and open reader — so Back lands on the page you left, not the wall. */
  pagesSubject: string | null
  pagesSpreadId: string | null
  /** The shelf or volume open in Pages (see AppHistoryState.pagesVolume). */
  pagesVolume?: number | null
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
export type Surface = 'journal' | 'reflections' | 'altar' | 'scripture' | 'pages' | 'lifemap'

export interface AppHistoryState {
  tag: typeof APP_HISTORY_TAG
  surface: Surface
  entryId: string | null
  /** Open settings modal; `importSource` set on a pushed frame when viewing a source. */
  settings: { tab: SettingsTab; importSource: string | null } | null
  help: boolean
  /** Mobile entries drawer. Its own history frame so Back closes it. */
  sidebar: boolean
  /** OSIS of the open Scripture book panel (null = canon map). Its own history
   *  frame so Back / Esc / the rail all close the panel predictably. */
  scriptureBook: string | null
  /** Verse osis_ref the book panel opens focused on (a returning-strip jump). */
  scriptureVerse: string | null
  /** Set when previewing an entry from Lamp/Altar/Ascent — Back returns here. */
  entryReturn: EntryReturnContext | null
  /** Ascent altitude index (0 = Valley/week … 3 = Summit). */
  ascentAltitude: number
  /**
   * How far back through that altitude's periods the reader has stepped (the
   * When's ‹ ›): 0 = this week / month / season / year, 1 = the one before.
   *
   * On the frame, not in the component, because it is part of WHERE the reader
   * is. As component state it died with the Ascent when an entry took the
   * canvas, so every way back — Esc, ⌘[, the mouse, a swipe — landed on
   * "now" instead of on the October they had stepped to. Stepping REPLACES the
   * frame rather than pushing one: Back leaves a place, it does not retrace
   * how you moved around inside it.
   */
  ascentOffset: number
  /** Where the reader stood when they left the Ascent for an entry. */
  ascentSeat: AscentSeat | null
  /** Open Ascent drill-in; its own history frame for mouse / browser Back. */
  ascentDrill: AscentDrill | null
  /** Subject lighting the Pages wall (`word:<text>` or `c:<concordance id>`). */
  pagesSubject: string | null
  /** The Pages weather panel, on its own frame so Back closes it. */
  /** Entry open in the Pages Spread. Its own frame, so Esc/Back close the reader
   *  and leave you on the wall rather than the editor. */
  pagesSpreadId: string | null
  /** Volumes in Pages: null = the wall, 0 = the shelf, n = volume n read back.
   *  Its own frame, like the reader, so Back steps volume → shelf → wall and a
   *  page opened from a volume comes back to the volume. */
  pagesVolume: number | null
  /** Where the shelf / volume was stepped into from ('wall' or 'shelf'), so
   *  its way up is Back to that frame and can say where it goes. null = not
   *  stepped into (reached sideways), so the way up replaces instead. */
  pagesVolumeFrom: 'wall' | 'shelf' | null
}

export const DEFAULT_APP_HISTORY: AppHistoryState = {
  tag: APP_HISTORY_TAG,
  surface: 'journal',
  entryId: null,
  settings: null,
  help: false,
  sidebar: false,
  scriptureBook: null,
  scriptureVerse: null,
  entryReturn: null,
  ascentAltitude: 0,
  ascentOffset: 0,
  ascentSeat: null,
  ascentDrill: null,
  pagesSubject: null,
  pagesSpreadId: null,
  pagesVolume: null,
  pagesVolumeFrom: null,
}

export function isAppHistoryState(value: unknown): value is AppHistoryState {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as AppHistoryState).tag === APP_HISTORY_TAG
  )
}

const ASCENT_ALTITUDE_MAX = 3

/** Altitude index → the grain it stands for, in the shared vocabulary. The tier
 *  is still called 'quarter' in the rollup schema; out loud it is the season. */
export const ASCENT_GRAIN: Grain[] = ['week', 'month', 'season', 'year']

/** Further back than any archive goes; a corrupt frame cannot ask for more. */
const ASCENT_OFFSET_MAX = 1000

function normalizeAscentAltitude(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(ASCENT_ALTITUDE_MAX, Math.max(0, Math.round(value)))
}

export function normalizeAscentOffset(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.min(ASCENT_OFFSET_MAX, Math.max(0, Math.floor(value)))
}

function normalizeAscentSeat(value: unknown): AscentSeat | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as AscentSeat
  if (typeof v.top !== 'number' || !Number.isFinite(v.top) || v.top < 0) return null
  return {
    top: Math.round(v.top),
    entryId: typeof v.entryId === 'string' ? v.entryId : null,
    nth: Number.isInteger(v.nth) && v.nth >= 0 ? v.nth : 0,
  }
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
    value === 'pages' ||
    value === 'lifemap'
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
    ...(typeof r.ascentOffset === 'number' ? { ascentOffset: normalizeAscentOffset(r.ascentOffset) } : {}),
    ascentDrill: normalizeAscentDrill(r.ascentDrill),
    pagesSubject: typeof r.pagesSubject === 'string' ? r.pagesSubject : null,
    pagesSpreadId: typeof r.pagesSpreadId === 'string' ? r.pagesSpreadId : null,
    ...(normalizePagesVolume(r.pagesVolume) !== null ? { pagesVolume: normalizePagesVolume(r.pagesVolume) } : {}),
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
    ascentOffset: normalizeAscentOffset(state.ascentOffset),
    ascentSeat: normalizeAscentSeat(state.ascentSeat),
    ascentDrill: normalizeAscentDrill(state.ascentDrill),
    pagesSubject: typeof state.pagesSubject === 'string' ? state.pagesSubject : null,
    pagesSpreadId: typeof state.pagesSpreadId === 'string' ? state.pagesSpreadId : null,
    pagesVolume: normalizePagesVolume(state.pagesVolume),
    pagesVolumeFrom: state.pagesVolumeFrom === 'wall' || state.pagesVolumeFrom === 'shelf' ? state.pagesVolumeFrom : null,
  }
}

function normalizePagesVolume(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null
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
    a.ascentOffset === b.ascentOffset &&
    JSON.stringify(a.ascentSeat) === JSON.stringify(b.ascentSeat) &&
    a.pagesSubject === b.pagesSubject &&
    a.pagesSpreadId === b.pagesSpreadId &&
    a.pagesVolume === b.pagesVolume &&
    a.pagesVolumeFrom === b.pagesVolumeFrom &&
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

/** Mouse X1 / X2 — "Browser Back" and "Browser Forward" in the UI Events spec. */
export function mouseHistoryAction(button: number): 'back' | 'forward' | null {
  if (button === 3) return 'back'
  if (button === 4) return 'forward'
  return null
}

/**
 * Chrome / Safari / WebView2 already turn those buttons into a history pop.
 * WKWebView in the Mac app does not — the click arrives, nothing moves.
 *
 * Same object identity means the host did not pop; we should. A new
 * `history.state` means it already did, and calling `history.back()` again
 * would skip a frame.
 */
export function mouseHistoryNeedsFallback(
  stateBefore: unknown,
  stateAfter: unknown,
): boolean {
  return stateBefore === stateAfter
}

/** Remove Supabase OAuth tokens from the address bar after sign-in. */
/** The Pages wall — where a new entry goes when nothing else claimed it. */
export function pagesHomeReturn(): EntryReturnContext {
  return {
    surface: 'pages',
    scriptureBook: null,
    scriptureVerse: null,
    ascentAltitude: 0,
    ascentDrill: null,
    pagesSubject: null,
    pagesSpreadId: null,
  }
}

/**
 * Return ticket for a new entry.
 *
 * Snapshot the surface they are on, or keep a ticket they already hold.
 * Do not invent a Pages ticket — a synthetic one would make Escape call
 * `back()` with no Pages frame underneath and leave the app.
 */
export function newEntryReturn(state: AppHistoryState): EntryReturnContext | null {
  return entryReturnFromState(state) ?? state.entryReturn
}

/** Snapshot return context when leaving an alt canvas to read an entry. */
export function entryReturnFromState(state: AppHistoryState): EntryReturnContext | null {
  if (state.surface === 'scripture') {
    return {
      surface: 'scripture',
      scriptureBook: state.scriptureBook,
      scriptureVerse: state.scriptureVerse,
      ascentAltitude: 0,
      ascentDrill: null,
      pagesSubject: null,
      pagesSpreadId: null,
    }
  }
  if (state.surface === 'altar') {
    return {
      surface: 'altar',
      scriptureBook: null,
      scriptureVerse: null,
      ascentAltitude: 0,
      ascentDrill: null,
      pagesSubject: null,
      pagesSpreadId: null,
    }
  }
  if (state.surface === 'reflections') {
    return {
      surface: 'reflections',
      scriptureBook: null,
      scriptureVerse: null,
      ascentAltitude: state.ascentAltitude,
      ascentOffset: state.ascentOffset,
      ascentDrill: state.ascentDrill,
      pagesSubject: null,
      pagesSpreadId: null,
    }
  }
  if (state.surface === 'pages') {
    return {
      surface: 'pages',
      scriptureBook: null,
      scriptureVerse: null,
      ascentAltitude: 0,
      ascentDrill: null,
      pagesSubject: state.pagesSubject,
      pagesSpreadId: state.pagesSpreadId,
      ...(state.pagesVolume !== null ? { pagesVolume: state.pagesVolume } : {}),
    }
  }
  return null
}

/**
 * Where Back goes, said as the place you will land: "Ascent", and when the
 * reader had stepped back through time, "Ascent · October 2026".
 *
 * The bare surface name was all the entry's Back control ever said, so someone
 * who had walked back to October and opened a photo had no way to know that
 * Back meant October. The period is left off when it is now — a label that
 * always carried one would stop saying anything.
 */
export function entryReturnLabel(ret: EntryReturnContext, now: Date = writersDay()): string {
  const base = ENTRY_RETURN_LABEL[ret.surface]
  const offset = ret.ascentOffset ?? 0
  if (ret.surface !== 'reflections' || offset <= 0) return base
  const grain = ASCENT_GRAIN[normalizeAscentAltitude(ret.ascentAltitude)]!
  return `${base} · ${periodName(grain, offset, now)}`
}

/**
 * ⌘[ and ⌘] — Back and Forward, the way Safari and Finder say them and the way
 * most Mac mouse drivers send a side button (as the keystroke, not as button 3
 * and 4). Dayspring has no browser chrome to catch them, so without this the
 * mouse's Back was a dead button.
 *
 * Only the bare chord: ⇧⌘[ is "previous tab" in every host that has tabs, and
 * ⌥ is how some layouts reach the bracket at all. Whether the key may be taken
 * where someone is typing is the caller's to say — in the editor ⌘[ is
 * "outdent".
 */
export function keyboardHistoryAction(e: {
  key: string
  code?: string
  metaKey: boolean
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
}): 'back' | 'forward' | null {
  if (!e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return null
  if (e.key === '[' || e.code === 'BracketLeft') return 'back'
  if (e.key === ']' || e.code === 'BracketRight') return 'forward'
  return null
}

export function stripAuthUrlNoise(): void {
  if (!window.location.hash && !window.location.search) return
  const current = readAppHistoryState() ?? DEFAULT_APP_HISTORY
  history.replaceState(history.state, '', appHistoryUrl(current))
}
