// ============================================================
// Ad template — turns one variant + one format + one theme into a
// standalone HTML page sized to the exact pixel.
//
// Everything here is lifted from site/src/styles/global.css and the
// site's own mock components. Two rules carried over deliberately:
//
//   1. NO SCREENSHOTS. Every product fragment below is hand-built in
//      the site's visual language, the same choice site/ already made
//      (see the audit, §04) — it keeps the creative from drifting out
//      of sync with whatever theme a user runs, and it means no real
//      journal content can ever leak into a public asset.
//   2. Sample content is fabricated and generic. Never a real entry.
// ============================================================

import { FORMATS, SAFE_ZONE_9x16 } from './variants.mjs';

/** Sampled from global.css — the two faces of the brand. */
const THEMES = {
  ink: {
    bg: '#0c0d11',
    surface: 'rgba(18, 19, 25, 0.5)',
    paper: '#ece7dd',
    dim: '#b7b3ab',
    muted: '#7a7986',
    accent: '#e8917c',
    gold: '#e4ba7c',
    border: 'rgba(236, 231, 221, 0.09)',
    borderStrong: 'rgba(236, 231, 221, 0.18)',
    grain: 0.055,
    veilFade: 'rgba(12, 13, 17, 0.35)',
    glow: [
      'rgba(243, 189, 118, 0.58)',
      'rgba(232, 145, 124, 0.34)',
      'rgba(197, 106, 110, 0.14)',
      'rgba(197, 106, 110, 0)',
    ],
  },
  dawn: {
    bg: '#f1ebdf',
    surface: 'rgba(255, 255, 255, 0.62)',
    paper: '#2c2820',
    dim: '#6a6254',
    muted: '#98917f',
    accent: '#c0695a',
    gold: '#b27d31',
    border: 'rgba(60, 50, 30, 0.13)',
    borderStrong: 'rgba(60, 50, 30, 0.22)',
    grain: 0.03,
    veilFade: 'rgba(241, 235, 223, 0.40)',
    glow: [
      'rgba(224, 166, 78, 0.55)',
      'rgba(192, 105, 90, 0.32)',
      'rgba(169, 79, 84, 0.12)',
      'rgba(169, 79, 84, 0)',
    ],
  },
};

/**
 * Type scale per canvas. A 9:16 is held further from the eye in a
 * Story, so it gets the largest type, not the smallest.
 */
const SCALE = {
  '1x1': { head: 76, kicker: 19, sub: 29, pad: 84, gap: 30 },
  '4x5': { head: 82, kicker: 20, sub: 31, pad: 90, gap: 34 },
  '9x16': { head: 88, kicker: 21, sub: 32, pad: 92, gap: 38 },
};

