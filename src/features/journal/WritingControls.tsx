import type { Settings } from '@/lib/settings'
import type { FocusMode } from './useFocusMode'

interface Props {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  focus: FocusMode
  /** Only show while editing (not in read mode). */
  visible: boolean
}

/**
 * Subtle floating pills while writing. Auto (system appearance) is always
 * available; typewriter / dim / exit appear in focus mode.
 */
export function WritingControls({ settings, update, focus, visible }: Props) {
  if (!visible) return null

  return (
    <div className="focus-controls">
      <button
        className="toggle-pill"
        data-on={settings.followSystem}
        onClick={() => update({ followSystem: !settings.followSystem })}
        title={
          settings.followSystem
            ? 'Following system light/dark (click to use fixed theme)'
            : 'Use fixed theme (click to match system)'
        }
      >
        Auto
      </button>
      {focus.active && (
        <>
          <button
            className="toggle-pill"
            data-on={settings.typewriter}
            onClick={() => update({ typewriter: !settings.typewriter })}
            title="Keep the active line centered"
          >
            Typewriter
          </button>
          <button
            className="toggle-pill"
            data-on={settings.dimming}
            onClick={() => update({ dimming: !settings.dimming })}
            title="Fade everything but the current paragraph"
          >
            Dim
          </button>
          <button className="toggle-pill" onClick={focus.exit} title="Exit focus (Esc)">
            ✕ Esc
          </button>
        </>
      )}
    </div>
  )
}
