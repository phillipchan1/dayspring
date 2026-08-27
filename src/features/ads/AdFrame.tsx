/**
 * The ad frame: dawn glow, caption, the body (a real surface, type alone, or a
 * pair of dated lines), and the brand-and-offer footer every ad carries.
 *
 * The card is an IFRAME, not a scaled sub-tree — the same reason ShotFrame gives
 * and it has not changed: `.scrim` (z40), `.drawer` (z41), `.mobile-fab` (z45)
 * and `.slash-palette` (z9000, portaled to document.body) are all
 * `position: fixed`, and inside a CSS-scaled wrapper they resolve against the
 * real viewport and render full-size OUTSIDE the card. In an iframe,
 * `position: fixed`, `100dvh`, `env(safe-area-*)` and body portals all resolve
 * against the iframe's own viewport, so the app lays out exactly as it does on
 * device; scaling the iframe element then takes the fixed layers with it.
 */

import { useLayoutEffect, useRef, useState } from "react";
import { Mark } from "@/components/Mark";
import { THEMES } from "@/lib/resolveTheme";
import type { Ad, AdRatio } from "./ads";
import "./AdFrame.css";

interface Props {
  ad: Ad;
  ratio: AdRatio;
  /** The capture window, in CSS px — the frame's own canvas. */
  frame: { width: number; height: number };
}

/**
 * The card's own viewport, in CSS points.
 *
 * Deliberately NOT the frame's width: the app lays out against this, and at
 * phone-width points it breaks lines, sizes touch targets, and widths its
 * panels the way it does on a real device. 420 is what the listing shots use,
 * and holding the two systems to the same number means a surface that has been
 * checked in one is correct in the other.
 */
const CARD = { width: 420, height: 700 };

/**
 * The device viewport, in CSS points, when an ad is presented as a phone.
 *
 * Taller than CARD and deliberately so: 420x700 is a crop, and cropped to that
 * ratio a phone shell is a stubby rectangle nobody reads as a phone. 420x860 is
 * the same viewport `PANE_VIEWPORT.phone` uses for the cross-device listing
 * shot, and its 0.49 aspect sits close enough to a real handset that the
 * silhouette is recognised before the screen is.
 */
const PHONE = { width: 420, height: 860 };

/**
 * Bezel thickness in device points, scaled with everything else.
 *
 * Thin enough to read as a modern phone; thick enough that the screen's corner
 * radius has something to sit inside. The screen radius is derived rather than
 * declared — concentric corners are what separates a device from a rectangle
 * with rounded ends, and getting it wrong is the tell.
 */
const BEZEL = 11;
const PHONE_RADIUS = 52;

/** Minimum gutter either side of the card. */
const GUTTER = 46;

/**
 * The mark is drawn in `var(--accent)`, which is defined inside a theme block on
 * `[data-theme]`. The ad frame carries no app palette on purpose (see
 * AdFrame.css), so without this the sunrise renders as `transparent` — an
 * invisible logo, and the kind of failure a headless capture will not report.
 */
const MARK_ACCENT = { "--accent": "#f3bd76" } as React.CSSProperties;