const esc = (s) =>
  String(s).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, '&amp;').replace(/</g, '').replace(/(\/?(em|br|strong)\b[^>]*)>/g, '<$1>').replace(//g, '&lt;');

/** The Dayspring sunrise mark, from site/src/components/Mark.astro. */
const mark = (size, color) => `
<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" style="flex-shrink:0">
  <path d="M5 17a7 7 0 0 1 14 0" fill="${color}"/>
  <g stroke="${color}" stroke-width="1.6" stroke-linecap="round">
    <path d="M12 3v3"/><path d="M4.4 7.4l2.1 2.1"/>
    <path d="M19.6 7.4l-2.1 2.1"/><path d="M2.5 17h19"/>
  </g>
</svg>`;

// ---- proof fragments -------------------------------------------------
// Each is a small, hand-built piece of the product's visual language.
// They are evidence, not the hook — they always sit below the headline.

const card = (t, inner, pad = 34) => `
<div style="background:${t.surface};border:1px solid ${t.border};border-radius:14px;
     padding:${pad}px;backdrop-filter:blur(8px)">${inner}</div>`;

const monoLabel = (t, text, color) => `
<span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:17px;
      letter-spacing:0.13em;text-transform:uppercase;color:${color || t.muted}">${text}</span>`;

const VISUALS = {
  none: () => '',

  editor: (t) =>
    card(
      t,
      `<div style="display:flex;flex-direction:column;gap:22px">
        ${monoLabel(t, 'march 14 &middot; 112 words &middot; saved')}
        <p style="font-family:'DS Body',Georgia,serif;font-size:31px;line-height:1.5;color:${t.paper};margin:0">
          I&rsquo;ve been praying about patience for months now.<span style="color:${t.accent}">|</span>
        </p>
        <div style="display:flex;flex-direction:column;gap:2px;border:1px solid ${t.border};
             border-radius:10px;overflow:hidden">
          ${[
            ['/scripture', 'Find relevant Bible passages', true],
            ['/pray', 'Log a prayer', false],
            ['/ritual', 'Rituals for the inner life', false],
          ]
            .map(
              ([cmd, hint, on]) => `
            <div style="display:flex;gap:20px;align-items:baseline;padding:16px 22px;
                 background:${on ? 'rgba(232,145,124,0.10)' : 'transparent'}">
              <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:21px;
                    color:${on ? t.accent : t.dim};min-width:180px">${cmd}</span>
              <span style="font-family:'DS Body',Georgia,serif;font-size:21px;color:${t.muted}">${hint}</span>
            </div>`,
            )
            .join('')}
        </div>
      </div>`,
    ),

  spines: (t) =>
    card(
      t,
      `<div style="display:flex;flex-direction:column;gap:20px">
        ${[
          ['2016 &middot; mar 3', 'the week everything changed at work', 0.3],
          ['2019 &middot; jul 19', 'asked again for the same thing', 0.42],
          ['2022 &middot; nov 2', 'still waiting, still writing', 0.55],
          ['2025 &middot; sep 8', 'I think this was the answer', 1],
        ]
          .map(
            ([date, frag, op], i, arr) => `
          <div style="display:flex;gap:26px;align-items:baseline;opacity:${op}">
            <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:19px;
                  letter-spacing:0.06em;color:${i === arr.length - 1 ? t.gold : t.muted};
                  min-width:200px">${date}</span>
            <span style="font-family:'DS Body',Georgia,serif;font-size:24px;color:${t.paper};
                  flex:1">${frag}</span>
          </div>`,
          )
          .join('')}
      </div>`,
    ),

  rollup: (t) =>
    card(
      t,
      `<div style="display:flex;flex-direction:column;gap:20px">
        ${monoLabel(t, 'looking back &middot; this year', t.gold)}
        <p style="font-family:'DS Body',Georgia,serif;font-size:30px;line-height:1.48;
           color:${t.paper};margin:0">
          You asked for patience in March. By September you had stopped counting.
        </p>
        <div style="display:flex;gap:12px;align-items:center;padding-top:6px;
             border-top:1px solid ${t.border}">
          ${monoLabel(t, '&#8627; quoted from your own entries')}
        </div>
      </div>`,
    ),

  shelf: (t) => `
    <div style="display:flex;flex-direction:column;gap:16px">
      ${[
        ['The Daily Examen', 'Ignatian &middot; evening'],
        ['Lectio Divina', 'Benedictine &middot; morning'],
        ['Psalmic Lament', 'Hebrew &middot; anytime'],
      ]
        .map(
          ([name, meta]) => `
        <div style="display:flex;justify-content:space-between;align-items:baseline;
             background:${t.surface};border:1px solid ${t.border};border-radius:12px;
             padding:24px 30px">
          <span style="font-family:'DS Display',Georgia,serif;font-size:32px;color:${t.paper}">${name}</span>
          ${monoLabel(t, meta)}
        </div>`,
        )
        .join('')}
    </div>`,

  // `chips` is overridable because the policy-safe twin of this concept must
  // not carry a second-person religious phrase in the artwork either.
  refusals: (t, opts = {}) => `
    <div style="display:flex;flex-wrap:wrap;gap:16px">
      ${(opts.chips ?? ['Streaks', 'Badges', 'Scores', 'Guilt notifications', 'A grade for your faith'])
        .map(
          (word) => `
        <span style="font-family:'DS Body',Georgia,serif;font-size:27px;color:${t.muted};
              border:1px solid ${t.border};border-radius:100px;padding:14px 28px;
              text-decoration:line-through;text-decoration-color:${t.accent};
              text-decoration-thickness:2px">${word}</span>`,
        )
        .join('')}
    </div>`,

  cite: (t) =>
    card(
      t,
      `<div style="display:flex;flex-direction:column;gap:18px">
        <p style="font-family:'DS Body',Georgia,serif;font-style:italic;font-size:31px;
           line-height:1.45;color:${t.paper};margin:0">
          &ldquo;&hellip;I have stopped counting the days.&rdquo;
        </p>
        <div style="display:flex;flex-direction:column;gap:8px;padding-top:16px;
             border-top:1px solid ${t.border}">
          ${monoLabel(t, '&#8627; your entry, 8 september', t.gold)}
          ${monoLabel(t, 'facts computed in code &middot; quotes verbatim')}
        </div>
      </div>`,
    ),

  import: (t) =>
    card(
      t,
      `<div style="display:flex;flex-direction:column;gap:18px">
        ${['Day One', 'Diarly', 'Markdown']
          .map(
            (src) => `
          <div style="display:flex;gap:22px;align-items:center">
            <span style="font-family:'DS Display',Georgia,serif;font-size:29px;
                  color:${t.paper};min-width:230px">${src}</span>
            <span style="color:${t.accent};font-size:26px">&rarr;</span>
            ${monoLabel(t, 'dates intact &middot; no duplicates')}
          </div>`,
          )
          .join('')}
      </div>`,
    ),
};

/** The six brand faces, loaded from disk so exports carry real Fraunces. */
const fontCss = (fontDir) => `
  @font-face { font-family:'DS Display'; src:url('${fontDir}/fraunces-400.woff2') format('woff2');
               font-weight:400; font-style:normal; font-display:block; }
  @font-face { font-family:'DS Display'; src:url('${fontDir}/fraunces-500.woff2') format('woff2');
               font-weight:500; font-style:normal; font-display:block; }
  @font-face { font-family:'DS Display'; src:url('${fontDir}/fraunces-300-italic.woff2') format('woff2');
               font-weight:400; font-style:italic; font-display:block; }
  @font-face { font-family:'DS Body'; src:url('${fontDir}/newsreader-400.woff2') format('woff2');
               font-weight:400; font-style:normal; font-display:block; }
  @font-face { font-family:'DS Body'; src:url('${fontDir}/newsreader-300-italic.woff2') format('woff2');
               font-weight:400; font-style:italic; font-display:block; }
  @font-face { font-family:'DS Mono'; src:url('${fontDir}/mono-400.woff2') format('woff2');
               font-weight:400; font-style:normal; font-display:block; }
