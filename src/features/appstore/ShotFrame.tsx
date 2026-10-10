/**
 * The marketing frame around a shot: the sky, the caption, a device running off
 * the frame's foot, the one line of it lifted out, and the trail that climbs the
 * whole strip.
 *
 * The screen is an IFRAME, not a scaled sub-tree. `.scrim` (z40), `.drawer`
 * (z41), `.mobile-fab` (z45) and `.slash-palette` (z9000, portaled to
 * document.body) are all `position: fixed` — inside a CSS-scaled wrapper they
 * would resolve against the real viewport and render full-size outside the
 * phone. In an iframe, `position: fixed`, `100dvh`, `env(safe-area-*)` and body
 * portals all resolve against the iframe's own viewport, so the app lays out
 * exactly as it does on device; scaling the iframe element then takes the fixed
 * layers with it.
 *
 * Every geometry below is fixed per platform rather than measured, so the
 * device iframe and the pop-out's second copy of it lay out identically — the
 * pop-out finds its element in the copy and trusts the position for both.
 */

import { useEffect, useRef, useState } from 'react'
import { THEMES } from '@/lib/resolveTheme'
import { PANE_VIEWPORT } from './devices'
import { IPAD_VIEWPORT } from './ipad'
import { shotsFor, type Pop, type Shot } from './shots'
import './ShotFrame.css'

interface Props {
  shot: Shot
  /** The capture window, in CSS px — the frame's own canvas. */
  frame: { width: number; height: number }
  /** iPad frames are ~0.75 aspect against the phone's ~0.46, and hold the whole
   *  app rather than a chrome-less snippet. */
  platform: 'iphone' | 'ipad'
}

type Platform = Props['platform']

/**
 * The device, per platform. `app` is the viewport the app lays out against, in
 * points — 420 wide on a phone, so line breaks and touch targets are a real
 * phone's; 1024 on iPad, past the 767px switch, so the iPad gets its
 * three-column shell. Its height is a real screen's, less the status bar; the
 * frame's foot cuts the device off well before it ends.
 *
 * `share` is the device's width as a share of the frame's; `bezel`, `bar`
 * (status bar) and `radius` are in points of the app.
 */
const DEVICE = {
  iphone: { app: { width: 420, height: 902 }, share: 0.8, bezel: 9, bar: 54, radius: 54, island: true },
  ipad: { app: IPAD_VIEWPORT, share: 0.88, bezel: 16, bar: 26, radius: 20, island: false },
} as const

/** Frame px between the caption and the top of the device. */
const DEVICE_GAP = { iphone: 30, ipad: 40 }

function paperOf(shot: Shot): { paper: string; light: boolean } {
  const id = shot.theme ?? 'ink'
  const t = THEMES.find((x) => x.id === id)
  return { paper: t?.swatch.bg ?? '#14161d', light: id !== 'ink' && t?.family === 'light' }
}

