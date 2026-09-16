# Dayspring Facebook Page kit

The landing spot for people who tap through from the Instagram/Meta ad and check out
the Page it's attributed to. The ad creative itself (feed/square/story placements)
already lives in `assets/marketing/meta/` — this folder covers what dresses the Page.

## Files

- `exports/cover.png` — Page cover photo, 1200×630, rendered from `template.html` +
  `styles.css`.
- `exports/profile-icon.png` — Page/profile picture, 1024×1024. This is the app's own
  icon (`public/icons/icon-1024.png`), copied as-is, so the Page matches the App Store
  listing and the web app rather than introducing a second mark.

## Cover photo safe zone

Facebook re-crops the same 1200×630 upload two different ways:

- **Desktop** shows a 2.628:1 band — full width, less height.
- **Mobile** shows a 1.778:1 band — full height, less width.

The intersection of both crops is roughly `x: 3.3%–96.7%`, `y: 13.8%–86.2%` of the
source image. Everything essential (wordmark, headline, CTA line) sits inside that
box, and nothing sits in the bottom-left quarter, which older Page layouts overlap
with the profile picture. `styles.css` has the exact math in a comment on `.cover`.

## Visual system

Same tokens as the Meta ad creative: ink `#0c0d11`, dawn gradient
(`#f3bd76 → #e8917c → #c56a6e`), Fraunces display / Newsreader body / JetBrains Mono
labels. The sunrise mark is the same glyph as `public/favicon.svg`, scaled up and
recolored with the dawn gradient.

## Rebuild

```bash
npm run collateral:facebook
```

Requires `node_modules` installed (for the local `@fontsource` files) and a
Chromium/Chrome binary — set `CHROME_BIN` if it isn't at one of the default paths the
script checks.

## Uploading

Facebook Page Settings → Photos → update cover photo / profile picture. Re-upload
whenever `template.html`/`styles.css` change — Facebook doesn't hot-reload Page
assets from this repo.