`;

/**
 * Build one ad page.
 *
 * `fontDir` is a path the rendering browser can resolve — the fonts are
 * loaded from disk, not from Google Fonts, so the exported PNG carries
 * the real brand faces instead of a Georgia fallback.
 */
export function buildAd({ variant, format, theme, fontDir = './fonts', showFooter = true, photos = {} }) {
  // R1-R5 are composition recipes, not headline variants — they own the
  // whole frame (photo plate, full-bleed UI), so they build elsewhere.
  if (variant.layout && variant.layout !== 'classic') {
    return buildRecipe({ variant, format, theme, fontDir, photos });
  }
  const f = FORMATS[format];
  const t = THEMES[theme];
  const s = SCALE[format];
  const bare = variant.visual === 'none' || !VISUALS[variant.visual];

  // A type-led frame has nothing but the words, so the words get bigger.
  const headSize = Math.round(s.head * (bare ? 1.2 : 1));

  // Stories put Meta's chrome over the top and bottom of the frame.
  const padTop = format === '9x16' ? SAFE_ZONE_9x16.top : s.pad;
  const padBottom = format === '9x16' ? SAFE_ZONE_9x16.bottom : s.pad;

  const visual = bare ? '' : VISUALS[variant.visual](t, variant.visualOpts ?? {});

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  ${fontCss(fontDir)}

  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { width:${f.w}px; height:${f.h}px; overflow:hidden; background:${t.bg}; }
  body { -webkit-font-smoothing:antialiased; }

  .frame { position:relative; width:${f.w}px; height:${f.h}px; overflow:hidden; }

  /* the dawn — the brand's one piece of atmosphere, rising from the lower right */
  .dawn {
    position:absolute; left:64%; bottom:-24%;
    width:${Math.round(f.w * 1.5)}px; height:${Math.round(f.h * 0.92)}px;
    transform:translateX(-50%); border-radius:50%; filter:blur(12px); pointer-events:none;
    background:radial-gradient(ellipse at center,
      ${t.glow[0]} 0%, ${t.glow[1]} 30%, ${t.glow[2]} 52%, ${t.glow[3]} 72%);
  }
  /* keeps the headline readable where the glow runs under it */
  .veil {
    position:absolute; inset:0; pointer-events:none;
    background:linear-gradient(112deg, ${t.bg} 0%, ${t.bg} 20%, ${t.veilFade} 62%, transparent 82%);
  }
  .grain {
    position:absolute; inset:0; pointer-events:none; opacity:${t.grain};
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }

  .stack {
    position:relative; z-index:2; height:100%;
    display:flex; flex-direction:column; justify-content:space-between;
    /* space-between alone will happily let a tall creative collide with the
       wordmark and the footer rule — this is the floor it cannot cross. */
    gap:${Math.round(s.gap * 1.6)}px;
    padding:${padTop}px ${s.pad}px ${padBottom}px;
  }

  .brand { display:flex; align-items:center; gap:14px; }
  .brand span {
    font-family:'DS Display',Georgia,serif; font-size:34px; font-weight:500;
    letter-spacing:-0.01em; color:${t.paper};
  }

  .body { display:flex; flex-direction:column; gap:${s.gap}px; }

  .kicker {
    font-family:'DS Mono',ui-monospace,Menlo,monospace; font-size:${s.kicker}px;
    letter-spacing:0.19em; text-transform:uppercase; color:${t.gold};
  }
  h1 {
    font-family:'DS Display',Georgia,serif; font-weight:400;
    font-size:${headSize}px; line-height:1.06; letter-spacing:-0.022em;
    color:${t.paper}; text-wrap:pretty;
  }
  h1 em { font-style:italic; font-weight:400; color:${t.accent}; }
  .sub {
    font-family:'DS Body',Georgia,serif; font-size:${s.sub}px; line-height:1.5;
    color:${t.dim}; max-width:${bare ? 24 : 21}em;
  }

  .foot {
    display:flex; align-items:baseline; justify-content:space-between; gap:24px;
    padding-top:26px; border-top:1px solid ${t.borderStrong};
    font-family:'DS Mono',ui-monospace,Menlo,monospace; font-size:${s.kicker}px;
    letter-spacing:0.1em; text-transform:uppercase; color:${t.muted};
  }
  .foot b { color:${t.paper}; font-weight:400; }
</style></head>
<body><div class="frame">
  <div class="dawn"></div><div class="veil"></div>

  <div class="stack">
    <div class="brand">${mark(38, t.gold)}<span>Dayspring</span></div>

    <div class="body">
      ${variant.kicker ? `<p class="kicker">${esc(variant.kicker)}</p>` : ''}
      <h1>${esc(variant.head)}</h1>
      ${variant.sub ? `<p class="sub">${esc(variant.sub)}</p>` : ''}
      ${visual ? `<div style="margin-top:${Math.round(s.gap * 0.4)}px">${visual}</div>` : ''}
    </div>

    ${
      // NO OFFER ON THE ART. The 14-day trial is real (api/profile/ensure.ts)
      // but App Review rejected 1.0.767 under 3.1.2(c) for marketing a trial
      // the App Store subscriptions don't carry, and the site scrubbed it in
      // 1a10b1c. An offer burned into a PNG cannot be scrubbed later — it is
      // in the asset. A soft CTA carries the click instead.
      //
      // A carousel repeats its chrome five times if you let it, so the empty
      // div keeps space-between pinning the body where it was.
      showFooter
        ? `<div class="foot">
      <span><b>${esc(variant.ctaLine ?? 'Write today')}</b></span>
      <span>usedayspring.app</span>
    </div>`
        : '<div></div>'
    }
  </div>

  <div class="grain"></div>
</div></body></html>`;
}

// ============================================================
// RECIPE FRAMES (R1-R5)
//
// The nine concepts above are headline-led posters: the words own the
// frame and a small proof card sits under them. These five are the
// opposite bet, and the reason to run them is evidence, not taste:
//
//   - Meta x Kantar x CreativeX (2024): a visible human face with eye
//     contact is the strongest single lever measured, and a product
//     integrated INTO the story beats a product shown beside it.
//   - AppsFlyer (2025): screen demos and tutorials out-retain polished
//     testimonials. A legible UI is the creative, not the garnish.
//
// So a recipe frame owns its whole canvas. The rule they all serve:
// a cold scroller must be able to tell this is a JOURNAL in under a
// second. If the UI is too small to read, the frame has failed.
//
// PHOTOGRAPHY. R1, R2 and R5 need a real photograph, and there isn't
// one in this repo. Drop a file into marketing/ads/photos/<name>.jpg
// and re-run — the frame composites it with no layout work. Until
// then it renders a direction plate carrying the shot list, which is
// deliberately ugly: it must never be mistaken for a finished ad.
// ============================================================

/** Reserved band for Meta's chrome, by canvas. */
const CHROME = { '1x1': 0, '4x5': 0, '9x16': SAFE_ZONE_9x16.top };

/**
 * The photograph, or — when there isn't one yet — the brief for it.
 * `fit` is the object-position, because a face must not be centre-cropped
 * out of a 4:5 by accident.
 */