export function ShotFrame({ shot, frame, platform }: Props) {
  // How far the sun is up, 0 → 1 across the set. Each frame's horizon is a
  // little warmer than the last, so swiping the gallery is first light coming
  // up — the name (Luke 1:78) and the promise, said without a word.
  const set = shotsFor(platform)
  const index = Math.max(0, set.findIndex((s) => s.id === shot.id))
  const dawn = set.length > 1 ? index / (set.length - 1) : 1

  return (
    <div
      className="shot"
      data-platform={platform}
      data-surface={shot.surface}
      style={{ width: frame.width, height: frame.height, ['--dawn' as string]: dawn }}
    >
      <div className="shot__glow" aria-hidden />
      <div className="shot__horizon" aria-hidden />
      <Trail index={index} count={set.length} width={frame.width} height={frame.height} />
      <div className="shot__grain" aria-hidden />

      {shot.quote ? (
        // The sunrise mark sits on the trail where it crosses the frame's middle.
        <Quote shot={shot} sunAt={trailY((index + 0.5) * frame.width, set.length, frame.width, frame.height)} />
      ) : (
        <>
          <header className="shot__caption">
            <span className="shot__eyebrow">{shot.eyebrow}</span>
            <h1 className="shot__headline">
              {shot.headline.lead} <em>{shot.headline.accent}</em>
            </h1>
            {shot.subcaption ? <p className="shot__sub">{shot.subcaption}</p> : null}
          </header>

          <div className="shot__stage">
            {shot.surface === 'devices' ? (
              <Devices shot={shot} available={frame.width - 26 * 2} />
            ) : (
              <Device shot={shot} platform={platform} frameWidth={frame.width} />
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** The device's size in the frame, and the scale its screen is drawn at. */
function geometry(platform: Platform, frameWidth: number) {
  const d = DEVICE[platform]
  const outer = Math.round(frameWidth * d.share)
  // Bezel and corners scale with the screen, so a 6.5" and a 6.9" export are
  // the same drawing at two sizes.
  const scale = outer / (d.app.width + d.bezel * 2)
  return { d, outer, scale, left: (frameWidth - outer) / 2, top: DEVICE_GAP[platform] }
}

function src(shot: Shot, platform: Platform) {
  return `/?__preview=${shot.id}&raw=1${platform === 'ipad' ? '&platform=ipad' : ''}`
}

/** The height the snippet lays out in, in app pt — the whole screen unless the
 *  shot asks for less (iPhone only; the iPad shows the whole shell). */
function appHeight(shot: Shot, platform: Platform): number {
  return platform === 'iphone' && shot.screen ? shot.screen : DEVICE[platform].app.height
}

function Device({ shot, platform, frameWidth }: { shot: Shot; platform: Platform; frameWidth: number }) {
  const { d, outer, scale, left, top } = geometry(platform, frameWidth)
  const h = appHeight(shot, platform)
  // The iPad shows the whole shell, so there is nothing to crop past.
  const crop = platform === 'ipad' ? 0 : (shot.cropTop ?? 0)
  const pad = platform === 'ipad' ? 0 : (shot.padTop ?? 0)
  const { paper, light } = paperOf(shot)

  return (
    <>
      <div
        className="shot__device"
        data-platform={platform}
        data-light={light ? 'true' : undefined}
        style={{
          left,
          top,
          width: outer,
          padding: d.bezel * scale,
          borderRadius: (d.radius + d.bezel) * scale,
        }}
      >
        <div
          className="shot__screen"
          style={{ background: paper, borderRadius: d.radius * scale, height: (d.bar + d.app.height) * scale }}
        >
          <StatusBar platform={platform} light={light} scale={scale} height={d.bar} island={d.island} />
          <div className="shot__window" style={{ top: (d.bar + pad) * scale, height: h * scale }}>
            <iframe
              className="shot__inner"
              title={shot.eyebrow}
              src={src(shot, platform)}
              width={d.app.width}
              height={h + crop}
              style={{ transform: `scale(${scale}) translateY(${-crop}px)` }}
              scrolling="no"
            />
          </div>
        </div>
      </div>
      {shot.pop ? (
        <PopOut
          shot={shot}
          pop={shot.pop}
          platform={platform}
          frameWidth={frameWidth}
          // Where a point of the app lands in the stage, so the lifted element
          // rises from exactly where it sits on the screen.
          toStage={(x, y) => ({
            x: left + (d.bezel + x) * scale,
            y: top + (d.bezel + d.bar + pad + y - crop) * scale,
          })}
          scale={scale}
          paper={paper}
          light={light}
        />
      ) : null}
    </>
  )
}

/** 9:41, as every App Store screenshot has it. Drawn, not photographed. */
function StatusBar({
  platform,
  light,
  scale,
  height,
  island,
}: {
  platform: Platform
  light: boolean
  scale: number
  height: number
  island: boolean
}) {
  const ink = light ? '#1d1a17' : '#f1ede6'
  const s = (n: number) => n * scale
  return (
    <div className="shot__bar" style={{ height: s(height), color: ink, padding: `0 ${s(platform === 'ipad' ? 22 : 34)}px` }}>
      <span style={{ fontSize: s(platform === 'ipad' ? 13 : 17), marginTop: s(platform === 'ipad' ? 0 : 4) }}>9:41</span>
      {island ? (
        <span
          className="shot__island"
          style={{ width: s(124), height: s(36), top: s(11), borderRadius: s(18) }}
        />
      ) : null}
      <svg
        width={s(platform === 'ipad' ? 64 : 76)}
        height={s(platform === 'ipad' ? 12 : 14)}
        viewBox="0 0 76 14"
        style={{ marginTop: s(platform === 'ipad' ? 0 : 4) }}
        aria-hidden
      >
        {/* signal */}
        <rect x="0" y="9" width="3.2" height="5" rx="1" fill={ink} />
        <rect x="5" y="6.5" width="3.2" height="7.5" rx="1" fill={ink} />
        <rect x="10" y="4" width="3.2" height="10" rx="1" fill={ink} />
        <rect x="15" y="1.5" width="3.2" height="12.5" rx="1" fill={ink} />
        {/* wifi */}
        <path d="M30.5 4.2a10 10 0 0 1 13 0" stroke={ink} strokeWidth="1.9" fill="none" strokeLinecap="round" />
        <path d="M33 7.2a6.2 6.2 0 0 1 8 0" stroke={ink} strokeWidth="1.9" fill="none" strokeLinecap="round" />
        <circle cx="37" cy="11.2" r="1.7" fill={ink} />
        {/* battery */}
        <rect x="50" y="1.5" width="22" height="11" rx="3.2" stroke={ink} strokeOpacity="0.45" strokeWidth="1.1" fill="none" />
        <rect x="52" y="3.5" width="18" height="7" rx="1.8" fill={ink} />
        <path d="M73.6 5.4v3.2" stroke={ink} strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  )
}

/**
 * The shot's one line, lifted off the screen and set over it larger.
 *
 * A second copy of the snippet loads behind a clip. Everything in it but the
 * chosen element is made invisible (visibility, not display, so nothing
 * reflows), and the copy is scaled and shifted so that element fills the card.
 * Because the copy and the device's screen are the same page at the same size,
 * the element's box in one is its box in the other — which is how the card can
 * rise from exactly the place on the screen it came from.
 */
function PopOut({
  shot,
  pop,
  platform,
  frameWidth,
  toStage,
  scale,
  paper,
  light,
}: {
  shot: Shot
  pop: Pop
  platform: Platform
  frameWidth: number
  toStage: (x: number, y: number) => { x: number; y: number }
  scale: number
  paper: string
  light: boolean
}) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [box, setBox] = useState<DOMRect | null>(null)
  const d = DEVICE[platform]
  const crop = platform === 'ipad' ? 0 : (shot.cropTop ?? 0)

  useEffect(() => {
    let tries = 0
    // Not the first sighting: the element has to have stopped moving. A surface
    // that scrolls itself into place after loading (the iPad year, down to its
    // threads) would otherwise be measured where it started, and the card would
    // rise from somewhere off the frame.
    let last = ''
    let still = 0
    const timer = window.setInterval(() => {
      const doc = ref.current?.contentDocument
      const el = doc
        ? [...doc.querySelectorAll<HTMLElement>(pop.select)].find(
            (e) => !pop.text || (e.textContent ?? '').includes(pop.text),
          )
        : undefined
      const rect = el?.getBoundingClientRect()
      const at = rect ? `${rect.left},${rect.top},${rect.width},${rect.height}` : ''
      still = at && at === last ? still + 1 : 0
      last = at
      if (doc && el && rect && rect.height > 0 && still >= 6) {
        el.setAttribute('data-shot-pop', '')
        const style = doc.createElement('style')
        style.textContent =
          'html, body { background: transparent !important; }' +
          ' body * { visibility: hidden !important; }' +
          ' [data-shot-pop], [data-shot-pop] * { visibility: visible !important; }'
        doc.head.appendChild(style)
        setBox(rect)
        window.clearInterval(timer)
      } else if (++tries > 200) window.clearInterval(timer)
    }, 100)
    return () => window.clearInterval(timer)
  }, [pop.select, pop.text])

  // Breathing room inside the card, in app points.
  const padX = platform === 'ipad' ? 18 : 14
  const padY = platform === 'ipad' ? 14 : 12
  let lift = scale * (pop.lift ?? 1.32)
  let w = 0
  let h = 0
  let x = 0
  let y = 0
  if (box) {
    // Never wider than the frame allows: overhanging the device is the point,
    // running off the frame is not.
    const maxW = frameWidth * (platform === 'ipad' ? 0.84 : 0.92)
    lift = Math.min(lift, maxW / (box.width + padX * 2))
    w = (box.width + padX * 2) * lift
    h = (box.height + padY * 2) * lift
    const at = toStage(box.left + box.width / 2, box.top + box.height / 2 + (pop.drop ?? 0))
    // Wide elements centre on the device; narrow ones rise from where they are.
    const cx = w > frameWidth * 0.62 ? frameWidth / 2 : at.x
    x = Math.min(Math.max(cx - w / 2, frameWidth * 0.04), frameWidth * 0.96 - w)
    y = at.y - h / 2
  }

  return (
    <div
      className="shot__pop"
      data-light={light ? 'true' : undefined}
      style={{
        left: x,
        top: y,
        width: w,
        height: h,
        background: paper,
        borderRadius: (platform === 'ipad' ? 14 : 16) * lift,
        visibility: box ? 'visible' : 'hidden',
      }}
    >
      <iframe
        ref={ref}
        className="shot__inner"
        title=""
        aria-hidden
        tabIndex={-1}
        src={src(shot, platform)}
        width={d.app.width}
        height={appHeight(shot, platform) + crop}
        style={{
          transform: box
            ? `scale(${lift}) translate(${padX - box.left}px, ${padY - box.top}px)`
            : undefined,
        }}
        scrolling="no"
      />
    </div>
  )
}

/**
 * One trail across the whole strip — the Ascent's own gold line, climbing from
 * the foot of the first frame to a lit summit at the edge of the last. Each frame
 * draws its slice of the same path, so where one screenshot ends the next picks
 * the line up at the same height: the continuation a reader's eye follows from
 * one to the next. It runs behind the devices, so a frame shows it in its
 * gutters, and whole where there is no device (the quote).
 */
/** The trail's height at strip-x `x` — one curve, shared by every frame. */
function trailY(x: number, count: number, width: number, height: number): number {
  const u = x / (width * count)
  // Rising, with a long switchback rhythm — a path, not a chart.
  return height * (0.985 - 0.6 * Math.pow(u, 0.92) + 0.022 * Math.sin(u * Math.PI * count * 0.62))
}

function Trail({ index, count, width, height }: { index: number; count: number; width: number; height: number }) {
  const total = width * count
  const yAt = (x: number) => trailY(x, count, width, height)
  const from = index * width - 24
  const to = (index + 1) * width + 24
  const pts: string[] = []
  for (let x = from; x <= to; x += 6) pts.push(`${x.toFixed(1)},${yAt(x).toFixed(1)}`)
  // A stone in a gutter of each frame, as the climb sets stones along its trail;
  // the last frame ends on the summit.
  const stones = Array.from({ length: count }, (_, i) => i * width + width * (i % 2 ? 0.94 : 0.06))
  const summit = total - width * 0.06
  return (
    <svg
      className="shot__trail"
      viewBox={`${index * width} 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
    >
      <defs>
        <linearGradient id="trail-ink" x1="0" x2={total} y1="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c56a6e" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#e8917c" stopOpacity="0.8" />
          <stop offset="1" stopColor="#f3bd76" stopOpacity="1" />
        </linearGradient>
      </defs>
      <polyline points={pts.join(' ')} fill="none" stroke="url(#trail-ink)" strokeWidth={width * 0.0045} strokeLinecap="round" />
      {stones
        .filter((x) => x > from && x < to && x < summit - width * 0.2)
        .map((x) => (
          <circle key={x} cx={x} cy={yAt(x)} r={width * 0.0085} fill="#f3bd76" fillOpacity="0.9" />
        ))}
      {summit > from && summit < to ? (
        <g>
          <circle cx={summit} cy={yAt(summit)} r={width * 0.05} fill="#f3bd76" fillOpacity="0.16" />
          <circle cx={summit} cy={yAt(summit)} r={width * 0.022} fill="#f3bd76" fillOpacity="0.35" />
          <circle cx={summit} cy={yAt(summit)} r={width * 0.011} fill="#fbe2b4" />
        </g>
      ) : null}
    </svg>
  )
}

/** The beta's voice, as large as a headline: the one frame with no screen. */
function Quote({ shot, sunAt }: { shot: Shot; sunAt: number }) {
  const q = shot.quote!
  // The turn of the sentence carries the gradient, the way every headline's
  // second half does.
  const [lead, accent] = q.text.includes(' — ') ? q.text.split(' — ') : [q.text, '']
  return (
    <figure className="shot__quote">
      <span className="shot__eyebrow">{shot.eyebrow}</span>
      <span className="shot__quote-mark" aria-hidden>
        “
      </span>
      <blockquote className="shot__quote-text">
        {lead}
        {accent ? (
          <>
            {' — '}
            <em>{accent}</em>
          </>
        ) : null}
      </blockquote>
      <figcaption className="shot__quote-by">
        <span>— {q.attribution}</span>
        <span className="shot__quote-on">{q.context}</span>
      </figcaption>
      {/* The mark's horizon line is at y=17 of 24: set it on the trail. */}
      <svg className="shot__quote-sun" viewBox="0 0 24 24" style={{ top: sunAt }} aria-hidden>
        <path d="M5 17a7 7 0 0 1 14 0" fill="#f3bd76" />
        <g stroke="#f3bd76" strokeWidth="1.6" strokeLinecap="round">
          <path d="M12 3v3" />
          <path d="M4.4 7.4l2.1 2.1" />
          <path d="M19.6 7.4l-2.1 2.1" />
          <path d="M2.5 17h19" />
        </g>
      </svg>
    </figure>
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
