/**
 * THE FLAGSHIP REGISTRY — the canvases the hero image is cut to, and every word
 * printed on it.
 *
 * WHY THIS EXISTS AT ALL
 *
 * The ad set and the App Store gallery are both *details*: one surface, one
 * claim, one fragment of UI under a headline. That is the right shape for a
 * reader who has already decided to look. It is the wrong shape for the first
 * and often only image a stranger sees — a detail asks them to assemble a whole
 * they have no reason to care about yet, and they scroll.
 *
 * So: one picture that carries the whole product. The app, at the size it is
 * actually used, doing the thing no other journal does, with the category
 * stated in words above it. Everything else we make can be a detail once this
 * exists to be the thing details are details *of*.
 *
 * COPY DISCIPLINE (docs/product/BRANDSCRIPT.md + PRINCIPLES.md)
 *
 * Banned: journey, unlock, supercharge, AI-powered, insights (as a noun-blob),
 * track, streak, score, mindfulness, wellness, hack, dashboard, analytics,
 * goal, progress, level. Never sermonize, never gamify.
 *
 * The headline is the marketing site's own H1, word for word, and that is not
 * laziness — a reader who sees this image and then lands on usedayspring.app
 * should meet the sentence they were promised. The App Store listing, the ad
 * eyebrow and the in-app welcome already say it too.
 */

import type { ThemeId } from '@/lib/resolveTheme'
import type { FlagshipSurface } from './scene'

/**
 * How the words and the window are arranged on a given canvas.
 *
 * `beside` — copy in a column on the left, the window filling the right and
 * running off the edge. Only works where there is width to spare; it is the
 * composition that reads as "software" fastest, because the app is the largest
 * object in the frame rather than an illustration under a title.
 *
 * `stacked` — copy across the top, the window below and bleeding off the
 * bottom. The square, the 4:5 and the story have no width to give a column
 * away, and a `tight` window across their full width is bigger than a `wide`
 * one squeezed beside a paragraph.
 */
export type FlagshipLayout = 'beside' | 'stacked'

export interface Canvas {
  /** CSS px the frame lays out at. */
  css: { w: number; h: number }
  /** Pixels the file is finally written at. */
  out: { w: number; h: number }
  layout: FlagshipLayout
  /**
   * What binds the window's size.
   *
   * `height` — the whole window fits, titlebar to bottom edge, and only runs
   * off the right. The most flattering rendering and the one to use wherever
   * there is the height for it: a window with its foot on the ground is an
   * app, and the lights at the top say which kind.
   *
   * `width` — the window fills the width and runs off the BOTTOM of the frame,
   * under the fade. A 1200x630 card and a 4:5 feed cell are simply too short to
   * hold a 840pt window and a headline; fitted to their height the app becomes
   * a postage stamp with a wide margin, which is the failure mode this whole
   * image exists to correct.
   */
  fit: 'height' | 'width'
  /**
   * Air above and below a height-fitted window, in frame px.
   *
   * Fitted exactly, the titlebar lands flush against the top edge and the image
   * reads as a screenshot somebody cropped rather than an object on a ground.
   * But air is bought out of scale, and on a short canvas it is bought at a
   * ruinous price: at 46px the OG card's window shrinks to a 468px stamp with a
   * field of empty ground beside it. So the landscape hero pays full price and
   * the card pays what it can afford.
   */
  air: number
  /** What this size is for, in the manifest. Not rendered. */
  use: string
}

/**
 * Every canvas is captured at >= 660 CSS px wide and supersampled down, the
 * floor the listing capture paid for: below roughly 640, macOS's minimum window
 * width makes Chrome lay out narrow while still cropping to `--window-size`,
 * silently slicing the right edge off the image.
 */