const plate = (t, variant, photos, { fit = '50% 30%' } = {}) => {
  const src = photos?.[variant.photo];
  if (src) {
    return `<img src="${src}" style="position:absolute;inset:0;width:100%;height:100%;
            object-fit:cover;object-position:${fit}">`;
  }
  const lines = (variant.photoBrief ?? []).map(
    (l) => `<li style="margin-bottom:11px">${l}</li>`,
  ).join('');
  return `
    <div style="position:absolute;inset:0;background:${t.bg};
         display:flex;align-items:center;justify-content:center;padding:70px">
      <div style="border:3px dashed ${t.accent};border-radius:18px;padding:52px;width:100%;
           max-height:100%;overflow:hidden">
        <p style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:22px;
           letter-spacing:0.16em;text-transform:uppercase;color:${t.accent};margin-bottom:28px">
          Photo plate &mdash; not final art
        </p>
        <ul style="font-family:'DS Body',Georgia,serif;font-size:23px;line-height:1.35;
            color:${t.muted};padding-left:26px;opacity:.72">${lines}</ul>
        <p style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:20px;
           color:${t.muted};margin-top:30px">
          drop marketing/ads/photos/${variant.photo}.jpg &rarr; re-run render.mjs
        </p>
      </div>
    </div>`;
};

/**
 * The editor with the slash palette open — the single most important
 * object in this campaign, because it IS the claim.
 *
 * Labels and hints are copied verbatim from src/editor/slashCommands.ts.
 * If that file changes, this is wrong and the ad is lying. Gift and
 * Absence are retired there and must never reappear here.
 */
const uiEditor = (t, { scale = 1, rows = 4 } = {}) => {
  const px = (n) => Math.round(n * scale);
  // Labels and hints only. The live palette also carries a badge per row,
  // but two of the four are colour emoji — at ad scale they become the
  // loudest thing in the frame and the card stops reading as an editor.
  // Leaving a column out is a fidelity trade; inventing one would be a lie.
  const items = [
    ['Scripture', 'Find relevant passages', true],
    ['Prayer', 'Log a prayer', false],
    ['Sense', 'A word or impression', false],
    ['Ritual', 'Practices for the inner life', false],
  ].slice(0, rows);

  return `
  <div style="background:${t.bg};border:1px solid ${t.borderStrong};border-radius:${px(20)}px;
       overflow:hidden;box-shadow:0 ${px(40)}px ${px(90)}px rgba(0,0,0,0.45)">

    <div style="display:flex;align-items:center;gap:${px(14)}px;padding:${px(22)}px ${px(30)}px;
         border-bottom:1px solid ${t.border}">
      <span style="width:${px(11)}px;height:${px(11)}px;border-radius:50%;background:${t.muted};opacity:.5"></span>
      <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(20)}px;
            letter-spacing:0.12em;text-transform:uppercase;color:${t.muted}">
        Thursday 14 March &middot; saved
      </span>
    </div>

    <div style="padding:${px(34)}px ${px(36)}px ${px(26)}px">
      <p style="font-family:'DS Body',Georgia,serif;font-size:${px(35)}px;line-height:1.45;
         color:${t.paper};margin:0">
        I have been praying about the same thing since March.
        <span style="color:${t.accent};font-weight:600">/</span><span
          style="display:inline-block;width:${px(3)}px;height:${px(34)}px;background:${t.accent};
          vertical-align:-${px(6)}px;margin-left:${px(3)}px"></span>
      </p>
    </div>

    <div style="margin:0 ${px(30)}px ${px(30)}px;border:1px solid ${t.borderStrong};
         border-radius:${px(14)}px;overflow:hidden;background:${t.surface}">
      <div style="padding:${px(18)}px ${px(26)}px;border-bottom:1px solid ${t.border}">
        <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(18)}px;
              letter-spacing:0.16em;text-transform:uppercase;color:${t.muted}">Capture</span>
      </div>
      ${items
        .map(
          ([label, hint, on]) => `
        <div style="display:flex;gap:${px(24)}px;align-items:baseline;padding:${px(20)}px ${px(30)}px;
             background:${on ? 'rgba(232,145,124,0.12)' : 'transparent'}">
          <span style="font-family:'DS Display',Georgia,serif;font-size:${px(30)}px;
                color:${on ? t.paper : t.dim};min-width:${px(210)}px">${label}</span>
          <span style="font-family:'DS Body',Georgia,serif;font-size:${px(26)}px;color:${t.muted}">${hint}</span>
        </div>`,
        )
        .join('')}
    </div>
  </div>`;
};

