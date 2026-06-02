// Per-device settings (§4: "Settings persist per device"). localStorage-backed,
// exposed via a tiny external store so any component can read/update reactively.

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
export const FONT_SIZE_MAX = 36

const SETTINGS_FORMAT_VERSION = 3

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
  editorFont: EditorFont // the writing/reading face

  /** Entries sidebar: flat list vs month/year section headers. */
  entriesGroupBy: EntriesGroupBy

  /** Desktop rail: show text labels beside icons. */
  railLabels: boolean
}

const DEFAULTS: Settings = {
  typewriter: true,
  dimming: true,
  fontSize: 24,
  lineHeight: 1.7,
  maxWidth: 42,
  appearance: 'auto',
  editorFont: 'serif',
  entriesGroupBy: 'month',
  railLabels: false,
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
}
