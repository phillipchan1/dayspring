import type { Settings } from './settings'

export type ThemeId = 'dawn' | 'ink'

/** Palette applied to `data-theme` from appearance + OS preference. */
export function resolveTheme(settings: Settings, prefersDark: boolean): ThemeId {
  const mode = settings.appearance
  if (mode === 'light') return 'dawn'
  if (mode === 'dark') return 'ink'
  return prefersDark ? 'ink' : 'dawn'
}