/** Years of writing, dense and receding, with one season read back out of it. */
const uiWall = (t, { scale = 1 } = {}) => {
  const px = (n) => Math.round(n * scale);
  const years = ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024'];
  const wall = years
    .map(
      (y, i) => `
    <div style="display:flex;flex-direction:column;gap:${px(7)}px;opacity:${0.22 + i * 0.055}">
      <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(17)}px;
            letter-spacing:0.1em;color:${t.muted}">${y}</span>
      ${Array.from({ length: 8 })
        .map(
          (_, j) => `<span style="display:block;height:${px(9)}px;border-radius:${px(3)}px;
            background:${t.paper};opacity:${0.1 + ((i + j) % 4) * 0.07};
            width:${60 + ((i * 7 + j * 13) % 40)}%"></span>`,
        )
        .join('')}
    </div>`,
    )
    .join('');

  return `
  <div style="display:flex;flex-direction:column;gap:${px(26)}px">
    <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(19)}px;
          letter-spacing:0.16em;text-transform:uppercase;color:${t.muted}">
      Every page you have written
    </span>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:${px(24)}px ${px(26)}px">
      ${wall}
    </div>
    <div style="background:${t.surface};border:1px solid ${t.borderStrong};
         border-radius:${px(18)}px;padding:${px(34)}px;backdrop-filter:blur(8px);
         box-shadow:0 ${px(30)}px ${px(70)}px rgba(0,0,0,0.35)">
      <div style="display:flex;flex-direction:column;gap:${px(20)}px">
        <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(19)}px;
              letter-spacing:0.16em;text-transform:uppercase;color:${t.gold}">
          Looking back &middot; ten years
        </span>
        ${[
          ['2016 &middot; mar 3', 'the week everything changed at work', 0.45],
          ['2019 &middot; jul 19', 'asked again for the same thing', 0.62],
          ['2024 &middot; sep 8', 'I think this was the answer', 1],
        ]
          .map(
            ([date, frag, op]) => `
          <div style="display:flex;gap:${px(26)}px;align-items:baseline;opacity:${op}">
            <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(20)}px;
                  letter-spacing:0.06em;color:${op === 1 ? t.gold : t.muted};
                  min-width:${px(215)}px">${date}</span>
            <span style="font-family:'DS Body',Georgia,serif;font-size:${px(27)}px;
                  color:${t.paper};flex:1">${frag}</span>
          </div>`,
          )
          .join('')}
        <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(18)}px;
              letter-spacing:0.12em;text-transform:uppercase;color:${t.muted};
              padding-top:${px(14)}px;border-top:1px solid ${t.border}">
          &#8627; quoted from your own entries
        </span>
      </div>
    </div>
  </div>`;
};


/**
 * The shelf, as the library actually lists it.
 *
 * Names, traditions and centuries are verbatim from
 * src/editor/practices/practicesData.ts. Thirteen is SHELF.length — fifteen
 * defined, two retired — and it is the same on `stable` and `master`, which
 * are byte-identical in that file.
 *
 * The Round is deliberately absent. It generates its movements from the
 * writer's Life Map domains, and ritualRound.test.ts asserts it "writes
 * nothing but the masthead when there are no domains" — so a signup from an
 * ad who opens it gets an empty page. Six named plus "seven more" is thirteen.
 */
const uiShelf = (t, { scale = 1 } = {}) => {
  const px = (n) => Math.round(n * scale);
  const rows = [
    ['The Daily Examen', 'Ignatian &middot; 16th century'],
    ['Lectio Divina', 'Benedictine &middot; 6th century'],
    ['Psalmic Lament', 'Hebrew &middot; the Psalter'],
    ['Prayer of Recollection', 'Carmelite &middot; 16th century'],
    ['Wesley&rsquo;s Questions', 'Wesleyan &middot; 18th century'],
    ['Luther&rsquo;s Garland', 'Lutheran &middot; 1535'],
  ];
  return `
  <div style="background:${t.bg};border:1px solid ${t.borderStrong};border-radius:${px(20)}px;
       overflow:hidden;box-shadow:0 ${px(40)}px ${px(90)}px rgba(0,0,0,0.45)">
    <div style="padding:${px(24)}px ${px(34)}px;border-bottom:1px solid ${t.border}">
      <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(19)}px;
            letter-spacing:0.16em;text-transform:uppercase;color:${t.muted}">
        Rituals &middot; thirteen forms
      </span>
    </div>
    ${rows
      .map(
        ([name, meta], i) => `
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:${px(24)}px;
           padding:${px(24)}px ${px(34)}px;
           ${i ? `border-top:1px solid ${t.border};` : ''}
           background:${i === 1 ? 'rgba(232,145,124,0.10)' : 'transparent'}">
        <span style="font-family:'DS Display',Georgia,serif;font-size:${px(33)}px;
              color:${i === 1 ? t.paper : t.dim}">${name}</span>
        <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(19)}px;
              letter-spacing:0.09em;text-transform:uppercase;color:${t.muted};
              white-space:nowrap">${meta}</span>
      </div>`,
      )
      .join('')}
    <div style="padding:${px(22)}px ${px(34)}px;border-top:1px solid ${t.border}">
      <span style="font-family:'DS Body',Georgia,serif;font-size:${px(26)}px;color:${t.muted}">
        and seven more
      </span>
    </div>
  </div>`;
};

/**
 * One ritual, open in the entry, being written into.
 *
 * The movement labels, questions and placeholder are verbatim from Lectio
 * Divina in practicesData.ts. This is the deepest proof the campaign has:
 * not a shelf of names, but the form actually running in the page, with the
 * writer's own words under the first movement. Everything written here stays
 * in the entry as markdown — the composer is a surface, not a second store
 * (ritualDocument.ts).
 */
const uiRitual = (t, { scale = 1 } = {}) => {
  const px = (n) => Math.round(n * scale);
  const movement = (label, question, body, { caret = false, dim = false } = {}) => `
    <div style="display:flex;flex-direction:column;gap:${px(11)}px;
         padding-left:${px(22)}px;border-left:2px solid ${caret ? t.accent : t.border};
         opacity:${dim ? 0.55 : 1}">
      <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(19)}px;
            letter-spacing:0.14em;text-transform:uppercase;color:${t.gold}">${label}</span>
      <span style="font-family:'DS Body',Georgia,serif;font-style:italic;font-size:${px(25)}px;
            line-height:1.4;color:${t.muted}">${question}</span>
      ${
        body
          ? `<p style="font-family:'DS Body',Georgia,serif;font-size:${px(29)}px;line-height:1.45;
             color:${t.paper};margin-top:${px(4)}px">${body}${
              caret
                ? `<span style="display:inline-block;width:${px(3)}px;height:${px(28)}px;
                   background:${t.accent};vertical-align:-${px(5)}px;margin-left:${px(3)}px"></span>`
                : ''
            }</p>`
          : ''
      }
    </div>`;

  return `
  <div style="background:${t.bg};border:1px solid ${t.borderStrong};border-radius:${px(20)}px;
       overflow:hidden;box-shadow:0 ${px(40)}px ${px(90)}px rgba(0,0,0,0.45)">
    <div style="display:flex;align-items:center;gap:${px(14)}px;padding:${px(22)}px ${px(34)}px;
         border-bottom:1px solid ${t.border}">
      <span style="width:${px(11)}px;height:${px(11)}px;border-radius:50%;background:${t.muted};opacity:.5"></span>
      <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(20)}px;
            letter-spacing:0.12em;text-transform:uppercase;color:${t.muted}">
        Thursday 14 March &middot; saved
      </span>
    </div>

    <div style="padding:${px(34)}px;display:flex;flex-direction:column;gap:${px(28)}px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:${px(20)}px;
           padding-bottom:${px(20)}px;border-bottom:1px solid ${t.border}">
        <span style="font-family:'DS Display',Georgia,serif;font-size:${px(40)}px;color:${t.paper}">
          Lectio Divina
        </span>
        <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(19)}px;
              letter-spacing:0.1em;text-transform:uppercase;color:${t.muted};white-space:nowrap">
          Benedictine &middot; four movements
        </span>
      </div>

      ${movement(
        'Lectio &mdash; Read',
        'What passage are you bringing? Read it slowly, twice. What word or phrase caught you?',
        'Psalm 62. The word that stopped me was <em>alone</em> &mdash; I kept reading past it and it kept pulling me back.',
      )}
      ${movement(
        'Meditatio &mdash; Meditate',
        'Repeat that word or phrase. Let it move around in you. What does it surface?',
        'Every time I have said it this year I meant it as a complaint.',
        { caret: true },
      )}
      ${movement('Oratio &mdash; Pray', 'What does this word prompt you to say to God?', '', { dim: true })}
    </div>
  </div>`;
};


