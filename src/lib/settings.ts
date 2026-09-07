// Settings are localStorage-backed for instant reads, and synced to the cloud
// via profiles.settings so they follow the user across desktop and web.

import type { ThemeId } from './resolveTheme'
import { getVoice, voiceForPalettes, type VoiceId } from './voices'

export type Appearance = 'light' | 'dark' | 'auto'

/** The writing/reading surface face. The picker maps each to a CSS var. */
export type EditorFont = 'serif' | 'literary' | 'typewriter' | 'mono' | 'sans' | 'readable'

/**
 * EditorFont → the CSS custom property fed into `--font-editor`. Points at the
 * family tokens declared in themes.css (`:root`) rather than raw stacks, so the
 * font definitions live in one place.
 */
export const EDITOR_FONT_VARS: Record<EditorFont, string> = {
  serif: 'var(--font-serif)', // Newsreader (default)
  literary: 'var(--font-display)', // Fraunces
  typewriter: 'var(--font-iawriter)', // iA Writer Duo
  mono: 'var(--font-mono)', // JetBrains Mono
  sans: 'var(--font-sans)', // system sans
  readable: 'var(--font-atkinson)', // Atkinson Hyperlegible
}

export const FONT_SIZE_MIN = 14
export const FONT_SIZE_DEFAULT = 24
export const FONT_SIZE_MAX = 36

const SETTINGS_FORMAT_VERSION = 4

/**
 * The three density steps Pages shipped with. Kept only so a saved value can be
 * migrated to `pagesZoom`; nothing reads it any more.
 */
type LegacyPagesDensity = 'wall' | 'shelf' | 'open'

/** Where the legacy steps land on the continuous scale. */
const LEGACY_DENSITY_ZOOM: Record<LegacyPagesDensity, number> = {
  wall: 0.1,
  shelf: 0.45,
  open: 0.85,
}

export type EntriesGroupBy = 'flat' | 'month' | 'year'

export interface Settings {
  // Focus-mode behaviour
  typewriter: boolean // keep the active line vertically centered
  dimming: boolean // fade non-active paragraphs

  // Editor typography (drive CSS custom props; sliders land in a later checkpoint)
  fontSize: number // px
  lineHeight: number
  maxWidth: number // rem — width of the writing column

  appearance: Appearance
  /** Palette used in light mode (and in auto when the system is light). */
  lightTheme: ThemeId
  /** Palette used in dark mode (and in auto when the system is dark). */
  darkTheme: ThemeId
  editorFont: EditorFont // the writing/reading face

  /**
   * The voice: a palette pair, a type pairing, a scale and an ornament under one
   * name. See lib/voices.ts and D-028.
   *
   * `lightTheme` / `darkTheme` / `editorFont` are NOT replaced by this and are
   * still written on every save, kept in step with the voice. Settings sync is a
   * whole-object last-writer-wins push to one `profiles.settings` row that alpha
   * and stable both use, so a client that has never heard of `voice` still has
   * to find a real palette and a real font id in the blob. Removing them would
   * mean a beta user's theme resets because a voice was picked on another
   * machine — the same shape as the late-Stripe-webhook clobber.
   */
  voice: VoiceId

  /**
   * Whether `editorFont` follows the voice (true) or was deliberately chosen
   * (false).
   *
   * This is a separate flag rather than an `'auto'` member of EditorFont for the
   * same cross-channel reason: `EDITOR_FONT_VARS['auto']` would be `undefined`
   * on a client that predates it, and `--font-editor` would resolve to nothing.
   * An older client ignores this key and reads the resolved face instead.
   */
  editorFontAuto: boolean

  /** Entries sidebar: flat list vs month/year section headers. */
  entriesGroupBy: EntriesGroupBy

  /** Sidebar: show a one-line body excerpt below each entry title. */
  showEntryPreview: boolean

  /**
   * Pages: how close you're standing to the wall, 0 (far) → 1 (near).
   *
   * Continuous, not three steps. See features/pages/zoom.ts — the interpolator
   * there is the only thing that turns this into geometry.
   */
  pagesZoom: number

  /** Desktop rail: show text labels beside icons. */
  railLabels: boolean

  /** Style the first line as the entry title (editor + rendered/exported markdown). */
  firstLineTitle: boolean

