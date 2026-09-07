/**
 * The marketing frame around a shot: dawn glow, caption band, and the phone
 * screen itself.
 *
 * The screen is an IFRAME, not a scaled sub-tree. `.scrim` (z40), `.drawer`
 * (z41), `.mobile-fab` (z45) and `.slash-palette` (z9000, portaled to
 * document.body) are all `position: fixed` — inside a CSS-scaled wrapper they
 * would resolve against the real viewport and render full-size outside the
 * phone. In an iframe, `position: fixed`, `100dvh`, `env(safe-area-*)` and body
 * portals all resolve against the iframe's own viewport, so the app lays out
 * exactly as it does on device; scaling the iframe element then takes the fixed
 * layers with it.
 */

import { useLayoutEffect, useRef, useState } from 'react'
import { THEMES } from '@/lib/resolveTheme'
import { PANE_VIEWPORT } from './devices'
import { IPAD_VIEWPORT } from './ipad'
import type { Shot } from './shots'
import './ShotFrame.css'

interface Props {
  shot: Shot
  /** The capture window, in CSS px — the frame's own canvas. */
  frame: { width: number; height: number }
  /** iPad frames are ~0.75 aspect against the phone's ~0.46, so the caption and
   *  the card have to re-proportion; the card also holds the whole app rather
   *  than a chrome-less snippet. */
  platform: 'iphone' | 'ipad'
}

/**
 * The snippet card's own viewport, in CSS points.
 *
 * Deliberately NOT the frame's 642pt: the app lays out against this, and at
 * phone-width points it breaks lines, sizes touch targets and widths the entry
 * list the way it does on a real device. Kept identical across all five shots so
 * the cards are the same shape and the gallery reads as one strip.
 */
const CARD = { width: 420, height: 700 }

/** Minimum gutter either side of the card. */
const GUTTER = 52

export function ShotFrame({ shot, frame, platform }: Props) {
  const wellRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  // Fit to whatever the caption left behind rather than trusting a hand-tuned
  // constant — the caption is a fixed pixel height but the two export sizes are
  // not, so one number cannot be right for both.
  const card = platform === 'ipad' ? IPAD_VIEWPORT : CARD
  const gutter = platform === 'ipad' ? 56 : GUTTER

  useLayoutEffect(() => {
    const well = wellRef.current
    if (!well) return
    const byHeight = well.clientHeight / card.height
    const byWidth = (frame.width - gutter * 2) / card.width
    setScale(Math.min(byHeight, byWidth))
  }, [frame.width, card.height, card.width, gutter])

  const crop = platform === 'ipad' ? 0 : (shot.cropTop ?? 0)
  // Real blank space, not "crop less" — cropping less just reveals whatever sits
  // above (on the Lamp, the descenders of its own title). The iframe is pushed
  // down inside the card and the card's own background fills the gap.
  const pad = platform === 'ipad' ? 0 : (shot.padTop ?? 0)
  // Match the card to the palette inside it, so there's no wrong-coloured flash
  // behind a booting iframe and the fade blends instead of banding.
  const themeId = shot.theme ?? 'ink'
  const paper = THEMES.find((t) => t.id === themeId)?.swatch.bg ?? '#14161d'
  const light = themeId !== 'ink' && THEMES.find((t) => t.id === themeId)?.family === 'light'

  return (
    <div className="shot" data-platform={platform} style={{ width: frame.width, height: frame.height }}>
      <div className="shot__glow" aria-hidden />
      <div className="shot__grain" aria-hidden />

      <header className="shot__caption">
        <span className="shot__eyebrow">{shot.eyebrow}</span>
        <h1 className="shot__headline">
          {shot.headline.lead} <em>{shot.headline.accent}</em>
        </h1>
        {shot.subcaption ? <p className="shot__sub">{shot.subcaption}</p> : null}
        <div className="shot__rule" aria-hidden />
      </header>

      <div className="shot__well" ref={wellRef}>
        {shot.surface === 'devices' ? (
          <Devices shot={shot} available={frame.width - 26 * 2} />
        ) : (
        <div
          className="shot__card"
          data-fade={shot.fadeBottom === false ? undefined : 'true'}
          data-light={light ? 'true' : undefined}
          style={{
            background: paper,
            width: card.width * scale,
            height: card.height * scale,
            borderRadius: (platform === 'ipad' ? 22 : 30) * scale,
            paddingTop: pad * scale,
            // Nothing to show until the fit is measured; without this the card
            // paints once at full size and a fast capture can catch it.
            visibility: scale ? 'visible' : 'hidden',
          }}
        >
          <iframe
            className="shot__inner"
            title={shot.eyebrow}
            src={`/?__preview=${shot.id}&raw=1${platform === 'ipad' ? '&platform=ipad' : ''}`}
            width={card.width}
            // Taller than the card by the crop and the pad, so after shifting up
            // and being pushed down it still reaches the bottom edge.
            height={card.height + crop + pad}
            style={{ transform: `scale(${scale}) translateY(${-crop}px)` }}
            scrolling="no"
          />
        </div>
        )}
      </div>
    </div>
  )
}

