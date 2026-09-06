import type { ThemeId } from '@/lib/resolveTheme'
import type { Settings } from '@/lib/settings'
import { VOICES, isNightOnly, type Voice } from '@/lib/voices'
import './ThemePicker.css'

interface Props {
  settings: Settings
  update: (patch: Partial<Settings>) => void
  /** The palette currently on screen (resolved from appearance + the voice). */
  active: ThemeId
}

/**
 * The voice picker.
 *
 * This used to be two grids — one light palette, one dark, chosen independently.
 * That is what let the face change when the sun went down, because the two slots
 * had no reason to agree with each other. A voice owns both grounds, so there is
 * one row per voice and the pair moves together.
 *
 * Each row is set in the voice's own display face, because the face is now half
 * of what is being chosen and a swatch alone cannot show it.
 */
export function ThemePicker({ settings, update, active }: Props) {
  const pick = (v: Voice) => {
    // `voice` is the choice; settings.reconcileVoice projects it back onto
    // lightTheme / darkTheme / editorFont so a client on the other release
    // channel still finds valid values in the shared settings row.
    // A night-only voice has nowhere to go in light mode, so it takes the app
    // dark rather than leaving the toggle pointing at a ground it lacks.
    if (isNightOnly(v.id)) update({ voice: v.id, appearance: 'dark' })
    else update({ voice: v.id })
  }

  return (
    <div className="voice-picker">
      {VOICES.map((v) => {
        const selected = v.id === settings.voice
        const night = isNightOnly(v.id)
        return (
          <button
            key={v.id}
            type="button"
            className="voice-row"
            data-selected={selected}
            data-active={v.light === active || v.dark === active}
            aria-pressed={selected}
            onClick={() => pick(v)}
          >
            <span className="voice-row__chips" aria-hidden="true">
              <span className="voice-row__chip" style={{ background: v.swatch.light }}>
                <span className="voice-row__dot" style={{ background: v.swatch.accent }} />
              </span>
              <span className="voice-row__chip" style={{ background: v.swatch.dark }}>
                <span className="voice-row__dot" style={{ background: v.swatch.accent }} />
              </span>
            </span>
            <span className="voice-row__text">
              <span className="voice-row__name" data-voice={v.id}>
                {v.label}
              </span>
              <span className="voice-row__blurb">
                {v.blurb}
                {night ? ' Night only.' : ''}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
