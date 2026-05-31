import type { Settings } from '@/lib/settings'

interface Props {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  onExit: () => void
}

/** Minimal floating controls shown in focus mode. Fades back until hovered. */
export function FocusControls({ settings, update, onExit }: Props) {
  return (
    <div className="focus-controls">
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
      <button className="toggle-pill" onClick={onExit} title="Exit focus (Esc)">
        ✕ Esc
      </button>
    </div>
  )
}
