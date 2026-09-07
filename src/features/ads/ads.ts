/**
 * THE PAID-SOCIAL AD REGISTRY — the single home for every word that appears in
 * a Facebook or Instagram ad, and for the Meta fields that travel beside it.
 *
 * Same discipline as src/features/appstore/shots.ts, and for the same reason:
 * copy is rendered in the page rather than composited, so editing this file and
 * re-running `npm run ads` is the whole loop, and the gold-gradient `<em>` stays
 * real text rather than baked pixels.
 *
 * WHAT MAKES AN AD DIFFERENT FROM A LISTING SHOT
 *
 * A listing shot is read by someone who already tapped through to the App Store
 * — they have decided to look. An ad is read by someone who has decided nothing
 * and is moving. Two consequences shape everything below:
 *
 *   1. Meta removed religion from detailed targeting in 2022, so we cannot
 *      target Christians. The creative has to do the targeting: the first line
 *      must be so specifically *for this person* that everyone else scrolls on.
 *      That favours concrete and slightly uncomfortable over beautiful and
 *      abstract — the opposite of the brand's instinct, on purpose.
 *   2. There is no App Store page underneath to explain what this is or what it
 *      costs, so every ad carries its own footer: the mark, and the offer.
 *
 * COPY DISCIPLINE (docs/product/BRANDSCRIPT.md + PRINCIPLES.md)
 *
 * Banned: journey, unlock, unleash, supercharge, AI-powered, insights (as a
 * noun-blob), optimize, track, streak, score, mindfulness, wellness, hack,
 * dashboard, analytics, goal, progress, level. `score` appears exactly once,
 * inside the refusal promise in D3 — quoting the thing we won't do is the point
 * of that ad, and the line already ships in the App Store description.
 *
 * Never sermonize, never gamify. PRINCIPLES #1 is the test that matters:
 * "could a user screenshot this and feel judged by it? Then it's a verdict."
 * GUARDRAILS H1 is the other: the app reports what *you* wrote. It never
 * narrates what God did. "You asked in March" is ours to say; "God answered in
 * September" never is.
 *
 * NO SOCIAL PROOF. BRANDSCRIPT §3: no user counts, no testimonials, no
 * endorsement, until we have them honestly.
 */

import type { ThemeId } from '@/lib/resolveTheme'
import type { ShotSurface } from '@/features/appstore/shots'

/** Which arm of the D-001 test this ad belongs to. See docs/product/DECISIONS.md. */
export type AdArm =
  /** "You've written for years and never read it back." Aimed at P1, the Archivist. */
  | 'archive'
  /** "A journal built for spiritual growth." Aimed at P2, the Dry Season. */
  | 'growth'
  /** Neither frame — product craft or category refusal. Reads to both. */
  | 'neutral'

export type AdRatio = '4x5' | '1x1' | '9x16'

/**
 * How the app is presented inside a `surface` ad.
 *
 * `card` is the listing-shot treatment: the component in a plain rounded card.
 * It is the most honest rendering of a screen, and it is also the reason a
 * first-glance reader files the ad under "software" — a flat panel of UI reads
 * as a screenshot of a tool.
 *
 * `phone` puts the same shipped pixels inside a device shell. Nothing about the
 * app changes; what changes is that the thing in the picture is an object
 * someone holds rather than a window someone manages. In a feed full of
 * screenshots that is also the cheaper way to look unlike the others.
 */
export type AdPresentation = 'card' | 'phone'

/**
 * Where the device sits relative to the words.
 *
 * `stacked` runs the caption across the top with the device beneath — the most
 * room for a headline, which is what a cold reader is actually buying.
 *
 * `beside` sets the caption against a smaller device on the right. It costs
 * roughly a third of the headline's width, so it only suits short copy — but it
 * de-emphasises the UI, which is the point when the app is proof rather than
 * subject.
 */
export type AdComposition = 'stacked' | 'beside'

export type AdLayout =
  /** Caption over a card holding a real, shipped surface. Like a listing shot. */
  | 'surface'
  /** Type alone. No UI, nothing to disbelieve — the fastest thing to read cold. */
  | 'typographic'
  /** Two dated lines of your own writing, months apart, joined by a thread. */
  | 'pair'

