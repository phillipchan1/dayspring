import type { Settings } from './settings'

export type ThemeId =
  | 'dawn'
  | 'vellum'
  | 'cloister'
  | 'sabbath'
  | 'ink'
  | 'ember'
  | 'compline'
  | 'nocturne'

export type ThemeFamily = 'light' | 'dark'

export interface ThemeMeta {
  id: ThemeId
  label: string
  family: ThemeFamily
  /** One line for the picker. */
  blurb: string
  /** Preview chip colors — kept in sync with the [data-theme] block in themes.css. */
  swatch: { bg: string; accent: string }
}

/**
 * The theme registry — the single source of truth for which palettes exist and
 * whether each is light or dark. Add a theme here + a matching [data-theme]
 * block in themes.css and it becomes selectable everywhere.
 */
export const THEMES: ThemeMeta[] = [
  { id: 'dawn', label: 'Dawn', family: 'light', blurb: 'Sunrise on paper.', swatch: { bg: '#fbf6ee', accent: '#c2683a' } },
  { id: 'vellum', label: 'Vellum', family: 'light', blurb: 'Aged paper, ink that bites.', swatch: { bg: '#f3e9d5', accent: '#8a5324' } },
  { id: 'cloister', label: 'Cloister', family: 'light', blurb: 'Cool stone, north light.', swatch: { bg: '#f1f2f4', accent: '#3d6d8f' } },
  { id: 'sabbath', label: 'Sabbath', family: 'light', blurb: 'Sage and pine — the quiet one.', swatch: { bg: '#f1f4ee', accent: '#3f7d6a' } },
  { id: 'ink', label: 'Ink', family: 'dark', blurb: 'Moonlight, not sunrise.', swatch: { bg: '#14161d', accent: '#e0a64e' } },
  { id: 'ember', label: 'Ember', family: 'dark', blurb: 'Hearth-warm dark.', swatch: { bg: '#1a1411', accent: '#e8743c' } },
  { id: 'compline', label: 'Compline', family: 'dark', blurb: 'Indigo night prayer.', swatch: { bg: '#13121e', accent: '#9b8ce8' } },
  { id: 'nocturne', label: 'Nocturne', family: 'dark', blurb: 'True black, for OLED.', swatch: { bg: '#000000', accent: '#d9a441' } },
]

const BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t])) as Record<ThemeId, ThemeMeta>

export const DEFAULT_LIGHT_THEME: ThemeId = 'dawn'
export const DEFAULT_DARK_THEME: ThemeId = 'ink'

export const LIGHT_THEMES = THEMES.filter((t) => t.family === 'light')
export const DARK_THEMES = THEMES.filter((t) => t.family === 'dark')

export function isLightTheme(id: ThemeId): boolean {
  return BY_ID[id]?.family === 'light'
}

function validLight(id: ThemeId | undefined): ThemeId {
  return id && BY_ID[id]?.family === 'light' ? id : DEFAULT_LIGHT_THEME
}

function validDark(id: ThemeId | undefined): ThemeId {
  return id && BY_ID[id]?.family === 'dark' ? id : DEFAULT_DARK_THEME
}

/**
 * Palette applied to `data-theme` from the user's appearance mode + their chosen
 * light/dark palettes + the OS preference. Appearance stays light | dark | auto;
 * each mode maps to the palette the user picked for that side.
 */
export function resolveTheme(settings: Settings, prefersDark: boolean): ThemeId {
  const light = validLight(settings.lightTheme)
  const dark = validDark(settings.darkTheme)
  const mode = settings.appearance
  if (mode === 'light') return light
  if (mode === 'dark') return dark
  return prefersDark ? dark : light
}
