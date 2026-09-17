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
  '16x9': { css: { w: 1280, h: 720 }, out: { w: 2560, h: 1440 }, layout: 'beside', fit: 'height', air: 46, use: 'Site hero, press, decks' },
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
  /** Mono, uppercase, read first: what kind of thing this is. Never clever. */
  eyebrow: string
  /** Fraunces 300. The accent half renders italic in the dawn gradient. */
  headline: { lead: string; accent: string }
  /** Newsreader. The gesture, said plainly, so the picture is explained. */
  sub: string
  /** The offer, in the footer. Web prices — these land on the web. */
  offer: string
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

/** Same line everywhere: the site H1, the ad eyebrow, the welcome carousel. */
const CATEGORY = 'A journal for spiritual growth'

const OFFER = '14-day free trial · no card · usedayspring.app'

/**
 * Both halves of the promise, in two sentences — and it has to be both.
 *
 * The first sentence explains the picture. The image shows a menu with the word
 * "Scripture" in it, which is not the same as a stranger understanding that the
 * passage lands *in the line, from inside the page*. Naming it is the
 * difference between "a journal with a menu" and the only thing here nobody
 * else does.
 *
 * The second sentence is why anyone would keep doing it, and without it this
 * image sells a nice editor. The product is the years, not the session. Said
 * flatly — "a year of those words, read back" — because the moment it promises
 * what the reader will FIND there, it is making a claim about God's work in a
 * stranger's life, which is the one thing we never do (GUARDRAILS H1).
 */
const GESTURE =
  "Type / and scripture, a prayer, or an ancient practice opens in the line you're writing. And a year of those words, read back, shows you who you're becoming."

export const CUTS: Cut[] = [
  {
    id: 'write',
    eyebrow: CATEGORY,
    // The marketing site's H1, verbatim. See the note at the top of this file.
    headline: { lead: 'A journal built for', accent: 'spiritual growth.' },
    sub: GESTURE,
    offer: OFFER,
    // Dawn, and deliberately: the app's shipped default is ink, but a hero is
    // read in a feed and on a white site, and the cream page is the thing that
    // does not look like every other dark developer tool. The ink cut is
    // rendered alongside it — `--theme=ink` — for dark placements.
    theme: 'dawn',
  },
  {
    id: 'bare',
    eyebrow: CATEGORY,
    headline: { lead: 'A journal built for', accent: 'spiritual growth.' },
    sub: GESTURE,
    offer: OFFER,
    theme: 'dawn',
    bare: true,
    canvases: ['16x9'],
  },
]

export function cutById(id: string | null): Cut | undefined {
  return CUTS.find((c) => c.id === id)
}
