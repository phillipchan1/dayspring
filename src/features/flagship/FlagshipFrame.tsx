/**
 * The flagship frame: dawn ground, a column of words, and the app in a macOS
 * window — the whole product in one picture.
 *
 * The screen is an IFRAME, not a scaled sub-tree, and the reason is the subject
 * of the image itself: `.slash-palette` is `position: fixed`, z9000, portaled to
 * `document.body`. Inside a CSS-scaled wrapper it resolves against the real
 * viewport and renders full-size *outside* the window. In an iframe it resolves
 * against the iframe's own viewport, and scaling the iframe element takes the
 * fixed layer with it. AdFrame and ShotFrame pay for the same lesson.
 */

import { useLayoutEffect, useRef, useState } from 'react'
import { Mark } from '@/components/Mark'
import { isLightTheme, type ThemeId } from '@/lib/resolveTheme'
import { CANVASES, type CanvasId, type Cut } from './flagship'
import type { FlagshipSurface } from './scene'
import './FlagshipFrame.css'

interface Props {
  cut: Cut
  canvas: CanvasId
  theme: ThemeId
  /** The capture window, in CSS px — the frame's own canvas. */
  frame: { width: number; height: number }
}

/**
 * The app window's own viewport, in CSS points — a real Mac window, not a crop.
 *
 * Two sizes, and the difference is legibility rather than taste. `wide` is a
 * generous working window and the writing column sits in it the way it does on
 * a desk. Scaled into a 1080px-wide feed image it puts the app's 17px body type
 * at about twelve pixels, which is a picture of writing rather than writing
 * anyone can read. `tight` is the same shell at the narrowest width that still
 * gives the 42rem measure its full width — so the column is most of the window
 * and survives the scale down.
 *
 * Both are above the 767px mobile breakpoint, so both lay out as the desktop
 * three-column shell. A narrower one would silently render the phone app.
 *
 * The HEIGHT is set by the palette, not by taste. The menu is ~370pt tall and
 * opens below the caret — and the caret sits under a title, a sentence and a
 * scripture block, at about y=490. A shorter window clips the menu's last rows
 * against the window's own edge, which reads as a rendering bug rather than as
 * a list that scrolls. 920 clears it.
 */
const WINDOWS = {
  wide: { width: 1180, height: 920 },
  tight: { width: 900, height: 920 },
} as const

/** Which window each canvas uses. Landscape has the room; nothing else does. */
const WINDOW_FOR: Record<CanvasId, keyof typeof WINDOWS> = {
  '16x9': 'wide',
  // An OG card is often rendered at half its own width in a chat client, so it
  // gets the tight window despite being landscape.
  og: 'tight',
  '1x1': 'tight',
  '4x5': 'tight',
  '9x16': 'tight',
}

/** Height of the drawn titlebar, in frame px. Mirrors FlagshipFrame.css. */
const TITLEBAR = 28

/** Gutter either side of the card on a stacked canvas, in frame px. */
const STACKED_GUTTER = 34

/**
 * What a STACKED canvas shows instead of the whole window, in the window's own
 * device px: a rectangle around the writing and the menu.
 *
 * A square or a 4:5 cell cannot hold a headline AND a 900x840 window. Fitted,
 * the app becomes a 450px thumbnail whose menu labels are unreadable; filled to
 * the width, the frame cuts through the middle of the palette — and half a menu
 * is the one thing this image must not be a picture of.
 *
 * So the portrait cuts are a CARD of the page, the treatment the App Store
 * shots already use, rather than a window: the rail and the title are cropped
 * away, the writing measure and both palette columns are kept whole, and what
 * is left is scaled up until a stranger can read the word "Scripture" in a
 * feed. The Mac window, chrome and lights, is the landscape hero's job.
 *
 * Measured off a 900x920 render, not guessed:
 *   x 120  — clears the rail (0-72) with air, before the writing measure (150).
 *   width  — to 820, past the longest line's right edge (~805). Narrower and
 *            the crop slices words off the end of the sentence.
 *   top    — past the title block, landing just above the prose (235).
 */
const CARD_CROP = { x: 120, y: 186, width: 700 }

