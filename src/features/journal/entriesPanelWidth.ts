const STORAGE_KEY = 'dayspring.entriesPanelWidth'

/** Default matches the original fixed sidebar width. */
export const ENTRIES_PANEL_WIDTH_DEFAULT = 272 // 17rem @ 16px

export const ENTRIES_PANEL_WIDTH_MIN = 200
export const ENTRIES_PANEL_WIDTH_MAX = 420

export function clampEntriesPanelWidth(px: number): number {
  return Math.round(Math.min(ENTRIES_PANEL_WIDTH_MAX, Math.max(ENTRIES_PANEL_WIDTH_MIN, px)))
}

export function loadEntriesPanelWidth(): number {
  if (typeof window === 'undefined') return ENTRIES_PANEL_WIDTH_DEFAULT
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return ENTRIES_PANEL_WIDTH_DEFAULT
    const n = Number.parseInt(raw, 10)
    return Number.isFinite(n) ? clampEntriesPanelWidth(n) : ENTRIES_PANEL_WIDTH_DEFAULT
  } catch {
    return ENTRIES_PANEL_WIDTH_DEFAULT
  }
}

export function saveEntriesPanelWidth(px: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(clampEntriesPanelWidth(px)))
  } catch {
    /* private mode / quota */
  }
}