/**
 * The cross-device composite — the one shot that is not a single card.
 *
 * Both panes are real layouts, not mock-ups: which one you get is decided purely
 * by the iframe's width against `useIsMobile()`'s 767px breakpoint. The desktop
 * pane is deliberately the larger of the two and the phone overlaps its lower
 * corner, which is the conventional way to read "the same thing, in both places"
 * at a glance. Legibility is not the job here — recognition is; the caption
 * carries the meaning.
 */
function Devices({ shot, available }: { shot: Shot; available: number }) {
  const D = PANE_VIEWPORT.desktop
  const P = PANE_VIEWPORT.phone
  const ds = available / D.width
  // The phone is rendered at a larger scale than the desktop — shown to true
  // relative size beside a 1280pt window it would be a thumbnail. Overstating it
  // is the convention in device composites.
  const ps = ds * 1.28

  const dw = D.width * ds
  const dh = D.height * ds
  const pw = P.width * ps
  const ph = P.height * ps

  // Overlap only the desktop's bottom-right corner. A deeper overlap buries the
  // canvas, and the canvas is the half that proves it's the same app — an entries
  // panel on its own could be any list.
  const phoneTop = dh - ph * 0.28

  return (
    <div className="shot__stack" style={{ width: dw }}>
      <div className="shot__devices" style={{ width: dw, height: phoneTop + ph }}>
        <div className="shot__card shot__card--desktop" style={{ width: dw, height: dh }}>
          <iframe
            className="shot__inner"
            title="Dayspring on the desktop"
            src={`/?__preview=${shot.id}&raw=1&pane=desktop`}
            width={D.width}
            height={D.height}
            style={{ transform: `scale(${ds})` }}
            scrolling="no"
          />
        </div>
        <div
          className="shot__card shot__card--phone"
          style={{ width: pw, height: ph, right: -14, top: phoneTop }}
        >
          <iframe
            className="shot__inner"
            title="Dayspring on iPhone"
            src={`/?__preview=${shot.id}&raw=1&pane=phone`}
            width={P.width}
            height={P.height}
            style={{ transform: `scale(${ps})` }}
            scrolling="no"
          />
        </div>
        {/*
          The one shot that earns a list. Every other frame answers "what is
          this?", where a list would be noise; this one answers "will it fit how
          I live?", which is practical and wants facts.

          It runs down the L-shaped gap the composition creates — a landscape
          window above a portrait phone always leaves the lower-left empty — so
          the column is filled by design rather than the frame carrying a hole.
          Six items is what it takes to reach the phone's lower edge; every one
          is a capability that actually ships (the outbox in `lib/db.ts` and the
          service worker are what make the offline line true).
        */}
        <ul className="shot__specs" style={{ width: dw - pw - 30, top: dh + 24 }}>
          <li>
            <b>On the Mac</b> — a full-screen writing desk, every entry beside it
          </li>
          <li>
            <b>On iPhone</b> — speak, and it writes down what you said
          </li>
          <li>
            <b>On the web</b> — nothing to install
          </li>
          <li>
            <b>Synced</b> — the moment you stop typing
          </li>
          <li>
            <b>Offline</b> — write with no signal; it catches up
          </li>
          <li>
            <b>Yours to keep</b> — export it all as plain markdown
          </li>
        </ul>
      </div>
    </div>
  )
}