/**
 * The device y that must stay clear of the fade — the foot of `Learned`, the
 * fifth row of the Capture column.
 *
 * The palette runs to ~910 and its own list scrolls, so its last rows are
 * already cut off inside the app. Demanding all of it costs more scale than the
 * rows are worth; demanding the first five keeps every word that names what
 * this product captures — and, above them, the scripture block that shows what
 * picking one does — while the rest fades out as a list that continues.
 */
const CARD_CLEAR_TO = 795

/** Breathing room between the foot of the crop and the fade, in frame px. */
const FADE_CLEAR = 26

/**
 * Frame px each panel spends on things that are not panel: its label, the gap
 * under it, and the seam below. Subtracted before the stack is fitted.
 */
const PAIR_CHROME = 59

/**
 * THE DIPTYCH — the answer to the only question this image set could not
 * otherwise answer: *is this a journal?*
 *
 * The writing page says so on sight. Nothing else does. Rendered alone the
 * Ascent is a mountain and a quotation; the Altar is a list of names with
 * sentences under them; the Lamp is a lit grid. They are pictures of what the
 * writing BECOMES, and a stranger who has never seen the product has no way to
 * work backwards from an outcome to the thing that produced it. A feed gives
 * you one image and about a second, so they scroll.
 *
 * So no surface is ever shown alone. Every one of them appears under the page
 * that fed it, in one frame, in reading order — which turns the problem into
 * the product's own argument: you write, and later it reads it back to you.
 *
 * Crops are in each window's own device px, measured off a 900x920 render.
 */
const PANELS: Record<
  FlagshipSurface,
  { x: number; y: number; height: number; width?: number; winWidth?: number }
> = {
  // The sentence and the verse it reached for. Wide and SHORT, and that is the
  // governing constraint of the whole pair: two panels and a headline in a 4:5
  // leaves each panel about 220 frame px, so a tall crop is a small crop, and a
  // small crop of prose is a picture of text nobody can read. The title is cut
  // for the same reason — it costs 120pt and says "Tuesday".
  page: { x: 90, y: 200, height: 280 },
  // The foot of the mountain, the one line of the year, and its date. The
  // quoted, dated sentence is doing double duty: it is the surface's own
  // strongest moment AND the second journal signal in the frame.
  ascent: { x: 60, y: 210, height: 400 },
  // Starts under the "lately your prayers have circled around…" line, which
  // wraps to two at this width — cropped mid-wrap it opens on a stray surname.
  altar: { x: 105, y: 300, height: 380 },
  // The title is the hook here — "Where your heart has been leaning" — so
  // unusually the crop starts at the top of the surface.
  lamp: { x: 105, y: 30, height: 420 },
  /*
   * The wall is the one panel rendered in a WIDER window than the rest.
   *
   * Its claim is "ten years of them", and the wall lays pages out in columns
   * that fit the viewport: at 900pt it draws two, which is a picture of two
   * pages, not of a decade. At 1500 it draws four and the year rail down the
   * side starts to mean something. The crop is correspondingly wider, so this
   * panel's contents render smaller than its neighbour's — which is right. It
   * is the zoomed-out view.
   */
  wall: { x: 40, y: 26, width: 1420, height: 620, winWidth: 1500 },
  // The library portals over the whole viewport, so its own left margin is the
  // only gutter there is.
  rituals: { x: 20, y: 26, height: 420 },
}

const PANEL_WIDTH = 780


/**
 * How far past the well the window is allowed to run, as a share of the well's
 * width. The overrun is what makes the picture read as a window someone is
 * looking INTO rather than a picture OF a window: an object with air on all
 * four sides is an illustration.
 */
const OVERRUN = 0.3

/** macOS traffic lights, in order. Drawn, because the window is drawn. */
const LIGHTS = ['#ff5f57', '#febc2e', '#28c840']

/**
 * The mark is drawn in `var(--accent)`, defined inside a theme block on
 * `[data-theme]`. The frame carries no app palette on purpose, so without this
 * the sunrise renders transparent — an invisible logo, and the kind of failure
 * a headless capture will not report.
 */
const MARK_ACCENT = { '--accent': '#f3bd76' } as React.CSSProperties