export function AdFrame({ ad, ratio, frame }: Props) {
  const wellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const phone = ad.presentation === "phone";
  const beside = ad.composition === "beside" && ratio !== "9x16";
  const screen = phone ? PHONE : CARD;

  useLayoutEffect(() => {
    const well = wellRef.current;
    if (!well) return;
    // Fit to whatever the caption left behind rather than to a hand-tuned
    // constant: the caption is a fixed pixel height but the three ratios are
    // not, so one number cannot be right for all of them.
    //
    // Unlike a listing card this one is allowed to overrun the well and bleed
    // off the bottom edge — an ad has half the height and a card scaled to fit
    // inside it is a thumbnail. Width is the binding constraint, and the fade
    // plus the footer turn the overrun into depth.
    //
    // A phone is measured on its OUTER edge — bezel included — or the shell
    // grows past the gutter it was fitted to and the device loses its margin.
    const outer = phone ? screen.width + BEZEL * 2 : screen.width;
    const byWidth = (well.clientWidth - GUTTER * 2) / outer;
    // Beside, the device has a column to itself and should simply fill it; the
    // overrun trick exists to stop a full-width card becoming a thumbnail in a
    // short frame, and there is no such pressure in a narrow column.
    const byHeight = beside
      ? Infinity
      : (well.clientHeight * 1.34) / screen.height;
    setScale(Math.min(byHeight, byWidth));
  }, [frame.width, frame.height, phone, beside, screen.width, screen.height]);

  const crop = ad.cropTop ?? 0;
  // Real blank space, not "crop less" — cropping less just reveals whatever sits
  // above. The iframe is pushed down inside the card and the card's own
  // background fills the gap.
  const pad = ad.padTop ?? 0;
  // Match the card to the palette inside it, so there is no wrong-coloured flash
  // behind a booting iframe and the fade blends instead of banding.
  const themeId = ad.theme ?? "ink";
  const themeDef = THEMES.find((t) => t.id === themeId);
  const paper = themeDef?.swatch.bg ?? "#14161d";
  const light = themeDef?.family === "light";

  const caption = (
    <header className="ad__caption">
      <span className="ad__eyebrow">{ad.eyebrow}</span>
      {/*
          The refusals sit ABOVE the headline, not below it. They are the setup —
          four things the reader already knows this category does — and the
          headline is the turn. Reversed, the ad answers a question nobody has
          been asked yet.
        */}
      {ad.layout === "typographic" && ad.struck?.length ? (
        <ul className="ad__struck">
          {ad.struck.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <h1 className="ad__headline">
        {ad.headline.lead}
        {ad.headline.hardBreak ? <br /> : " "}
        <em>{ad.headline.accent}</em>
      </h1>
      {ad.subcaption ? <p className="ad__sub">{ad.subcaption}</p> : null}
      {ad.layout === "surface" && !beside ? (
        <div className="ad__rule" aria-hidden />
      ) : null}
    </header>
  );

  const body =
    ad.layout === "pair" && ad.pair ? (
      <Pair pair={ad.pair} />
    ) : ad.layout === "surface" ? (
      <div className="ad__well" ref={wellRef}>
        <Screen
          ad={ad}
          phone={phone}
          screen={screen}
          scale={scale}
          paper={paper}
          light={light}
          crop={crop}
          pad={pad}
        />
      </div>
    ) : null;

  return (
    <div
      className="ad"
      data-ratio={ratio}
      data-layout={ad.layout}
      data-composition={beside ? "beside" : "stacked"}
      data-presentation={phone ? "phone" : "card"}
      style={{ width: frame.width, height: frame.height }}
    >
      <div className="ad__glow" aria-hidden />

      {/*
        Beside puts the words and the device in a row; stacked keeps them in the
        frame's own column. The two halves are the same nodes either way, so a
        composition change is a wrapper, never a second render path.
      */}
      {beside ? (
        <div className="ad__row">
          {caption}
          {body}
        </div>
      ) : (
        <>
          {caption}
          {body}
        </>
      )}

      {/* Frame-anchored, so it lands correctly however far the device overruns. */}
      {ad.layout === "surface" ? (
        <div className="ad__fade" aria-hidden />
      ) : null}
      <div className="ad__grain" aria-hidden />

      <footer className="ad__footer">
        <span className="ad__brand">
          <Mark size={22} style={MARK_ACCENT} />
          <span className="ad__wordmark">Dayspring</span>
        </span>
        <span className="ad__offer">{ad.offer}</span>
      </footer>
    </div>
  );
}

/**
 * The app, either in a plain card or inside a device shell.
 *
 * The pixels are identical in both — the same dev-only route in the same
 * same-origin iframe. Only the thing around them changes.
 *
 * The shell's corners are concentric: the screen's radius is the phone's minus
 * the bezel, so the two curves stay parallel the whole way round. Getting that
 * wrong is the single clearest tell that a device frame was drawn rather than
 * photographed, and it is why BEZEL and PHONE_RADIUS are constants rather than
 * two numbers picked to look right at one size.
 */
function Screen({
  ad,
  phone,
  screen,
  scale,
  paper,
  light,
  crop,
  pad,
}: {
  ad: Ad;
  phone: boolean;
  screen: { width: number; height: number };
  scale: number;
  paper: string;
  light: boolean;
  crop: number;
  pad: number;
}) {
  const inner = (
    <iframe
      className="ad__inner"
      title={ad.eyebrow}
      src={`/?__preview=${ad.id}&raw=1`}
      width={screen.width}
      // Taller than the screen by the crop and the pad, so after shifting up and
      // being pushed down it still reaches the bottom edge.
      height={screen.height + crop + pad}
      style={{ transform: `scale(${scale}) translateY(${-crop}px)` }}
      scrolling="no"
    />
  );

  // Nothing to show until the fit is measured; without this the screen paints
  // once at full size and a fast capture can catch it mid-layout.
  const hidden = {
    visibility: scale ? ("visible" as const) : ("hidden" as const),
  };

  if (!phone) {
    return (
      <div
        className="ad__card"
        data-light={light ? "true" : undefined}
        style={{
          background: paper,
          width: screen.width * scale,
          height: screen.height * scale,
          borderRadius: 30 * scale,
          paddingTop: pad * scale,
          ...hidden,
        }}
      >
        {inner}
      </div>
    );
  }

  return (
    <div
      className="ad__phone"
      style={{
        width: (screen.width + BEZEL * 2) * scale,
        height: (screen.height + BEZEL * 2) * scale,
        borderRadius: PHONE_RADIUS * scale,
        padding: BEZEL * scale,
        ...hidden,
      }}
    >
      {/* The rail's catch-light. One hairline, inside the bezel. */}
      <span className="ad__phone-rail" aria-hidden />
      <span className="ad__phone-btn" data-side="left" data-n="1" aria-hidden />
      <span className="ad__phone-btn" data-side="left" data-n="2" aria-hidden />
      <span className="ad__phone-btn" data-side="right" aria-hidden />
      <div
        className="ad__phone-screen"
        data-light={light ? "true" : undefined}
        style={{
          background: paper,
          borderRadius: (PHONE_RADIUS - BEZEL) * scale,
          paddingTop: pad * scale,
        }}
      >
        {inner}
      </div>
    </div>
  );
}

/**
 * D2's composition — the asking, the months, and the noticing.
 *
 * This is the one ad that is not a screenshot, and it must not be mistaken for
 * one: the app has no screen shaped like this. What it renders is the *claim* —
 * that Dayspring puts two of your own lines back in front of each other, which
 * is what the Altar's strands do — and `note` says outright that both lines are
 * the reader's own and neither was written by us. That sentence is load-bearing.
 * An ad that let someone believe the app authored either line would be selling
 * the exact opposite of Principle 4.
 */
function Pair({ pair }: { pair: NonNullable<Ad["pair"]> }) {
  const [first, second] = pair.entries;
  return (
    <div className="ad__pair">
      {first ? <Entry {...first} /> : null}
      <div className="ad__thread" aria-hidden>
        <span>five months, unnoticed</span>
      </div>
      {second ? <Entry {...second} /> : null}
      <p className="ad__pair-note">{pair.note}</p>
    </div>
  );
}

function Entry({ date, line }: { date: string; line: string }) {
  return (
    <div className="ad__entry">
      <span className="ad__entry-date">{date}</span>
      <p className="ad__entry-line">&ldquo;{line}&rdquo;</p>
    </div>
  );
}
