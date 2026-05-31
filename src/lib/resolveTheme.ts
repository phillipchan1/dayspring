import type { Settings } from './settings'

export type ThemeId = 'dawn' | 'ink' | 'ember'

const DARK_THEMES = new Set<ThemeId>(['ink', 'ember'])

/** Palette applied to `data-theme` from stored settings + OS preference. */
export function resolveTheme(settings: Settings, prefersDark: boolean): ThemeId {
  if (!settings.followSystem) return settings.theme as ThemeId
  if (!prefersDark) return 'dawn'
  const t = settings.theme as ThemeId
  return DARK_THEMES.has(t) ? t : 'ink'
}
