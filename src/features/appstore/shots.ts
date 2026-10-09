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
  | 'capture'
  | 'ascent'
  | 'rituals'
  | 'scripture'
  | 'prayer'
  | 'lamp'
  | 'history'
  | 'devices'

export interface Shot {
  /** URL key (`?__preview=listing-<id>`) and output filename stem. */
  id: string
  /** Output basename, e.g. `02-year`. */
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

/**
 * The order is the argument. App Store search shows the first three side by
 * side, so those three have to make the whole case on their own: what it is
 * (a journal built for spiritual growth — the front door D-001 chose), what it
 * gives back (the year, read back in your own words), and what it holds when
 * you don't know how to start (the rituals). The rest deepen it in the order a
 * reader asks: Scripture, prayer, the long view of the Bible, the archive, and
 * whether it fits how they live.
 *
 * One fictional writer runs through the whole strip. The prayer for Dad on the
 * page in 01 is the thread the year carries in 02 and 05 — the claim "your
 * prayers, remembered" made by the gallery itself, not only by its captions.
 */
export const SHOTS: Shot[] = [
  {
    // What `/scripture` and `/pray` put into a page, and the bar that puts them
    // there. The blocks are the commands' output, so this shows them in full
    // without mocking the ESV-backed passage search.
    id: 'listing-capture',
    file: '01-page',
    eyebrow: 'Scripture · Prayer · Practice',
    headline: { lead: 'A journal built for', accent: 'spiritual growth.' },
    subcaption: 'Scripture, prayer, and the practices of the church — right in the page you’re writing.',
    surface: 'capture',
    theme: 'dawn',
    // The capture bar sits at the bottom edge and IS half the shot.
    fadeBottom: false,
  },
  {
    // The Ascent at the year: the climb, then what the year kept returning to.
    // Since `yearLedger` graduated this is what every user sees at the top of
    // the Ascent — the mountain-and-refrain Summit the first gallery showed is
    // gone from the app.
    id: 'listing-ascent',
    file: '02-year',
    eyebrow: 'The Ascent',
    headline: { lead: 'See what God has been', accent: 'making of you.' },
    subcaption: 'Your year, read back to you — in your own words, with nothing invented.',
    surface: 'ascent',
  },
  {
    id: 'listing-rituals',
    file: '03-rituals',
    eyebrow: 'Rituals',
    headline: { lead: "When you don't know where to", accent: 'begin.' },
    // No count. "Nine contemplative forms" was true for one release and false
    // for every one after it; the shelf grows through the year by design.
    subcaption:
      'The Examen, Lectio Divina, the Morning Offering — practices of the praying church, with more added through the year.',
    surface: 'rituals',
    theme: 'dawn',
    // Past the library's greeting and its filters, straight onto the cards. The
    // grid is forced to one column under 480px and the widest iPhone is 440pt,
    // so every iPhone shows one column; a 2x3 grid would be a layout that does
    // not exist on the device this listing is for.
    cropTop: 405,
  },
  {
    // A scripture ritual as it is walked on a phone: the passage, a phrase
    // drawn out of it, and a line written about it.
    id: 'listing-scripture',
    file: '04-scripture',
    eyebrow: 'Scripture',
    headline: { lead: 'Scripture that', accent: 'stays with you.' },
    subcaption: 'Lectio Divina, SOAP, Discovery Bible Study — the passage open above the page while you write.',
    surface: 'scripture',
    theme: 'dawn',
    fadeBottom: false,
  },
  {
    // One thread of the year, ask to now. The Altar's own surface draws a
    // subject's warmth as soft glowing strands, which at gallery scale read as
    // redacted text; the same prayers told as lines say "remembered" plainly.
    id: 'listing-prayer',
    file: '05-prayer',
    eyebrow: 'Prayer',
    headline: { lead: 'Your prayers,', accent: 'remembered.' },
    subcaption: 'Every time you brought it to God, gathered in order — so you can see what came of it.',
    surface: 'prayer',
    // Down the year to its first thread — its name, then every line of it, ask
    // to now, inside the card. No pad: the Ascent's sky is a gradient, and a
    // band of flat card paper above it reads as a seam.
    cropTop: 585,
  },
  {
    id: 'listing-lamp',
    file: '06-lamp',
    eyebrow: 'The Lamp',
    headline: { lead: 'Find the verses that', accent: 'actually met you.' },
    subcaption: 'Every passage you’ve written about, lit across the whole Bible.',
    surface: 'lamp',
    // Past the surface's own title (the caption already says it) and its range
    // row, onto "Here you leaned toward…" and the canon. The row scrolls on a
    // phone so the chosen range stays in view, which leaves "All time" cut at
    // the left edge — right in the app, and a clipping bug in a card.
    cropTop: 158,
    padTop: 24,
  },
  {
    id: 'listing-history',
    file: '07-history',
    eyebrow: 'Your history',
    headline: { lead: 'Bring your journal', accent: 'with you.' },
    subcaption:
      'A one-minute import from Day One or Diarly — original dates kept, and every verse you ever wrote found.',
    surface: 'history',
    // Paper, between the Lamp's dark and the devices' — and the reading
    // surface is where the light palette is most at home.
    theme: 'dawn',
  },
  {
    // The one shot that isn't a single card: two real layouts side by side is the
    // only way to say "both" without asking the reader to take it on faith.
    id: 'listing-devices',
    file: '08-devices',
    eyebrow: 'Mac · iPhone · Web',
    headline: { lead: 'Start on your phone,', accent: 'finish on your Mac.' },
    // No subcaption: the lines under the devices carry the facts, and stacking
    // both would be three text blocks in a row.
    subcaption: '',
    surface: 'devices',
  },
]

/** The shots a platform's set holds, in order. The phone-and-Mac composite
 *  argues the wrong thing on an iPad sheet, so the iPad set ends before it. */
export function shotsFor(platform: 'iphone' | 'ipad'): Shot[] {
  return platform === 'ipad' ? SHOTS.filter((s) => s.surface !== 'devices') : SHOTS
}

export function shotById(id: string): Shot | undefined {
  return SHOTS.find((s) => s.id === id)
}