/**
 * A journal, ten years deep — read in one glance as a journal.
 *
 * This replaced a wall of grey skeleton bars under the "ten years" headline.
 * At feed size those bars read as a loading state or a chart: nothing in them
 * said *written pages*, and Phil had to stop and think about what he was
 * looking at (2026-09-20). The fix is legibility, not density. A window in the
 * same chrome as the editor frames, with dated entries at a size a phone can
 * actually read, fading upward into the past. Dates plus sentences in an app
 * window is the fastest "this is a journal" the set has.
 *
 * The entries are fabricated and generic, as every sample here is, and they
 * are ordered to tell the remembrance promise on their own: asked, asked
 * again, waited, and then — lit — the answer.
 */
const uiArchive = (t, { scale = 1 } = {}) => {
  const px = (n) => Math.round(n * scale);
  const rows = [
    ['2015 &middot; jan 12', 'Starting this again. Third notebook this year.', 0.3],
    ['2016 &middot; mar 3', 'The week everything changed at work.', 0.42],
    ['2018 &middot; jun 30', 'Asked for patience. Asked again.', 0.55],
    ['2019 &middot; jul 19', 'Still asking for the same thing.', 0.68],
    ['2022 &middot; nov 2', 'Still waiting. Still writing.', 0.82],
    ['2024 &middot; sep 8', 'I think this was the answer.', 1],
  ];
  return `
  <div style="background:${t.bg};border:1px solid ${t.borderStrong};border-radius:${px(20)}px;
       overflow:hidden;box-shadow:0 ${px(40)}px ${px(90)}px rgba(0,0,0,0.45)">
    <div style="display:flex;align-items:center;gap:${px(14)}px;padding:${px(22)}px ${px(34)}px;
         border-bottom:1px solid ${t.border}">
      <span style="width:${px(11)}px;height:${px(11)}px;border-radius:50%;background:${t.muted};opacity:.5"></span>
      <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(20)}px;
            letter-spacing:0.12em;text-transform:uppercase;color:${t.muted}">
        Journal &middot; 2015 &ndash; 2024
      </span>
    </div>
    ${rows
      .map(
        ([date, line, op], i, all) => {
          const lit = i === all.length - 1;
          return `
      <div style="display:flex;gap:${px(28)}px;align-items:baseline;padding:${px(21)}px ${px(34)}px;
           ${i ? `border-top:1px solid ${t.border};` : ''}
           background:${lit ? 'rgba(232,145,124,0.10)' : 'transparent'}">
        <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(19)}px;
              letter-spacing:0.06em;color:${lit ? t.gold : t.muted};min-width:${px(200)}px;
              opacity:${lit ? 1 : Math.max(op, 0.55)}">${date}</span>
        <span style="font-family:'DS Body',Georgia,serif;font-size:${px(29)}px;line-height:1.35;
              color:${t.paper};opacity:${op}">${line}</span>
      </div>`;
        },
      )
      .join('')}
  </div>`;
};

/** Which fragment the `demo` layout draws. */
const RECIPE_UI = { editor: uiEditor, shelf: uiShelf, ritual: uiRitual, archive: uiArchive };


// ---- the close ------------------------------------------------------
// The recipe frames read TOP TO BOTTOM as one sentence: a hook, the proof,
// then the answer. That is why the wordmark is at the BOTTOM of these frames
// and not the top — a logo in the first position is a brand poster, and the
// reader has nothing to resolve. Here the last thing the eye lands on is what
// the thing is:
//
//     Four journals. None of them finished.      <- the hook
//     [ the editor, legible ]                    <- the proof
//     Start with the one that holds.             <- the bridge
//     ☀ Dayspring · A journal for spiritual transformation   <- the answer
//
// Change DESCRIPTOR in one place and every frame follows.

/** The line that finishes the story. One place, so it can never drift. */
const DESCRIPTOR = 'A journal for spiritual transformation';

/**
 * Where you can actually get it. Mac and iPhone — the web app is deliberately
 * not advertised, even though it works.
 *
 * `ios` is ON by Phil's call (2026-09-17): the App Store build is in review and
 * expected any day. Note what that means while it sits there — site.ts:41 still
 * renders the iPhone pill as a non-clickable "Soon" and says "The iPhone app is
 * in review", so the ads are now AHEAD of the site. Two consequences worth
 * knowing rather than discovering: someone who taps through before approval
 * finds no listing, and when it does land, `site.ts` has to be flipped too or
 * the site will be the thing understating what ships.
 *
 * These are generic device glyphs on purpose, not Apple marks. The sanctioned
 * Apple asset is the "Download on the App Store" badge, which carries its own
 * usage rules and would in any case be wrong for the Mac: that app ships as a
 * .dmg from GitHub, not through the Mac App Store.
 */
