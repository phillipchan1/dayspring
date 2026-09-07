/**
 * THE APP STORE LISTING SHOTS — the registry, and the single home for every word
 * that appears in a marketing screenshot.
 *
 * Captions are rendered in the page (not composited in Pillow), so editing copy
 * here and re-running `npm run screenshots:appstore-listing` is the whole loop —
 * and the gold-gradient `<em>` stays real text rather than baked pixels.
 *
 * Copy discipline (docs/product/BRANDSCRIPT.md): no *journey*, *unlock*, *track*,
 * *streak*, *score*, *insights*, *AI-powered*, *mindfulness*, *hack*. Never
 * sermonize, never gamify. And PRINCIPLES.md #1 is the test that matters here —
 * "could a user screenshot this UI and feel judged by it? Then it's a verdict."
 */

import type { ThemeId } from '@/lib/resolveTheme'

export type ShotSurface =
  | 'ascent'
  | 'capture'
  | 'rituals'
  | 'altar'
  | 'lamp'
  | 'history'
  | 'devices'

export interface Shot {
  /** URL key (`?__preview=listing-<id>`) and output filename stem. */
  id: string
  /** Output basename, e.g. `01-ascent`. */
  file: string
  /** Mono, uppercase, letter-spaced. Names the thing before the headline lands. */
  eyebrow: string
  /**
   * Fraunces 300. Split so the second half renders italic with the dawn gradient
   * — the marketing site's signature treatment.
   */
  headline: { lead: string; accent: string }
  /** Newsreader. The concrete detail, so the headline can stay short. */
  subcaption: string
  surface: ShotSurface
  /**
   * Palette for this shot's card. Defaults to `ink`, the shipped dark default.
   *
   * The set is deliberately mixed. Ascent and Lamp are built on glow — a lit
   * chapter cell only reads as lit against darkness — while the writing surfaces
   * go to `dawn`, which is what `appearance: 'auto'` actually gives anyone on a
   * light-mode phone. It also makes shot 02's "themes — light or dark"
   * something the gallery shows rather than merely claims.
   */
  theme?: ThemeId
  /**
   * Device px to shift the snippet up inside its card, cropping from the top.
   * Only for surfaces whose own header repeats what the caption already says.
   */
  cropTop?: number
  /**
   * Device px of breathing room to give back at the top after cropping. A crop
   * lands wherever it lands — often mid-padding, which butts the first control
   * against the card's rounded corner and reads as a clipping bug.
   */
  padTop?: number
  /**
   * The card fades out at its bottom edge so a mid-content cut reads as "more
   * below" rather than as breakage. Set false when the bottom of the snippet is
   * the subject and must stay at full contrast.
   */
  fadeBottom?: boolean
}

export const SHOTS: Shot[] = [
  {
    id: 'listing-ascent',
    file: '01-ascent',
    eyebrow: 'The long view',
    headline: { lead: 'See what God has been', accent: 'making of you.' },
    subcaption: 'Week, month, quarter, year — built only from what you actually wrote.',
    surface: 'ascent',
  },
  {
    // Was two shots — a bare editor and an editor with the capture bar, which
    // were the same picture twice. One shot now carries the whole idea: the
    // page, what `/scripture` and `/pray` put *into* it, and the bar that does
    // it. The blocks are the commands' output, so this shows them in fullness
    // without mocking the ESV-backed passage search.
    id: 'listing-capture',
    file: '02-capture',
    eyebrow: 'Scripture · Prayer · Sense',
    headline: { lead: 'Beautiful to write in.', accent: 'Made for the inner life.' },
    subcaption:
      'Scripture and prayer, captured without leaving the page — by keyboard, by voice, or from a photograph of one you wrote by hand.',
    surface: 'capture',
    theme: 'dawn',
    // The capture bar sits at the bottom edge and IS half the shot.
    fadeBottom: false,
  },
  {
    id: 'listing-rituals',
    file: '03-rituals',
    eyebrow: 'Rituals',
    headline: { lead: "When you don't know where to", accent: 'begin.' },
    subcaption:
      'Nine contemplative forms — the Examen, Lectio Divina, the Prayer of Recollection — laid over the page as scaffolding, never a script.',
    surface: 'rituals',
    theme: 'dawn',
    // Past the library's heading AND its filter chips, straight onto the cards.
    // The grid is `repeat(auto-fill, minmax(240px, 1fr))` but forced to a single
    // column under 480px, and the widest iPhone is 440pt — so every iPhone shows
    // one column and a 2x3 grid would be a layout that does not exist on the
    // device this listing is for. Four named forms with their authors is the most
    // breadth available honestly.
    cropTop: 366,
  },
  {
    id: 'listing-altar',
    file: '04-altar',
    eyebrow: 'The Altar',
    headline: { lead: 'Your prayers,', accent: 'remembered.' },
    subcaption:
      'You write a prayer down and never see it again. Here they gather — by the people you carry, the places you are spent, and what He keeps tending in you.',
    surface: 'altar',
    // Past the surface's own title and the type chips, onto the subjects.
    cropTop: 150,
  },
  {
    id: 'listing-lamp',
    file: '05-lamp',
    eyebrow: 'The Lamp',
    headline: { lead: 'Find the verses that', accent: 'actually met you.' },
    subcaption: 'Season, year, or all of it — a hard year looks nothing like spring.',
    surface: 'lamp',
    // Past the surface's own title (the caption already says it) onto the
    // season chips and the canon grid — then hand back a little room, or the
    // "This year" pill sits in the card's rounded corner.
    cropTop: 124,
    padTop: 26,
  },
  {
    id: 'listing-history',
    file: '06-history',
    eyebrow: 'Your history',
    headline: { lead: 'Bring your journal', accent: 'with you.' },
    subcaption:
      'A one-minute import from Day One or Diarly brings the whole thing with you — original dates kept, and every Scripture reference you ever wrote found and lit.',
    surface: 'history',
    // No crop: all eleven year rows already clear the fold, and any crop small
    // enough to keep them shaves the List / Month / Year toggle in half.
  },
  {
    // The one shot that isn't a single card: two real layouts side by side is the
    // only way to say "both" without asking the reader to take it on faith.
    id: 'listing-devices',
    file: '07-devices',
    eyebrow: 'Mac · iPhone · Web',
    headline: { lead: 'Start on your phone,', accent: 'finish on your Mac.' },
    // No subcaption: the three lines under the devices carry the facts, and
    // stacking both would be three text blocks in a row.
    subcaption: '',
    surface: 'devices',
  },
]

export function shotById(id: string): Shot | undefined {
  return SHOTS.find((s) => s.id === id)
}
