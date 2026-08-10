// Settings are localStorage-backed for instant reads, and synced to the cloud
// via profiles.settings so they follow the user across desktop and web.

import type { ThemeId } from './resolveTheme'

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

export const FONT_SIZE_MIN = 18
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

  /** Share anonymous feature-usage counts — never entry content. See lib/analytics.ts. */
  shareUsage: boolean
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
  pagesZoom: 0.45,
  railLabels: false,
  firstLineTitle: true,
  showMarkdownSyntax: false,
  devMode: false,
  skipRitualPreview: false,
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
  merged.pagesZoom = Math.max(0, Math.min(1, merged.pagesZoom ?? DEFAULTS.pagesZoom))
  merged.fontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, merged.fontSize))
  return merged
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
    state = { ...state, ...patch }
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
    state = { ...state, ...remote }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, v: SETTINGS_FORMAT_VERSION }))
    } catch {
      // ignore quota / private-mode failures
    }
    emit()
  },
}