/** The Meta Ads Manager fields. Every one is a separate box in the UI. */
export interface AdMeta {
  /**
   * Primary text. Meta truncates around 125 characters on mobile, so the first
   * sentence has to survive alone — everything after it is read only by someone
   * who already tapped "more".
   */
  primary: string
  /** Headline. Renders under the image, bold. Keep under ~40 characters. */
  headline: string
  /** Description. Often suppressed by placement; never load-bearing. */
  description: string
  /** The Ads Manager call-to-action button. */
  cta: 'Learn more' | 'Sign up'
}

export interface Ad {
  /** URL key (`?__preview=ad-<id>`) and output directory stem. */
  id: string
  /** Output basename, e.g. `d1-pile`. */
  file: string
  /** One line on what this ad is arguing, for the copy deck. Not rendered. */
  premise: string
  arm: AdArm
  layout: AdLayout
  /**
   * Mono, uppercase, letter-spaced, and read first. This is where the ad says
   * what kind of thing it is — see CATEGORY. Not a label, and not a place to be
   * interesting.
   */
  eyebrow: string
  /**
   * Fraunces 300. The accent half renders italic in the dawn gradient.
   *
   * `hardBreak` forces the accent onto its own line. Needed where the lead is
   * short enough that the first word or two of the accent creeps up beside it
   * and strands there — "You asked in March. *By*" reads as a typo, not as a
   * line break. Left off where the two halves wrap into each other naturally,
   * because forcing it there strands the lead instead ("Type /" alone on a
   * line is a smaller headline, not a better one).
   */
  headline: { lead: string; accent: string; hardBreak?: boolean }
  /** Newsreader. The concrete detail, so the headline can stay short. */
  subcaption: string
  /** `surface` layouts only — which shipped component fills the card. */
  surface?: ShotSurface
  /** `surface` layouts only. Defaults to `card`. */
  presentation?: AdPresentation
  /** `surface` layouts only. Defaults to `stacked`. */
  composition?: AdComposition
  /** Palette for the card. Defaults to `ink`, the shipped dark default. */
  theme?: ThemeId
  /** Device px to shift the snippet up inside its card. Mirrors Shot.cropTop. */
  cropTop?: number
  /** Device px of breathing room handed back after cropping. Mirrors Shot.padTop. */
  padTop?: number
  /** `typographic` layouts — the struck-through stack above the headline. */
  struck?: string[]
  /** `pair` layouts — the two dated lines, and the note under them. */
  pair?: { entries: { date: string; line: string }[]; note: string }
  /** The offer line in the footer. Web prices, because ads land on the web. */
  offer: string
  meta: AdMeta
}

/** Every ad closes on the same offer. Web pricing — $7 / $64, not Apple's. */
const OFFER = '14-day free trial · no card · usedayspring.app'

/**
 * The eyebrow, and it is the same on every ad on purpose.
 *
 * CLEAR BEFORE CLEVER. The eyebrow is the first thing read — top of the frame,
 * amber, alone on its line — and it used to be a poetic label: "Eleven years",
 * "The Altar", "What we won't build". Every one of those made the reader work
 * out what kind of thing this is before the headline could land, and
 * BRANDSCRIPT's grunt test is unforgiving about that: in five seconds, *what do
 * you offer?* A stranger in a feed does not owe us the inference.
 *
 * So the eyebrow states the category and the headline is free to be the hook.
 * That ordering IS the principle — clear first, literally above clever.
 *
 * The wording is not improvised: it is the shipped first line of the in-app
 * welcome carousel, whose header says the copy is final, and it is one clause
 * off the marketing site's H1. Saying the same thing in all three places is the
 * point — a reader who taps through should land on the sentence they were
 * promised.
 *
 * Uniform across the set costs nothing (nobody sees six of these at once) and it
 * means the one variable under test is the hook, not the framing.
 */
const CATEGORY = 'A journal for spiritual growth'

