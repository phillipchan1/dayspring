import type { ThemeId } from './resolveTheme'

/**
 * A voice is a palette pair, a type pairing, a scale and an ornament — the whole
 * look of the app under one name.
 *
 * Themes used to be palettes only: nine `[data-theme]` blocks setting ~30 colour
 * roles, while every `--font-*` token lived once in `:root`. That made a palette
 * structurally incapable of carrying a typeface, and it is why headings were the
 * body face at 1.6em/700 with no family of their own.
 *
 * Two consequences of the shape here are deliberate:
 *
 *  • A voice spans light AND dark, so the face never changes when the sun goes
 *    down. `lightTheme`/`darkTheme` were independent slots, which meant the
 *    palette could change out from under a face chosen for the other one.
 *
 *  • The palette ids are unchanged. `themes.css` keeps its selectors, Ink/Ember/
 *    Compline keep their exact values, and nothing a user already chose is
 *    deleted — those palettes are simply reached as the dark half of a voice.
 *
 * See docs/product/DECISIONS.md D-028.
 */
export type VoiceId = 'dawn' | 'vellum' | 'cloister' | 'sabbath' | 'plainsong' | 'vigil'

export interface Voice {
  id: VoiceId
  label: string
  /** One line for the picker. */
  blurb: string
  /** Palette by day. `null` for a voice that only exists at night. */
  light: ThemeId | null
  /** Palette by night. Every voice has one. */
  dark: ThemeId
  /**
   * The face this voice reads and writes in, as an `EditorFont` id. Written to
   * `settings.editorFont` verbatim so an older client on the other release
   * channel still resolves a real font — see settings.ts, EDITOR_FONT_VARS.
   */
  face: 'serif' | 'literary' | 'typewriter' | 'mono' | 'sans' | 'readable'
  /** Preview chips for the picker — kept in sync with themes.css. */
  swatch: { light: string; dark: string; accent: string }
}

/**
 * The voice registry. Add a voice here, a `[data-theme]` block per palette in
 * themes.css, and an entry in index.html's boot map (the FOUC guard duplicates
 * this by hand — resolveTheme.test.ts asserts the two stay in sync).
 */
export const VOICES: Voice[] = [
  {
    id: 'dawn',
    label: 'Dawn',
    blurb: 'Sunrise on paper. The one that welcomes.',
    light: 'dawn',
    dark: 'ink',
    face: 'serif',
    swatch: { light: '#fbf6ee', dark: '#14161d', accent: '#c2683a' },
  },
  {
    id: 'vellum',
    label: 'Vellum',
    blurb: 'Aged paper, ink that bites. The manuscript.',
    light: 'vellum',
    dark: 'ember',
    face: 'serif',
    swatch: { light: '#f3e9d5', dark: '#1a1411', accent: '#8a5324' },
  },
  {
    id: 'cloister',
    label: 'Cloister',
    blurb: 'Cool stone, north light. The institution.',
    light: 'cloister',
    dark: 'compline',
    face: 'serif',
    swatch: { light: '#f1f2f4', dark: '#13121e', accent: '#3d6d8f' },
  },
  {
    id: 'sabbath',
    label: 'Sabbath',
    blurb: 'Sage and pine. The quiet one.',
    light: 'sabbath',
    dark: 'grove',
    face: 'serif',
    swatch: { light: '#f1f4ee', dark: '#101613', accent: '#3f7d6a' },
  },
  {
    id: 'plainsong',
    label: 'Plainsong',
    blurb: 'One line, unadorned. The plaintext voice.',
    light: 'quire',
    dark: 'nocturne',
    face: 'mono',
    swatch: { light: '#f4f3f0', dark: '#000000', accent: '#a06a1e' },
  },
  {
    id: 'vigil',
    label: 'Vigil',
    blurb: 'Dimmed all the way down, for dark rooms.',
    light: null,
    dark: 'vigil',
    face: 'readable',
    swatch: { light: '#080807', dark: '#080807', accent: '#8a7f6a' },
  },
]

export const DEFAULT_VOICE: VoiceId = 'dawn'

const BY_ID = Object.fromEntries(VOICES.map((v) => [v.id, v])) as Record<VoiceId, Voice>

export function getVoice(id: VoiceId | undefined): Voice {
  return (id && BY_ID[id]) || BY_ID[DEFAULT_VOICE]
}

/** True when this voice has no daylight palette — the picker disables Light for it. */
export function isNightOnly(id: VoiceId | undefined): boolean {
  return getVoice(id).light === null
}

/**
 * The voice whose palettes best match a stored light/dark pair.
 *
 * Used once, to carry someone across from the old two-slot picker. The light
 * palette wins because it is the one most people actually chose — the dark slot
 * was very often left at its default.
 */
export function voiceForPalettes(light: ThemeId | undefined, dark: ThemeId | undefined): VoiceId {
  const byLight = VOICES.find((v) => v.light && v.light === light)
  if (byLight) return byLight.id
  const byDark = VOICES.find((v) => v.dark === dark)
  if (byDark) return byDark.id
  return DEFAULT_VOICE
}