const PLATFORMS = { mac: true, ios: true, web: false };

/**
 * The Apple mark, so a scroller knows in one glance which platform this is.
 *
 * NOMINATIVE USE, NOT A LICENSED BADGE — worth knowing before this goes into a
 * paid placement. Apple's Identity Guidelines reserve the Apple logo for
 * permitted uses, and the sanctioned "available on" asset is the Download on
 * the App Store badge. That badge does not fit this product: the Mac app ships
 * as a .dmg from GitHub, not through the Mac App Store, so a store badge beside
 * "Mac" would be a false claim about where it comes from. Naming the platforms
 * under one Apple mark is the accurate version and is what indie Mac software
 * has done for years. Phil's call, 2026-09-17.
 */
const appleMark = (size, color) => `
<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}"
     style="flex-shrink:0;opacity:.92">
  <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
</svg>`;

/**
 * The bottom third: bridge line, rule, wordmark + platforms, descriptor.
 * `bridge` is the variant's own sentence — the step from the proof to the
 * answer. It is never an offer and never uppercase mono; it is part of the
 * prose, and it has to read as the next thing said.
 */
const closeBlock = (t, variant, scale = 1) => {
  const px = (n) => Math.round(n * scale);
  const bridge = variant.bridge ?? variant.ctaLine;
  // One Apple mark, then the devices it runs on. Reading "Apple" once and the
  // platforms beside it is clearer at thumb scale than a glyph per device.
  const names = Object.entries(PLATFORMS)
    .filter(([, on]) => on)
    .map(([kind]) => ({ mac: 'Mac', ios: 'iPhone', web: 'Web' })[kind])
    .join(' &middot; ');
  const marks = `
    <span style="display:flex;align-items:center;gap:${px(11)}px">
      ${appleMark(px(23), t.dim)}
      <span style="font-family:'DS Mono',ui-monospace,Menlo,monospace;font-size:${px(19)}px;
            letter-spacing:0.13em;text-transform:uppercase;color:${t.dim}">${names}</span>
    </span>`;

  return `
  <div style="display:flex;flex-direction:column;gap:${px(24)}px">
    ${
      bridge
        ? `<p style="font-family:'DS Body',Georgia,serif;font-size:${px(34)}px;line-height:1.3;
             color:${t.dim};margin:0">${esc(bridge)}</p>`
        : ''
    }
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:${px(26)}px;
         padding-top:${px(24)}px;border-top:1px solid ${t.borderStrong}">
      <div style="display:flex;flex-direction:column;gap:${px(9)}px">
        <div style="display:flex;align-items:center;gap:${px(13)}px">
          ${mark(px(34), t.gold)}
          <span style="font-family:'DS Display',Georgia,serif;font-size:${px(38)}px;font-weight:500;
                letter-spacing:-0.012em;color:${t.paper}">Dayspring</span>
        </div>
        <span style="font-family:'DS Body',Georgia,serif;font-size:${px(27)}px;color:${t.dim}">
          ${DESCRIPTOR}
        </span>
      </div>
      <div style="display:flex;align-items:center;gap:${px(14)}px;padding-bottom:${px(6)}px">
        ${marks}
      </div>
    </div>
  </div>`;
};

/** Build one recipe frame. */
function buildRecipe({ variant, format, theme, fontDir, photos }) {
  const f = FORMATS[format];
  const t = THEMES[theme];
  const top = CHROME[format] || 64;
  const bottom = format === '9x16' ? SAFE_ZONE_9x16.bottom : 64;
  const pad = format === '1x1' ? 64 : 72;
  const s = format === '1x1' ? 0.86 : 1;

  // Deliberately empty: the wordmark lives in the close now. See closeBlock.
  const brand = '';

  const foot = closeBlock(t, variant, s);

  /**
   * One line, large, high contrast. Never an offer, never a claim about the
   * viewer.
   *
   * `onPhoto` buys the line a scrim and a shadow so it survives whatever
   * photograph lands under it. That treatment is ONLY for photo layouts —
   * on the dawn ground it paints a black smudge behind the headline, which
   * is what it did until this was split.
   */
  const overlay = (size, maxWidth = '15em', onPhoto = false) => {
    if (!variant.onImage) return '';
    // The flagship sets its H1 as a plain lead and an italic accent line in the
    // dawn colour (see src/features/flagship/flagship.ts — `headline.lead` /
    // `headline.accent`). These frames sit beside it in the same buy, so they
    // are cut the same way. A hairline under it is the flagship's rule.
    if (typeof variant.onImage === 'object') {
      const { lead, accent } = variant.onImage;
      // `maxWidth` is in em, so it must sit on the element that owns the
      // font-size — on the wrapper it resolves against the inherited 16px and
      // strangles the headline into a column.
      return `<div style="display:flex;flex-direction:column;gap:${Math.round(size * 0.26)}px">
        <h1 style="font-family:'DS Display',Georgia,serif;font-weight:400;font-size:${size}px;
            line-height:1.04;letter-spacing:-0.022em;color:${t.paper};margin:0;
            max-width:${maxWidth};
            ${onPhoto ? 'text-shadow:0 2px 30px rgba(0,0,0,0.8);' : ''}">
          ${esc(lead)}<br>
          <em style="font-style:italic;font-weight:400;color:${t.accent}">${esc(accent)}</em>
        </h1>
        ${
          onPhoto
            ? ''
            : `<div style="height:1px;background:${t.borderStrong};
                 margin-top:${Math.round(size * 0.18)}px"></div>`
        }
      </div>`;
    }
    const lift = onPhoto
      ? `text-shadow:0 2px 30px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.55);`
      : '';
    const scrimSpan = onPhoto
      ? `<span style="position:absolute;left:-${Math.round(size * 0.5)}px;
           top:-${Math.round(size * 0.7)}px;right:-${Math.round(size * 0.5)}px;
           bottom:-${Math.round(size * 0.7)}px;z-index:-1;
           background:radial-gradient(ellipse at 34% 50%, rgba(0,0,0,0.62) 0%,
             rgba(0,0,0,0.42) 42%, transparent 74%)"></span>`
      : '';
    return `<p style="font-family:'DS Display',Georgia,serif;font-weight:400;font-size:${size}px;
      line-height:1.1;letter-spacing:-0.02em;color:${t.paper};max-width:${maxWidth};
      position:relative;${lift}">${scrimSpan}${esc(variant.onImage)}</p>`;
  };

  const scrim = (dir, strength) =>
    `<div style="position:absolute;inset:0;pointer-events:none;
      background:linear-gradient(${dir}, ${t.bg} 0%, ${t.bg} ${strength}%, transparent 78%)"></div>`;

  let inner;

  if (variant.layout === 'hero-photo') {
    // R1 — face owns the top of the frame, UI owns the bottom half and is
    // legible. The two overlap, so the product is IN the story rather than
    // in a box beside it (Kantar: +46%).
    inner = `
      <div style="position:absolute;inset:0;height:64%;overflow:hidden">
        ${plate(t, variant, photos, { fit: '50% 26%' })}
      </div>
      ${scrim('to top', 34)}
      <div style="position:relative;z-index:3;height:100%;display:flex;flex-direction:column;
           justify-content:space-between;padding:${top + 8}px ${pad}px ${bottom}px">
        ${brand}
        <div style="display:flex;flex-direction:column;gap:${Math.round(30 * s)}px;
             margin-top:auto;margin-bottom:${Math.round(40 * s)}px">
          ${overlay(Math.round(62 * s), '13em', true)}
          ${uiEditor(t, { scale: s * 0.92, rows: 4 })}
        </div>
        ${foot}
      </div>`;
  } else if (variant.layout === 'confession') {
    // R2 — the confession is the thumb-stop; the product is the quiet fix
    // underneath it, not the poster.
    inner = `
      <div style="position:absolute;inset:0">${plate(t, variant, photos, { fit: '50% 32%' })}</div>
      ${scrim('to top', 46)}
      <div style="position:absolute;inset:0;background:rgba(0,0,0,0.18)"></div>
      <div style="position:relative;z-index:3;height:100%;display:flex;flex-direction:column;
           justify-content:space-between;padding:${top + 8}px ${pad}px ${bottom}px">
        ${brand}
        <div style="display:flex;flex-direction:column;gap:${Math.round(34 * s)}px;
             margin-top:auto;margin-bottom:${Math.round(40 * s)}px">
          ${overlay(Math.round(82 * s), '11em', true)}
          ${uiEditor(t, { scale: s * 0.7, rows: 2 })}
        </div>
        ${foot}
      </div>`;
  } else if (variant.layout === 'demo') {
    // R3 — no photograph, no atmosphere. The UI is the whole ad, at the
    // largest size the canvas allows.
    inner = `
      <div class="dawn" style="opacity:.5"></div><div class="veil"></div>
      <div style="position:relative;z-index:3;height:100%;display:flex;flex-direction:column;
           justify-content:space-between;padding:${top + 8}px ${pad}px ${bottom}px">
        <div style="display:flex;flex-direction:column;gap:${Math.round(26 * s)}px">
          ${brand}
          ${overlay(Math.round(54 * s), '14em')}
        </div>
        ${(RECIPE_UI[variant.ui ?? 'editor'])(t, { scale: s * (variant.uiScale ?? 1.08), rows: 4 })}
        ${foot}
      </div>`;
  } else if (variant.layout === 'harvest') {
    // R4 — the wedge. Years of writing above, one season read back below.
    inner = `
      <div class="dawn" style="opacity:.45"></div><div class="veil"></div>
      <div style="position:relative;z-index:3;height:100%;display:flex;flex-direction:column;
           gap:${Math.round(44 * s)}px;padding:${top + 8}px ${pad}px ${bottom}px">
        <div style="display:flex;flex-direction:column;gap:${Math.round(26 * s)}px">
          ${brand}
          ${overlay(Math.round(58 * s), '13em')}
        </div>
        ${uiWall(t, { scale: s })}
        <div style="margin-top:auto">${foot}</div>
      </div>`;
  } else {
    // R5 — quiet pastoral. No on-image line by default; the UI peeks.
    inner = `
      <div style="position:absolute;inset:0">${plate(t, variant, photos, { fit: '50% 50%' })}</div>
      ${scrim('to top', 30)}
      <div style="position:relative;z-index:3;height:100%;display:flex;flex-direction:column;
           justify-content:space-between;padding:${top + 8}px ${pad}px ${bottom}px">
        ${brand}
        <div style="margin-top:auto;margin-bottom:${Math.round(40 * s)}px;
             display:flex;flex-direction:column;gap:${Math.round(28 * s)}px">
          ${overlay(Math.round(58 * s), '12em', true)}
        </div>
        ${foot}
      </div>`;
  }

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  ${fontCss(fontDir)}
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { width:${f.w}px; height:${f.h}px; overflow:hidden; background:${t.bg}; }
  body { -webkit-font-smoothing:antialiased; }
  .frame { position:relative; width:${f.w}px; height:${f.h}px; overflow:hidden; }
  .dawn {
    position:absolute; left:64%; bottom:-24%;
    width:${Math.round(f.w * 1.5)}px; height:${Math.round(f.h * 0.92)}px;
    transform:translateX(-50%); border-radius:50%; filter:blur(12px); pointer-events:none;
    background:radial-gradient(ellipse at center,
      ${t.glow[0]} 0%, ${t.glow[1]} 30%, ${t.glow[2]} 52%, ${t.glow[3]} 72%);
  }
  .veil {
    position:absolute; inset:0; pointer-events:none;
    background:linear-gradient(112deg, ${t.bg} 0%, ${t.bg} 18%, ${t.veilFade} 60%, transparent 84%);
  }
  .grain {
    position:absolute; inset:0; pointer-events:none; opacity:${t.grain}; z-index:5;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
</style></head>
<body><div class="frame">${inner}<div class="grain"></div></div></body></html>`;
}
