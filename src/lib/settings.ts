// Per-device settings (§4: "Settings persist per device"). localStorage-backed,
// exposed via a tiny external store so any component can read/update reactively.

export interface Settings {
  // Focus-mode behaviour
  typewriter: boolean // keep the active line vertically centered
  dimming: boolean // fade non-active paragraphs

  // Editor typography (drive CSS custom props; sliders land in a later checkpoint)
  fontSize: number // px
  lineHeight: number
  maxWidth: number // rem — width of the writing column

  // Appearance (only one theme/font in Phase 1, but the field exists to grow into)
  theme: string
}

const DEFAULTS: Settings = {
  typewriter: true,
  dimming: true,
  fontSize: 17,
  lineHeight: 1.7,
  maxWidth: 42,
  theme: 'one-dark',
}

const STORAGE_KEY = 'dayspring.settings.v1'

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULTS, ...parsed }
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore quota / private-mode failures
    }
    emit()
  },
  reset(): void {
    settingsStore.update(DEFAULTS)
  },
}