  /**
   * Show markdown's raw syntax characters (`*`, `**`, `#`, `==`) in the editor.
   * Off — the default — hides them until the cursor is inside the span, so the
   * page reads as formatted prose. The characters are always in the document
   * either way; this only changes what's painted.
   */
  showMarkdownSyntax: boolean

  /** Desktop only: enable developer tools shortcut (⌘⌥I). */
  devMode: boolean

  /** Skip a ritual's preview/threshold and begin writing on selection. */
  skipRitualPreview: boolean

  /**
   * Reading a page: show a sliver of the pages either side of it.
   *
   * On, they slide in beside the page and say "there is more this way" without
   * being readable. Off is a single page on a bare ground — which is the point
   * of opening one. The chevrons, ← / →, and the swipe all work either way, so
   * turning this off costs no navigation, only the preview.
   */
  readerLeaves: boolean

  /**
   * Whether the journal may propose markings — shown as **heartIQ**. Display
   * name only; this field, the API route, and every call site keep `noticing`.
   *
   * **Nothing reads this today, and that is deliberate.** heartIQ used to run
   * while you wrote, proposing lines into a margin down the right of the page.
   * That margin is gone and so is the proposing: being shown what a machine
   * made of your half-finished sentence is an interruption whether or not it
   * costs a millisecond. The engine is intact and waiting on a reading surface
   * to live in — this switch comes back to Settings when there is something for
   * it to switch. See D-026.
   */
  noticing: boolean

  /** Share anonymous feature-usage counts — never entry content. See lib/analytics.ts. */
  shareUsage: boolean

  /**
   * The newest release whose First Light deck this account has seen.
   *
   * Optional on purpose: `undefined` means "never seen one", which is every
   * existing user on the day First Light ships — exactly the people who need to
   * be told the entries list moved. Onboarding stamps CURRENT_RELEASE_ID so a
   * brand-new account is never told what changed about an app it has not used.
   *
   * Safe to live in `settings` even though sync is last-writer-wins: the worst
   * a stale blob can do is show one deck a second time on one device, and
   * FirstLight keeps a localStorage guard against even that. Contrast the app
   * lock verifier, which needed its own column because losing a write there
   * switches the lock off.
   */
  lastSeenRelease?: string
}

const DEFAULTS: Settings = {
  typewriter: true,
  dimming: true,
  fontSize: 24,
  lineHeight: 1.7,
  maxWidth: 42,
  appearance: 'auto',
  lightTheme: 'dawn',
  darkTheme: 'ink',
  editorFont: 'serif',
  voice: 'dawn',
  editorFontAuto: true,
  entriesGroupBy: 'flat',
  showEntryPreview: false,
  pagesZoom: 0.6,
  railLabels: false,
  firstLineTitle: true,
  showMarkdownSyntax: false,
  devMode: false,
  skipRitualPreview: false,
  readerLeaves: true,
  noticing: false,
  shareUsage: true,
}

/**
 * The defaults a fresh install gets, exported under a name that reads clearly
 * at a call site.
 *
 * Note this is NOT the same as `migrateSettings({})` — a blob with no `v` is
 * treated as version 1, so the v3 font bump applies and fontSize comes back
 * 28 rather than 24. Anything that wants "what a new user sees" wants this.
 */
export const DEFAULT_SETTINGS: Settings = DEFAULTS

const STORAGE_KEY = 'dayspring.settings.v1'

type StoredSettings = Partial<Settings> & {
  theme?: string
  followSystem?: boolean
  pagesDensity?: LegacyPagesDensity
  v?: number
}

/**
 * Bring a stored blob up to the current format.
 *
 * Pure and exported so the migrations can be tested without a DOM — each one is
 * a one-way door that runs against real users' saved preferences, and getting
 * one wrong silently changes something they chose deliberately.
 */
