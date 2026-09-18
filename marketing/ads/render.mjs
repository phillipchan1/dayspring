#!/usr/bin/env node
// ============================================================
// Renders every creative in variants.mjs to a PNG at Meta's exact
// pixel specs, and writes the matching ad-text handoff sheet.
//
//   node marketing/ads/render.mjs                  # everything
//   node marketing/ads/render.mjs --only b1        # ids containing "b1"
//   node marketing/ads/render.mjs --format 1x1     # one canvas
//   node marketing/ads/render.mjs --copy-only      # skip the images
//
// Uses the Chrome already on this Mac — no npm install, no Playwright
// download. Fonts are loaded from ./fonts so exported PNGs carry the
// real brand faces rather than a fallback serif.
// ============================================================

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { VARIANTS, CAROUSEL, FORMATS, TRACKS } from './variants.mjs';
import { buildAd } from './template.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const TMP = join(HERE, '.tmp');
const FONTS = pathToFileURL(join(HERE, 'fonts')).href;
const PHOTOS = join(HERE, 'photos');

/**
 * Photographs for the R1/R2/R5 frames, keyed by the `photo` field on a
 * variant. Absent is the normal state: the frame then renders its shot
 * list instead, so the composition is reviewable before anyone books a
 * photographer. Drop <name>.jpg in photos/ and re-run.
 */
const photos = Object.fromEntries(
  (existsSync(PHOTOS) ? readdirSync(PHOTOS) : [])
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => [f.replace(/\.[^.]+$/, ''), pathToFileURL(join(PHOTOS, f)).href]),
);

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};
const only = flag('only');
const onlyFormat = flag('format');
const copyOnly = argv.includes('--copy-only');

/** `DS_<track>_<id>_<format>_<theme>` — this string is what shows up in
 *  the buyer's reporting, so it has to carry the whole test cell. */
const nameOf = (v, format, theme) =>
  `DS_${v.track}_${v.id}_${format}_${theme}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Screenshot one page.
 *
 * Chrome writes the PNG in a second or two and then, in both headless
 * modes, sits there instead of exiting — so waiting on the process
 * costs ~40s per image. Wait on the FILE instead: poll until it exists
 * and has stopped growing, then kill the browser.
 */
async function shoot(html, name, { w, h }) {
  const page = join(TMP, `${name}.html`);
  const png = join(OUT, `${name}.png`);
  writeFileSync(page, html);
  rmSync(png, { force: true });

  const child = spawn(
    CHROME,
    [
      '--headless',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--allow-file-access-from-files',
      // Chrome must not touch the real profile — Phil's browser may be open.
      `--user-data-dir=${join(TMP, 'chrome-profile')}`,
      // Without these a headless launch spends most of its wall time on
      // first-run setup and background network chatter, not on rendering.
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      // Long enough for the six local @font-face files to settle.
      '--virtual-time-budget=1500',
      `--window-size=${w},${h}`,
      `--screenshot=${png}`,
      pathToFileURL(page).href,
    ],
    { stdio: 'ignore' },
  );

  try {
    let lastSize = -1;
    for (let waited = 0; waited < 30000; waited += 250) {
      await sleep(250);
      if (!existsSync(png)) continue;
      const size = statSync(png).size;
      if (size > 0 && size === lastSize) return; // written and settled
      lastSize = size;
    }
    throw new Error(`timed out waiting for ${name}.png`);
  } finally {
    child.kill('SIGKILL');
  }
}

// ---- images ----------------------------------------------------------

mkdirSync(OUT, { recursive: true });
// A run that was interrupted leaves a Chrome singleton lock behind, and the
// next launch then dies on it — so the scratch dir is rebuilt, not reused.
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

let made = 0;

if (!copyOnly) {
  for (const v of VARIANTS) {
    if (only && !v.id.includes(only)) continue;
    for (const format of v.formats) {
      if (onlyFormat && format !== onlyFormat) continue;
      for (const theme of v.themes) {
        const name = nameOf(v, format, theme);
        await shoot(buildAd({ variant: v, format, theme, fontDir: FONTS, photos }), name, FORMATS[format]);
        console.log(`  ${name}.png`);
        made++;
      }
    }
  }

  // Carousel cards are square only — Meta crops anything else.
  if (!only || CAROUSEL.id.includes(only)) {
    if (!onlyFormat || onlyFormat === '1x1') {
      for (const [i, c] of CAROUSEL.cards.entries()) {
        const name = `DS_${CAROUSEL.track}_${CAROUSEL.id}_card${i + 1}-${c.id.replace(/^\d+-/, '')}_1x1_ink`;
        await shoot(
          buildAd({
            variant: c,
            format: '1x1',
            theme: 'ink',
            fontDir: FONTS,
            showFooter: i === CAROUSEL.cards.length - 1,
          }),
          name,
          FORMATS['1x1'],
        );
        console.log(`  ${name}.png`);
        made++;
      }
    }
  }
}

// ---- the ad-text handoff sheet ---------------------------------------
// Rockbot needs the words, not just the pictures. Generating this from
// the same file the images come from is the whole point: a headline
// cannot be changed in one place and not the other.

const sheet = [
  '# Dayspring — paid social creative sheet',
  '',
  '> Generated by `marketing/ads/render.mjs` from `variants.mjs`. Do not edit by hand —',
  '> edit the variants file and re-run, or the images and the words will drift apart.',
  '',
  '## Tracks under test',
  '',
  '| Track | Name | Thesis | What a win reads as |',
  '|---|---|---|---|',
  ...Object.entries(TRACKS).map(
    ([k, t]) => `| **${k}** | ${t.name} | ${t.thesis} | ${t.reads} |`,
  ),
  '',
  '## Creatives',
  '',
];

for (const v of VARIANTS) {
  const files = v.external ?? v.formats.flatMap((f) => v.themes.map((th) => `${nameOf(v, f, th)}.png`));
  sheet.push(
    `### ${v.id} — Track ${v.track} · ${TRACKS[v.track].name}`,
    '',
    // A recipe frame has no headline in the art — it has at most one line,
    // and the thing a buyer needs to see beside it is which form it is.
    `**On the image:** ${
      v.head
        ? v.head.replace(/<br>/g, ' / ').replace(/<\/?em>/g, '*')
        : typeof v.onImage === 'object'
          ? `${v.onImage.lead} *${v.onImage.accent}*`
          : v.onImage || '(no text on the image)'
    }`,
    '',
    ...(v.recipe
      ? [
          `**Recipe ${v.recipe}**${v.layout ? ` · layout \`${v.layout}\`` : ''}${
            v.photo ? ` · needs \`photos/${v.photo}.jpg\` (renders a direction plate until it exists)` : ''
          }`,
          '',
        ]
      : []),
    '| Field | Value |',
    '|---|---|',
    // Meta takes up to 5 primary texts per ad. ~125 characters show before
    // "See more" on mobile and most readers never expand, so the short one has
    // to win alone; the long one is there for the people who do expand.
    ...(v.meta.primaryShort
      ? [`| Primary text (short) | ${v.meta.primaryShort} |`]
      : []),
    `| Primary text${v.meta.primaryShort ? ' (long)' : ''} | ${v.meta.primary.replace(/\n+/g, '<br><br>')} |`,
    `| Headline | ${v.meta.headline} |`,
    `| Description | ${v.meta.description} |`,
    `| Call to action | ${v.meta.cta} |`,
    '',
    `**Files:** ${files.map((f) => `\`${f}\``).join(' · ')}`,
    '',
    `**Claim traces to:** ${v.source}`,
    '',
    '---',
    '',
  );
}

sheet.push(
  `### ${CAROUSEL.id} — Track ${CAROUSEL.track} · carousel, ${CAROUSEL.cards.length} cards`,
  '',
  '| Field | Value |',
  '|---|---|',
  `| Primary text | ${CAROUSEL.meta.primary.replace(/\n+/g, '<br><br>')} |`,
  `| Call to action | ${CAROUSEL.meta.cta} |`,
  '',
  '| # | Card | On the image |',
  '|---|---|---|',
  ...CAROUSEL.cards.map(
    (c, i) =>
      `| ${i + 1} | ${c.id} | ${c.head.replace(/<br>/g, ' / ').replace(/<\/?em>/g, '*')} |`,
  ),
  '',
);

