import { AppearanceToggle } from '@/components/AppearanceToggle'
import type { Settings } from '@/lib/settings'
import type { FocusMode } from './useFocusMode'

interface Props {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  focus: FocusMode
}

/** Subtle floating pills while writing; typewriter / dim / exit in focus mode. */
export function WritingControls({ settings, update, focus }: Props) {
  const docked = !focus.active

  return (
    <div className={`focus-controls${docked ? ' focus-controls--docked' : ''}`}>
      <AppearanceToggle
        compact
        appearance={settings.appearance}
        onChange={(appearance) => update({ appearance })}
      />
      {focus.active && (
        <>
          <span className="focus-controls__sep" aria-hidden />
          <button
            className="toggle-pill"
            data-on={settings.typewriter}
            onClick={() => update({ typewriter: !settings.typewriter })}
            title="Keep the active line centered"
          >
            typewriter
          </button>
          <button
            className="toggle-pill"
            data-on={settings.dimming}
            onClick={() => update({ dimming: !settings.dimming })}
            title="Fade everything but the current paragraph"
          >
            dim
          </button>
          <button className="toggle-pill" onClick={focus.exit} title="Exit focus (Esc)">
            ✕ esc
          </button>
        </>
      )}
    </div>
  )
}