export function migrateSettings(parsed: StoredSettings): Settings {
  const merged = { ...DEFAULTS, ...parsed }
  const legacyAppearance = parsed.appearance === undefined
  // Legacy theme + followSystem → appearance.
  if (legacyAppearance) {
    if (parsed.followSystem) merged.appearance = 'auto'
    else if (parsed.theme === 'dawn') merged.appearance = 'light'
    else merged.appearance = 'dark'
    // Font slider was 13–22; nudge saved sizes once when upgrading.
    if (typeof parsed.fontSize === 'number') {
      merged.fontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, parsed.fontSize + 3))
    }
  }
  // Each migration is gated on the version that introduced it, NOT on
  // "older than current" — a v3 reader re-running the v3 font bump would add
  // another 4px to a size the user had already been given once.
  const version = parsed.v ?? 1
  if (version < 3) {
    merged.fontSize = Math.max(
      FONT_SIZE_MIN,
      Math.min(FONT_SIZE_MAX, (merged.fontSize ?? DEFAULTS.fontSize) + 4),
    )
  }
  if (version < 4) {
    // Three density steps became one continuous zoom.
    const legacy = (parsed as { pagesDensity?: LegacyPagesDensity }).pagesDensity
    if (legacy && legacy in LEGACY_DENSITY_ZOOM) {
      merged.pagesZoom = LEGACY_DENSITY_ZOOM[legacy]
    }
  }
  // The voice arrives WITHOUT a format bump, gated on its own absence rather
  // than on a version number. That is deliberate: stable is still reading v4,
  // a shipped client cannot be made tolerant after the fact, and bumping would
  // hand it a blob it has to guess at. Nothing here writes a value an older
  // reader cannot use — every slot still ends up holding a real ThemeId and a
  // real EditorFont id. The format bump, and the removal of these projections,
  // lands one release after stable can read the new shape.
  if (parsed.voice === undefined) {
    merged.voice = voiceForPalettes(parsed.lightTheme, parsed.darkTheme)
    // Someone who never opened the font picker follows the voice. Someone who
    // deliberately chose iA Writer chose it, and keeps it.
    merged.editorFontAuto = parsed.editorFont === undefined || parsed.editorFont === 'serif'
  }
  merged.pagesZoom = Math.max(0, Math.min(1, merged.pagesZoom ?? DEFAULTS.pagesZoom))
  merged.fontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, merged.fontSize))
  return reconcileVoice(merged)
}

/**
 * Keep the projected keys in step with the voice.
 *
 * `voice` is the source of truth. `lightTheme`, `darkTheme` and — while
 * `editorFontAuto` is on — `editorFont` are projections of it that exist purely
 * so a client on the other release channel finds something valid in the shared
 * `profiles.settings` row. Run on every read and every write, so the two can
 * never drift apart and leave an older reader holding a palette its user never
 * chose.
 *
 * A night-only voice has no light palette to project, so that slot is left
 * untouched rather than being filled with something arbitrary.
 */
export function reconcileVoice(next: Settings): Settings {
  const voice = getVoice(next.voice)
  return {
    ...next,
    lightTheme: voice.light ?? next.lightTheme,
    darkTheme: voice.dark,
    editorFont: next.editorFontAuto ? voice.face : next.editorFont,
  }
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as StoredSettings
    const migrated = migrateSettings(parsed)
    if ((parsed.v ?? 1) < SETTINGS_FORMAT_VERSION) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...migrated, v: SETTINGS_FORMAT_VERSION }))
      } catch {
        /* ignore quota / private-mode failures */
      }
    }
    return migrated
  } catch {
    return DEFAULTS
  }
}

let state: Settings = load()
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export const settingsStore = {
  get(): Settings {
    return state
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  update(patch: Partial<Settings>): void {
    state = reconcileVoice({ ...state, ...patch })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, v: SETTINGS_FORMAT_VERSION }))
    } catch {
      // ignore quota / private-mode failures
    }
    emit()
  },
  reset(): void {
    settingsStore.update(DEFAULTS)
  },
  /**
   * Apply settings fetched from the cloud. Remote wins over whatever is in
   * localStorage, so intentional choices made on another device take effect
   * immediately.
   *
   * Note this DOES notify subscribers (it has to — the UI must repaint), so it
   * is not in itself a defence against an echo write-back. useSettingsSync
   * suppresses that by remembering what it last pushed.
   */
  applyRemote(remote: Partial<Settings>): void {
    state = reconcileVoice({ ...state, ...remote })
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, v: SETTINGS_FORMAT_VERSION }))
    } catch {
      // ignore quota / private-mode failures
    }
    emit()
  },
}