writeFileSync(join(OUT, 'CREATIVE_SHEET.md'), sheet.join('\n'));

// ---- contact sheet ---------------------------------------------------
// Every frame on one page. The layout has no runtime guard against a
// creative growing taller than its canvas — it clips at the footer rule
// instead — so the whole set gets looked at before anything is bought.

if (!copyOnly) {
  const shots = readdirSync(OUT)
    .filter((f) => f.endsWith('.png') && f !== 'CONTACT_SHEET.png')
    .sort();
  const COLS = 6;
  const CELL = 300;
  const contact = `<!doctype html><meta charset="utf-8"><style>
    body { margin:0; padding:28px; background:#1b1b1f; font:12px ui-monospace,Menlo,monospace; }
    .grid { display:grid; grid-template-columns:repeat(${COLS}, ${CELL}px); gap:24px; }
    figure { margin:0; display:flex; flex-direction:column; gap:8px; }
    img { width:${CELL}px; height:auto; background:#000; border:1px solid #33333a; }
    figcaption { color:#8d8d97; word-break:break-all; line-height:1.4; }
  </style><div class="grid">${shots
    // Absolute, because the page itself is rendered from the scratch dir.
    .map(
      (f) =>
        `<figure><img src="${pathToFileURL(join(OUT, f)).href}"><figcaption>${f.replace(/^DS_|\.png$/g, '')}</figcaption></figure>`,
    )
    .join('')}</div>`;
  writeFileSync(join(OUT, 'contact.html'), contact);
  const rows = Math.ceil(shots.length / COLS);
  await shoot(contact, 'CONTACT_SHEET', { w: COLS * (CELL + 24) + 56, h: rows * 640 + 56 });
  console.log(`  CONTACT_SHEET.png (${shots.length} frames)`);
}

// ---- tidy ------------------------------------------------------------

rmSync(TMP, { recursive: true, force: true });

const onDisk = readdirSync(OUT).filter((f) => f.endsWith('.png')).length;
console.log(`\n${made} rendered · ${onDisk} PNGs in marketing/ads/out/ · CREATIVE_SHEET.md written`);
