import { getTheme, type ThemeId } from '@/lib/resolveTheme'
import type { Settings } from '@/lib/settings'
import { VOICES, isNightOnly, voicePalette, type Voice } from '@/lib/voices'
import { track } from '@/lib/analytics'
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
    track('theme_changed', { theme: v.id })
    // `voice` is the choice; settings.reconcileVoice projects it back onto
    // lightTheme / darkTheme / editorFont so a client on the other release
    // channel still finds valid values in the shared settings row.
    // A night-only voice has nowhere to go in light mode, so it takes the app
    // dark rather than leaving the toggle pointing at a ground it lacks.
    //
    // Picking a voice takes its face too. A face chosen by hand in Advanced
    // typography used to survive the switch, so choosing Plainsong could leave
    // a serif body under a mono title — the row you clicked, set in the voice's
    // own face, promised something the page then didn't do. A different face
    // can still be chosen afterwards.
    if (isNightOnly(v.id)) update({ voice: v.id, appearance: 'dark', editorFontAuto: true })
    else update({ voice: v.id, editorFontAuto: true })
  }

  return (
    <div className="voice-picker">
      {VOICES.map((v) => {
        const selected = v.id === settings.voice
        const night = isNightOnly(v.id)
        const light = selected ? voicePalette(v.id, 'light', settings.paletteLight) : v.light
        const dark = selected ? voicePalette(v.id, 'dark', settings.paletteDark) : v.dark
        const wears = (id: ThemeId | null) => id !== null && (id === v.light || id === v.dark || !!v.palettes?.light.includes(id) || !!v.palettes?.dark.includes(id))
        return (
          <div key={v.id} className="voice-picker__item">
            <button
              type="button"
              className="voice-row"
              data-selected={selected}
              data-active={wears(active)}
              aria-pressed={selected}
              onClick={() => pick(v)}
            >
              <span className="voice-row__chips" aria-hidden="true">
                <span className="voice-row__chip" style={{ background: light ? getTheme(light)?.swatch.bg : v.swatch.light }}>
                  <span className="voice-row__dot" style={{ background: light ? getTheme(light)?.swatch.accent : v.swatch.accent }} />
                </span>
                <span className="voice-row__chip" style={{ background: getTheme(dark ?? v.dark)?.swatch.bg ?? v.swatch.dark }}>
                  <span className="voice-row__dot" style={{ background: getTheme(dark ?? v.dark)?.swatch.accent ?? v.swatch.accent }} />
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
            {selected && v.palettes ? (
              <PaletteChoice voice={v} settings={settings} update={update} active={active} />
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/**
 * The palettes a voice offers in place of its own, day and night — Plainsong's
 * borrowed editor themes. Shown only under the selected voice, so the list of
 * voices stays six rows and everything else keeps its designed palette.
 *
 * Picking one never flips Light/Dark: the day palette waits for daylight. The
 * side that isn't on screen says so, rather than the click seeming to do nothing.
 */
function PaletteChoice({ voice, settings, update, active }: Props & { voice: Voice }) {
  const palettes = voice.palettes
  if (!palettes) return null
  const sides = [
    { side: 'light' as const, label: 'By day', ids: palettes.light, current: voicePalette(voice.id, 'light', settings.paletteLight) },
    { side: 'dark' as const, label: 'By night', ids: palettes.dark, current: voicePalette(voice.id, 'dark', settings.paletteDark) },
  ]
  const choose = (side: 'light' | 'dark', id: ThemeId) => {
    track('palette_changed', { voice: voice.id, palette: id })
    // The voice's own palette is stored as null, so it stays the default if the
    // voice's own palettes are ever redrawn under new ids.
    const value = id === voice[side] ? null : id
    update(side === 'light' ? { paletteLight: value } : { paletteDark: value })
  }
  return (
    <div className="palette-choice">
      {sides.map(({ side, label, ids, current }) => {
        const showing = current === active
        return (
          <div key={side} className="palette-choice__side" role="radiogroup" aria-label={`${voice.label}, ${label.toLowerCase()}`}>
            <div className="palette-choice__label">
              <span>{label}</span>
              <span className="palette-choice__name">{current ? getTheme(current)?.label : ''}</span>
              {showing ? null : <span className="palette-choice__later">shows in {side} mode</span>}
            </div>
            <div className="palette-choice__chips">
              {ids.map((id) => {
                const t = getTheme(id)
                if (!t) return null
                const on = id === current
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={t.label}
                    title={t.label}
                    className="palette-chip"
                    data-selected={on}
                    style={{ background: t.swatch.bg }}
                    onClick={() => choose(side, id)}
                  >
                    <span className="palette-chip__dot" style={{ background: t.swatch.accent }} />
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