export const CANVASES = {
  // The hero. Site header, press kit, Product Hunt, a slide in someone's deck.
  '16x9': { css: { w: 1280, h: 720 }, out: { w: 2560, h: 1440 }, layout: 'beside', fit: 'height', air: 30, use: 'Site hero, press, decks' },
  // Open Graph / Twitter card — every link anyone ever pastes.
  /*
   * Height-fitted, unlike its landscape sibling. Scaled to the WIDTH this card
   * is so short that the crop lands halfway down the palette — a menu with its
   * bottom half missing, which is the one element the picture exists to show.
   */
  og: { css: { w: 1200, h: 630 }, out: { w: 1200, h: 630 }, layout: 'beside', fit: 'height', air: 20, use: 'Link previews (og:image)' },
  // Meta feed, and the safest single crop for anything square.
  '1x1': { css: { w: 720, h: 720 }, out: { w: 1080, h: 1080 }, layout: 'stacked', fit: 'width', air: 0, use: 'Meta feed, anything square' },
  // The largest cell in the Facebook and Instagram feed.
  '4x5': { css: { w: 660, h: 825 }, out: { w: 1080, h: 1350 }, layout: 'stacked', fit: 'width', air: 0, use: 'Meta feed (primary paid placement)' },
  // Stories and Reels.
  '9x16': { css: { w: 675, h: 1200 }, out: { w: 1080, h: 1920 }, layout: 'stacked', fit: 'width', air: 0, use: 'Stories, Reels' },
} as const satisfies Record<string, Canvas>

export type CanvasId = keyof typeof CANVASES

export interface Cut {
  /** URL key (`?__preview=flagship&cut=<id>`) and output directory stem. */
  id: string
  /**
   * Fraunces 300. The accent half renders italic in the dawn gradient.
   *
   * There is no eyebrow above it. The ads carry one — "A journal for spiritual
   * growth", stating the category before the hook lands — but here the headline
   * IS that sentence, so the two together printed the same words twice, in two
   * sizes, one above the other. On an image whose whole argument is the picture,
   * the first thing to cut is the line that says nothing new.
   */
  headline: { lead: string; accent: string }
  /** Newsreader. One line. The gesture, named — the picture does the rest. */
  sub: string
  /** Palette the app is shown in. */
  theme: ThemeId
  /**
   * Print no words at all — wordmark, headline, footer, the lot.
   *
   * For the places that supply their own words and where ours would collide
   * with theirs: the marketing site's own hero, a press kit's "just the app,
   * please", a slide someone else is writing the title for.
   */
  bare?: boolean
  /**
   * The panels, top to bottom, each with the two or three words printed over it.
   *
   * Absent means the page alone — the only surface that announces the category
   * without help. Set, and the frame renders them stacked in reading order,
   * which is the argument: this, and then what it becomes. See PANELS in
   * FlagshipFrame for why no surface is ever shown on its own.
   */
  pair?: [FlagshipSurface, string][]
  /**
   * Render only these canvases. Absent means all five.
   *
   * The bare cut needs this. With no headline above it there is nothing to
   * fit the window *around*, so on a short canvas it scales to the full width
   * and runs off the bottom through the middle of the palette — a product shot
   * of an app with half a menu. Landscape, whole, and centred is the only
   * arrangement a wordless one has.
   */
  canvases?: CanvasId[]
}

/**
 * One line, and it names what is in the menu rather than how to open it.
 *
 * It used to read "Type / and it opens in the line you're writing", which fails
 * twice over. "It" has no antecedent — a stranger cannot tell what opens — and
 * narrating a keystroke is the one job the picture already does perfectly well
 * on its own. Nobody needs the shortcut explained; they need to know what is
 * behind it.
 *
 * What is behind it is the whole vocabulary of a life with God: scripture, a
 * prayer, a sense, a desire, something learned, a story, an ancient practice.
 * That is what the open palette is a picture OF, and saying so is what turns it
 * from a mysterious menu into the argument of the image.
 *
 * "The Christian life" and not "you, a Christian": the first describes this
 * product, the second asserts something about the reader's religion, and Meta's
 * personal-attributes policy rejects the second reliably. It is also the first
 * place any public copy names the audience out loud — deliberate, because Meta
 * removed religion from targeting in 2022, so the creative has to do the
 * targeting itself (docs/product/PAID_SOCIAL.md).
 */
const SUB = 'Everything the Christian life asks of a page, in one place.'

export const CUTS: Cut[] = [
  {
    id: 'write',
    // The marketing site's H1, verbatim. See the note at the top of this file.
    headline: { lead: 'A journal built for', accent: 'spiritual growth.' },
    sub: SUB,
    // Dawn, and deliberately: the app's shipped default is ink, but a hero is
    // read in a feed and on a white site, and the cream page is the thing that
    // does not look like every other dark developer tool. The ink cut is
    // rendered alongside it — `--theme=ink` — for dark placements.
    theme: 'dawn',
  },
  {
    id: 'bare',
    headline: { lead: 'A journal built for', accent: 'spiritual growth.' },
    sub: SUB,
    theme: 'dawn',
    bare: true,
    canvases: ['16x9'],
  },
]

