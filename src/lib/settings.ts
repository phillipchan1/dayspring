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

const SETTINGS_FORMAT_VERSION = 3

export type EntriesGroupBy = 'flat' | 'month' | 'year'

/** Mirrors features/pages/density.ts — declared here so settings owns no feature import. */
export type PagesDensity = 'wall' | 'shelf' | 'open'

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

  /** Entries sidebar: flat list vs month/year section headers. */
  entriesGroupBy: EntriesGroupBy

  /** Pages: how close you're standing to the wall. See features/pages/density.ts. */
  pagesDensity: PagesDensity

  /** Desktop rail: show text labels beside icons. */
  railLabels: boolean

  /** Style the first line as the entry title (editor + rendered/exported markdown). */
  firstLineTitle: boolean

  /** Desktop only: enable developer tools shortcut (⌘⌥I). */
  devMode: boolean

  /** Sidebar: show a one-line body excerpt below each entry title. */
  showEntryPreview: boolean

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
  entriesGroupBy: 'flat',
  pagesDensity: 'shelf',
  railLabels: false,
  firstLineTitle: true,
  devMode: false,
  showEntryPreview: false,
  skipRitualPreview: false,
  shareUsage: true,
}

const STORAGE_KEY = 'dayspring.settings.v1'

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<Settings> & {
      theme?: string
      followSystem?: boolean
      v?: number
    }
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
    const version = parsed.v ?? 1
    if (version < SETTINGS_FORMAT_VERSION) {
      merged.fontSize = Math.max(
        FONT_SIZE_MIN,
        Math.min(FONT_SIZE_MAX, (merged.fontSize ?? DEFAULTS.fontSize) + 4),
      )
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...merged, v: SETTINGS_FORMAT_VERSION }))
      } catch {
        /* ignore */
      }
    }
    merged.fontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, merged.fontSize))
    return merged
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
