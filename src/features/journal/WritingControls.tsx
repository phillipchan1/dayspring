import { AppearanceToggle } from '@/components/AppearanceToggle'
import type { Settings } from '@/lib/settings'
import type { FocusMode } from './useFocusMode'
import { IconFocus } from './navIcons'

interface Props {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  focus: FocusMode
  /** When set (mobile), offer a way into focus mode from this floating cluster.
   *  Desktop enters focus from its top bar, so it leaves this undefined. */
  onEnterFocus?: (() => void) | undefined
}

/** Subtle floating appearance on every surface; typewriter / dim / exit in focus mode. */
export function WritingControls({ settings, update, focus, onEnterFocus }: Props) {
  const docked = !focus.active

  return (
    <div className={`focus-controls${docked ? ' focus-controls--docked' : ''}`}>
      {docked && onEnterFocus && (
        <>
          <button
            type="button"
            className="appearance-icon-btn"
            tabIndex={-1}
            onClick={onEnterFocus}
            title="Focus mode"
            aria-label="Enter focus mode"
          >
            <IconFocus />
          </button>
          <span className="focus-controls__sep" aria-hidden />
        </>
      )}
      <AppearanceToggle
        icon
        tabFocus={false}
        appearance={settings.appearance}
        onChange={(appearance) => update({ appearance })}
      />
      {focus.active && (
        <>
          <span className="focus-controls__sep" aria-hidden />
          <button
            className="toggle-pill"
            data-on={settings.typewriter}
            tabIndex={-1}
            onClick={() => update({ typewriter: !settings.typewriter })}
            title="Keep the active line centered"
          >
            typewriter
          </button>
          <button
            className="toggle-pill"
            data-on={settings.dimming}
            tabIndex={-1}
            onClick={() => update({ dimming: !settings.dimming })}
            title="Fade everything but the current paragraph"
          >
            dim
          </button>
          <button className="toggle-pill" tabIndex={-1} onClick={focus.exit} title="Exit focus (Esc)">
            ✕ esc
          </button>
        </>
      )}
    </div>
  )
}