export const ADS: Ad[] = [
  {
    // The specificity play, and the best self-targeting creative in the set: an
    // archivist recognises themselves in the first line and nobody else does.
    // Derived from BRANDSCRIPT's third alternate one-liner, "Ten years of
    // journaling. One story you've never read."
    id: 'ad-pile',
    file: 'd1-pile',
    premise: 'You have years of entries and have never read them back.',
    arm: 'archive',
    layout: 'surface',
    eyebrow: CATEGORY,
    headline: { lead: "You've written it all down.", accent: "You've never read it back." },
    subcaption:
      'Import your Day One or Diarly archive in about a minute — original dates kept — and Dayspring reads it back to you in your own words.',
    surface: 'ascent',
    presentation: 'phone',
    // Stacked, not beside: the Summit is a full-height mountain with the line of
    // the year beneath it, and half a column would show the mountain or the
    // line but never the climb between them.
    composition: 'stacked',
    // No crop, and it was tried: the empty sky above the peak looks like waste
    // in a layout tool, but cropping into it beheads the mountain, and a
    // truncated triangle is a worse picture than a quiet one. The sun cresting
    // the peak is the shot.
    offer: OFFER,
    meta: {
      primary:
        "Thousands of entries. Years of them. And if someone asked what's in there, you couldn't tell them — not because you didn't care, but because a pile of entries isn't a story, and scrolling isn't remembering.",
      headline: 'The journal that reads it back',
      description: '14-day free trial. No card.',
      cta: 'Learn more',
    },
  },
  {
    // The strongest thing the product does, and the hardest to fake. Straight
    // out of GUARDRAILS H1's ✅ column: the app puts two of your own lines side
    // by side and says nothing about them. The restraint IS the product, so the
    // note under the entries has to do that work explicitly — an ad that let a
    // reader think the app wrote either line would be selling the opposite of
    // what ships.
    id: 'ad-forgotten',
    file: 'd2-forgotten',
    premise: 'The answers arrive unnoticed because the asking was forgotten.',
    arm: 'archive',
    layout: 'pair',
    eyebrow: CATEGORY,
    headline: { lead: 'You asked in March.', accent: "By September you'd forgotten.", hardBreak: true },
    subcaption: '',
    pair: {
      entries: [
        { date: 'March 14', line: "I can't see a way through this one." },
        { date: 'September 2', line: "It opened. I don't know when it opened." },
      ],
      note: "Two of your own entries. Dayspring found them; it didn't write them.",
    },
    offer: OFFER,
    meta: {
      primary:
        "The hard part isn't that God seems silent. It's that the answers arrive and go unnoticed, because the asking was forgotten. Dayspring gathers the prayers you lay down while writing, and brings them back — with what you wrote later.",
      headline: 'The journal that remembers your prayers',
      description: '14-day free trial. No card.',
      cta: 'Learn more',
    },
  },
  {
    // Differentiation by refusal. BRANDSCRIPT §3: "What we won't do is the proof
    // we understand the stakes" — and of the promises, "We will never score your
    // spiritual life" is flagged as "a differentiator hiding as a policy."
    // This is also the ad that answers P2's arrival objection ("is a computer
    // going to tell me how I'm doing with God?") before they raise it.
    id: 'ad-verdict',
    file: 'd3-verdict',
    premise: 'Every other app turns faith into a number. We refuse to.',
    arm: 'growth',
    layout: 'typographic',
    eyebrow: CATEGORY,
    headline: { lead: 'We will never score', accent: 'your spiritual life.' },
    subcaption:
      'Dayspring shows you what happened, in your own words, and stops there. Light, never a verdict.',
    struck: ['No streaks.', 'No badges.', 'No chapters-per-week.', 'No chart of how you are doing.'],
    // True black. The refusals should read as things receding into the dark and
    // the promise as the one thing lit — that only works on a ground with no
    // warmth left in it.
    theme: 'nocturne',
    offer: OFFER,
    meta: {
      primary:
        'Every journalling app for Christians wants to turn your faith into a number — days in a row, boxes ticked, a graph that goes up. Devotion driven by a counter is devotion corrupted. Dayspring shows you what happened and stops there.',
      headline: 'A journal, never a scoreboard',
      description: 'A journal for the inner life. 14-day free trial.',
      cta: 'Learn more',
    },
  },
  {
    // Pure product craft — no claim to defend and nothing to disbelieve, which
    // makes it the weakest cold hook (it answers "what is this?" rather than "is
    // this for me?") and the best retargeting and Reels asset. The scripture and
    // prayer blocks in the card ARE the output of /scripture and /pray, so the
    // headline is demonstrated rather than asserted.
    id: 'ad-page',
    file: 'd4-page',
    premise: 'Scripture and prayer are in the page, not in another app.',
    arm: 'neutral',
    layout: 'surface',
    eyebrow: CATEGORY,
    // Hard-broken: "Type /" is short enough that the accent's first word rides up
    // beside it and strands there. Alone on its line it also lands better — the
    // gesture, then what the gesture gets you.
    headline: { lead: 'Type /', accent: 'and Scripture is already in the sentence.', hardBreak: true },
    subcaption:
      'Scripture, prayer, and eleven contemplative forms — the Examen, Lectio Divina, the Prayer of Recollection — built into the page itself. Nothing to leave, nothing to learn.',
    surface: 'capture',
    presentation: 'phone',
    // The one ad where the app is the subject AND the argument is a gesture you
    // make with a thumb. A cream page glowing in a dark bezel does more for
    // "beautiful to write in" than the same pixels in a rectangle, and setting
    // it beside the words keeps the UI from being the first thing read.
    composition: 'beside',
    // What `appearance: 'auto'` actually gives anyone on a light-mode phone, and
    // it matches the icon and the name. A Christian journal's dominant moment is
    // the morning.
    theme: 'dawn',
    offer: OFFER,
    meta: {
      primary:
        'A journal where the spiritual life is already on the page. Type / and find a passage without leaving the sentence you were writing. Log a prayer. Lay a ritual over the page. By keyboard, by voice, or from a photograph of one you wrote by hand.',
      headline: 'A journal made for the inner life',
      description: '14-day free trial. No card.',
      cta: 'Learn more',
    },
  },
  {
    // The brand anchor, and the honest test of the growth frame: the site's own
    // bridge line, unchanged. Likely lower cold CTR than D1–D3 and stronger on
    // retargeting — but if it wins cold, D-001 resolves toward B, and that is
    // exactly what this round is for.
    id: 'ad-mirror',
    file: 'd5-mirror',
    premise: 'The growth that matters is invisible day to day, and visible across a year.',
    arm: 'growth',
    layout: 'typographic',
    eyebrow: CATEGORY,
    headline: {
      lead: 'A day is too small to hold a pattern.',
      accent: 'A year is a mirror.',
      hardBreak: true,
    },
    subcaption:
      'The growth that matters most is the hardest to feel day to day. Dayspring reads a year of your own words back to you — and only ever your own words.',
    theme: 'ink',
    offer: OFFER,
    meta: {
      primary:
        "Patience doesn't announce itself. Neither does prayer deepening, or something you believed moving from your head to your heart. A single day is too small to hold any of it. So Dayspring keeps what you write and reads a year of it back to you.",
      headline: 'A journal built for spiritual growth',
      description: '14-day free trial. No card.',
      cta: 'Learn more',
    },
  },
  {
    // Authority through tradition — it makes the machinery feel like the
    // church's own practice rather than a novelty, which pre-empts the
    // "is this just GPT summarizing me?" objection P1 arrives with. Narrower
    // audience, but that audience converts.
    id: 'ad-witnesses',
    file: 'd6-witnesses',
    premise: 'The practices are ancient. Only the remembering is new.',
    arm: 'growth',
    layout: 'surface',
    eyebrow: CATEGORY,
    headline: {
      lead: 'Ignatius had an examen.',
      accent: "He just didn't have one that remembered.",
      hardBreak: true,
    },
    subcaption:
      'Eleven contemplative forms drawn from two thousand years of the praying church — laid over the page as scaffolding, never as a script.',
    surface: 'rituals',
    presentation: 'phone',
    composition: 'beside',
    theme: 'dawn',
    // Past the library's heading and its filter chips, straight onto the cards.
    // Same crop as listing shot 03, for the same reason.
    cropTop: 366,
    offer: OFFER,
    meta: {
      primary:
        'The Daily Examen. Lectio Divina. The Prayer of Recollection. Eleven forms the church has prayed for centuries, laid gently over the page when you do not know where to begin — and kept, so you can read back what came of them.',
      headline: 'A journal that keeps the examen',
      description: '14-day free trial. No card.',
      cta: 'Learn more',
    },
  },
]

export function adById(id: string): Ad | undefined {
  return ADS.find((a) => a.id === id)
}