/**
 * EXPERIMENTS — combinations under test, not the shipped set.
 *
 * The question each of these is trying to answer is the one a single surface
 * cannot: *is this a journal?* Rendered alone the Ascent is a mountain, the
 * Altar is a list of names and the Lamp is a lit grid; only the writing page
 * and the wall of pages say the category on sight. So each experiment pairs a
 * surface that announces the category with one that carries the promise, and
 * the variable is which pairing, in which order, with which two words on it.
 */
export const EXPERIMENTS: Cut[] = [
  {
    // The canonical pair. Write today; a year later it is read back to you.
    id: 'x-year',
    headline: { lead: 'See what God has been', accent: 'making of you.' },
    sub: 'A year of your own words, read back to you.',
    theme: 'ink',
    canvases: ['4x5'],
    pair: [
      ['page', 'What you write'],
      ['ascent', 'What it becomes'],
    ],
  },
  {
    // The strongest emotional claim in the BrandScript: the answers arrive and
    // go unnoticed because the asking was forgotten.
    id: 'x-prayers',
    headline: { lead: 'Your prayers,', accent: 'remembered.' },
    sub: 'Laid down mid-sentence, and gathered by the people you carry.',
    theme: 'ink',
    canvases: ['4x5'],
    pair: [
      ['page', 'A prayer, mid-sentence'],
      ['altar', 'Every prayer, gathered'],
    ],
  },
  {
    // The only pair where the same object is visibly in both panels: Romans
    // 8:28 is written into the page on top and lit in the canon below.
    id: 'x-verses',
    headline: { lead: 'Find the verses that', accent: 'actually met you.' },
    sub: 'Every passage you wrote down — by season, by year, by book.',
    theme: 'ink',
    canvases: ['4x5'],
    pair: [
      ['page', 'A verse in the page'],
      ['lamp', 'Every verse that met you'],
    ],
  },
  {
    // Scale, rather than insight: one page, then the pile it belongs to.
    id: 'x-decade',
    headline: { lead: 'Ten years of writing.', accent: "One story you've never read." },
    sub: 'Bring your Day One or Diarly archive across in about a minute.',
    theme: 'ink',
    canvases: ['4x5'],
    pair: [
      ['page', 'One page'],
      ['wall', 'Ten years of them'],
    ],
  },
  {
    // No writing panel at all — the wall carries the category on its own, which
    // is the thing worth testing here. If it holds, the page is not compulsory.
    id: 'x-archive',
    headline: { lead: 'Ten years of writing.', accent: "One story you've never read." },
    sub: 'A pile of entries is not a story. Scrolling is not remembering.',
    theme: 'ink',
    canvases: ['4x5'],
    pair: [
      ['wall', 'Ten years of pages'],
      ['ascent', 'What they add up to'],
    ],
  },
  {
    // Reversed: the tool first, the writing second. The only pair that argues
    // forward (here is a way in) rather than backward (here is what came of it).
    id: 'x-begin',
    headline: { lead: "When you don't know", accent: 'where to begin.' },
    sub: 'The Examen, Lectio Divina, lament — laid gently over the page.',
    theme: 'ink',
    canvases: ['4x5'],
    pair: [
      ['rituals', 'Choose a form'],
      ['page', 'Write into it'],
    ],
  },
  {
    // Three panels. Costs each one a third of the height, and tests whether the
    // whole arc survives at feed size or just becomes three thumbnails.
    id: 'x-triptych',
    headline: { lead: 'A journal built for', accent: 'spiritual growth.' },
    sub: 'Write today. Read the year.',
    theme: 'ink',
    canvases: ['4x5'],
    pair: [
      ['page', 'Write'],
      ['wall', 'It gathers'],
      ['ascent', 'You see the year'],
    ],
  },
]

export function cutById(id: string | null): Cut | undefined {
  return [...CUTS, ...EXPERIMENTS].find((c) => c.id === id)
}
