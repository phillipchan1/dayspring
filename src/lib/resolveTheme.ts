import type { Settings } from './settings'
import { getVoice, isNightOnly } from './voices'

export type ThemeId =
  | 'dawn'
  | 'vellum'
  | 'cloister'
  | 'sabbath'
  | 'ink'
  | 'ember'
  | 'compline'
  | 'nocturne'
  | 'vigil'
  // Drawn for the voices (D-028): Plainsong's daylight ground, Sabbath's night.
  | 'quire'
  | 'grove'

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
  { id: 'vigil', label: 'Vigil', family: 'dark', blurb: 'Dimmed all the way down, for dark rooms.', swatch: { bg: '#080807', accent: '#8a7f6a' } },
  { id: 'quire', label: 'Quire', family: 'light', blurb: 'Paper for a plain hand.', swatch: { bg: '#f4f3f0', accent: '#a06a1e' } },
  { id: 'grove', label: 'Grove', family: 'dark', blurb: 'Pine after dark.', swatch: { bg: '#101613', accent: '#6cb79a' } },
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
 * Palette applied to `data-theme`.
 *
 * A voice owns both grounds, so it answers first. The legacy `lightTheme` /
 * `darkTheme` slots stay as the fallback and are still written on every save —
 * alpha and stable share one `profiles.settings` row, and a client that has
 * never heard of `voice` has to find a real palette in there. See settings.ts.
 *
 * A night-only voice resolves to its dark palette in every mode; there is no
 * daylight version of Vigil to fall back to.
 */
export function resolveTheme(settings: Settings, prefersDark: boolean): ThemeId {
  const voice = settings.voice ? getVoice(settings.voice) : null
  const light = voice ? validLight(voice.light ?? undefined) : validLight(settings.lightTheme)
  const dark = voice ? validDark(voice.dark) : validDark(settings.darkTheme)
  if (voice && isNightOnly(voice.id)) return dark
  const mode = settings.appearance
  if (mode === 'light') return light
  if (mode === 'dark') return dark
  return prefersDark ? dark : light
}
