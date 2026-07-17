import { LIGHT_THEMES, DARK_THEMES, type ThemeId, type ThemeMeta } from '@/lib/resolveTheme'
import type { Settings } from '@/lib/settings'
import './ThemePicker.css'

interface Props {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  /** The palette currently on screen (resolved from appearance + the two slots). */
  active: ThemeId
}

/**
 * Light + dark palette grids. Picking one stores it in its slot AND flips
 * appearance to that side, so the choice applies on screen immediately. The
 * light/dark/auto mode lives in the AppearanceToggle above; Auto pairs the two
 * selected slots by system preference.
 */
export function ThemePicker({ settings, update, active }: Props) {
  const pick = (t: ThemeMeta) => {
    if (t.family === 'light') update({ lightTheme: t.id, appearance: 'light' })
    else update({ darkTheme: t.id, appearance: 'dark' })
  }
  return (
    <div className="theme-picker">
      <Row label="Light" themes={LIGHT_THEMES} slot={settings.lightTheme} active={active} onPick={pick} />
      <Row label="Dark" themes={DARK_THEMES} slot={settings.darkTheme} active={active} onPick={pick} />
    </div>
  )
}

function Row({
  label,
  themes,
  slot,
  active,
  onPick,
}: {
  label: string
  themes: ThemeMeta[]
  slot: ThemeId
  active: ThemeId
  onPick: (t: ThemeMeta) => void
}) {
  return (
    <div className="theme-picker__row">
      <span className="theme-picker__row-label">{label}</span>
      <div className="theme-picker__swatches">
        {themes.map((t) => (
          <button
            key={t.id}
            type="button"
            className="theme-swatch"
            data-selected={t.id === slot}
            data-active={t.id === active}
            title={`${t.label} — ${t.blurb}`}
            aria-pressed={t.id === slot}
            onClick={() => onPick(t)}
          >
            <span className="theme-swatch__chip" style={{ background: t.swatch.bg }}>
              <span className="theme-swatch__dot" style={{ background: t.swatch.accent }} />
            </span>
            <span className="theme-swatch__name">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