export function FlagshipFrame({ cut, canvas, theme, frame }: Props) {
  const wellRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  const spec = CANVASES[canvas]
  const layout = spec.layout
  const fit = spec.fit
  const win = WINDOWS[WINDOW_FOR[canvas]]
  const light = isLightTheme(theme)

  useLayoutEffect(() => {
    const well = wellRef.current
    if (!well) return
    // Read the footer's height off the element rather than repeating the number
    // here: it is 86px on most canvases and 132 on a story, and the two places
    // that need it must not be able to disagree.
    const footer =
      parseFloat(getComputedStyle(well).getPropertyValue('--flag-footer-h')) || 86
    // Fit to what the caption actually left behind, rather than to a constant:
    // the caption is a fixed pixel height but the five canvases are not, so one
    // number cannot be right for all of them.
    if (layout === 'beside') {
      const byWidth = (well.clientWidth * (1 + OVERRUN)) / win.width
      // Fitted to height, the window may run off the right edge and nowhere
      // else: a titlebar with its lights cut off is a bug, and a page cut off
      // at the top has no beginning. Fitted to width it runs off the bottom
      // too, which is the only way a 630px-tall card holds an app at all.
      const byHeight = (well.clientHeight - spec.air * 2) / (win.height + TITLEBAR)
      // A bare cut is always fitted whole — see `Cut.canvases`. There is no
      // caption to trade room with, so an overrun buys nothing and costs the
      // subject of the picture.
      setScale(cut.bare || fit === 'height' ? Math.min(byWidth, byHeight) : byWidth)
    } else {
      // Stacked: as wide as the gutters allow, but never so wide that the fifth
      // row of the menu sinks into the fade. Height is the constraint the eye
      // notices and width is the one it does not, so width yields.
      if (cut.pair) {
        // The pair is fitted whole — nothing fades out, because a cropped
        // second panel would look like the frame ran out of room rather than
        // like a second thing worth seeing.
        // Each panel's DRAWN height: its crop height, scaled by how much its own
        // crop has to shrink to reach the shared panel width.
        const stack = cut.pair.reduce((h, [s]) => {
          const p = PANELS[s]
          return h + p.height * (PANEL_WIDTH / (p.width ?? PANEL_WIDTH))
        }, 0)
        const byWidth = (well.clientWidth - STACKED_GUTTER * 2) / PANEL_WIDTH
        const room = well.clientHeight - footer - PAIR_CHROME * cut.pair.length
        setScale(Math.min(byWidth, room / stack))
        return
      }
      const byWidth = (well.clientWidth - STACKED_GUTTER * 2) / CARD_CROP.width
      const room = well.clientHeight - footer - FADE_CLEAR
      const byPalette = room / (CARD_CLEAR_TO - CARD_CROP.y)
      setScale(Math.min(byWidth, byPalette))
    }
  }, [frame.width, frame.height, layout, fit, spec.air, cut.bare, cut.pair, win.width, win.height])

  const caption = cut.bare ? null : (
    <header className="flag__caption">
      {/*
        The break is hard, not balanced. At this size the two halves are a
        near-exact fit for the column, so auto-wrapping puts the break wherever
        the last word lands — "A journal built / for spiritual / growth." — and
        splitting "built for" reads as a typesetting accident. The lead is one
        line and the accent is the other, always.
      */}
      <h1 className="flag__headline">
        {cut.headline.lead}
        <br />
        <em>{cut.headline.accent}</em>
      </h1>
      <p className="flag__sub">{cut.sub}</p>
      <div className="flag__rule" aria-hidden />
    </header>
  )

  /*
   * The visible rectangle of the app, in the window's own device px. A
   * landscape canvas shows the whole window; a stacked one shows the crop.
   * `height` is deliberately generous on the stacked cut — the card runs off
   * the bottom of the frame under the fade, and a crop box cut to the clearance
   * line would end in a hard edge instead.
   */
  const view =
    layout === 'beside'
      ? { x: 0, y: 0, width: win.width, height: win.height }
      : { ...CARD_CROP, height: win.height - CARD_CROP.y }

  /**
   * Two panels, one above the other, each a crop of a real surface running in
   * its own iframe. Stacked rather than side by side even where there is width
   * for both: reading order is the argument — the page first, then what it
   * became — and side by side at feed sizes gives each panel half a column,
   * which is not enough to read either.
   */
  const diptych = (
    <div className="flag__well flag__well--pair" ref={wellRef}>
      {(cut.pair ?? []).map(([s, label], i) => {
        const panel = PANELS[s]
        // The panel is drawn at PANEL_WIDTH; a wider crop therefore renders at a
        // smaller scale of its own, inside the pair's shared scale.
        const inner = (PANEL_WIDTH / (panel.width ?? PANEL_WIDTH)) * scale
        return (
          <div className="flag__panel" key={s}>
            <span className="flag__panel-label">{label}</span>
            <div
              className="flag__window"
              {...(light ? { 'data-light': '' } : {})}
              style={{
                width: PANEL_WIDTH * scale,
                height: panel.height * inner,
                visibility: scale ? 'visible' : 'hidden',
              }}
            >
              <iframe
                className="flag__screen"
                title={s}
                src={`/?__preview=flagship&raw=1&theme=${theme}&surface=${s}`}
                width={panel.winWidth ?? win.width}
                height={win.height}
                style={{ transform: `scale(${inner}) translate(${-panel.x}px, ${-panel.y}px)` }}
                scrolling="no"
              />
            </div>
            {i === 0 ? <div className="flag__seam" aria-hidden /> : null}
          </div>
        )
      })}
    </div>
  )

  const window_ = (
    <div className="flag__well" ref={wellRef}>
      <div
        className="flag__window"
        {...(light ? { 'data-light': '' } : {})}
        style={{
          width: view.width * scale,
          // Nothing to show until the fit is measured; without this the window
          // paints once at full size and a fast capture catches it mid-layout.
          visibility: scale ? 'visible' : 'hidden',
        }}
      >
        {layout === 'beside' ? (
          <div className="flag__titlebar">
            {LIGHTS.map((c) => (
              <span key={c} className="flag__light" style={{ background: c }} />
            ))}
          </div>
        ) : null}
        <div className="flag__crop" style={{ height: view.height * scale }}>
          <iframe
            className="flag__screen"
            title="Dayspring"
            src={`/?__preview=flagship&raw=1&theme=${theme}`}
            width={win.width}
            height={win.height}
            /* Translate first, then scale: the crop's top-left corner is moved
               to the origin and the whole thing sized from there. */
            style={{ transform: `scale(${scale}) translate(${-view.x}px, ${-view.y}px)` }}
            scrolling="no"
          />
        </div>
      </div>
    </div>
  )

  return (
    <div
      className="flag"
      data-canvas={canvas}
      data-layout={layout}
      data-fit={fit}
      {...(cut.bare ? { 'data-bare': '' } : {})}
      style={{ width: frame.width, height: frame.height }}
    >
      <div className="flag__glow" aria-hidden />

      {layout === 'beside' ? (
        <div className="flag__row">
          {caption}
          {cut.pair ? diptych : window_}
        </div>
      ) : (
        <>
          {caption}
          {cut.pair ? diptych : window_}
        </>
      )}

      {/*
        Frame-anchored, so it lands correctly however far the window overruns —
        and rendered ONLY where there is an overrun to soften. Laid over a
        landscape window that fits, the same gradient is fog: it greys out the
        foot of a cream page for no reason, and then ends in a hard edge at the
        window's real bottom, which is the exact artefact it exists to prevent.
      */}
      {cut.bare || cut.pair || fit === 'height' ? null : <div className="flag__fade" aria-hidden />}
      <div className="flag__grain" aria-hidden />

      {/*
        The mark and the name, and nothing else.
        
        The bar used to close on "14-day free trial · no card · usedayspring.app"
        — three facts in a row of uppercase mono, which is a lot of reading to
        put at the foot of an image whose argument is the picture. Every one of
        them is a field Meta gives an ad of its own, set in the reader's own UI
        where they are read as terms rather than as decoration. Here they were
        only taking the room.
      */}
      {cut.bare ? null : (
        <footer className="flag__footer">
          <span className="flag__brand">
            <Mark size={24} style={MARK_ACCENT} />
            <span className="flag__wordmark">Dayspring</span>
          </span>
        </footer>
      )}
    </div>
  )
}
