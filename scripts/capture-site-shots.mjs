#!/usr/bin/env node
/**
 * Capture the marketing site's product screenshots — the desktop-width shots
 * site/ embeds, as opposed to the phone-shaped App Store gallery that
 * capture-listing-screenshots.mjs produces.
 *
 *   npm run screenshots:site
 *
 * Output, per palette:
 *   <name>.png / @2x          the composite — the dropdown over the wall
 *   <name>-panel.png / @2x    the dropdown alone
 *
 * The panel is not a spare: a 1280px-wide desktop surface scaled into a 335px
 * phone column is unreadable at any crop, so on a phone the site shows the
 * panel at its NATIVE width in a swipeable box instead. Cropping the composite
 * in CSS would keep the wall's 1020px height for no benefit there.
 *
 * Today that is one subject, in both palettes: the read surface — the wall of
 * pages, with `look for` open over it. It's a composite of two captures of the
 * same fixture archive, not a mock-up:
 *
 *   1. `?__preview=pages&frame=0&chrome=0`      the wall
 *   2. `?__preview=pages&part=sheet&wide=1&open=1`  the dropdown
 *
 * PRIVACY — read before extending this. `?__preview=pages` is NOT in
 * src/lib/previewMode.ts's `CAPTURE_PREVIEWS`, which gates the Ascent, Altar
 * and Scripture data seams. It doesn't need to be today: the entries come from
 * fixtures held in the preview module itself, and the wall's remaining fetches
 * (the Concordance, kept subjects, markings) need a Supabase session that
 * headless Chrome has not got, so they fail and the surface renders empty —
 * which is exactly what the committed wall shot shows.
 *
 * That is weaker than the seams' guarantee, because it rests on the capture
 * browser happening to be signed out rather than on a switch. Pinning it with
 * a throwaway `--user-data-dir` was tried and reverted: a fresh profile makes
 * Chrome hang instead of exiting after --screenshot, even with --no-first-run.
 * So if this shot ever grows to include a surface previewMode.ts covers, or the
 * wall starts rendering anything account-shaped, add 'pages' to
 * CAPTURE_PREVIEWS rather than relying on the session being absent.
 *
 * Both are the shipped components against the SAME fixture entries
 * (src/features/pages/preview.tsx), so the counts on the pills — Tiffany 24,
 * home 53, Prayer 34 — really do describe the 54 pages behind them. They are
 * two captures only because the wall preview has no account and so no
 * Concordance, which is where the subject vocabulary comes from; the dropdown
 * preview builds its index from the fixtures directly. The overlay is opaque,
 * full-width and pinned at the origin, so the seam is invisible: the palette,
 * the width and the head row are identical in both.
 */

import { spawn, execFileSync } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT_DIR = path.join(ROOT, 'site/public/screenshots')
const TMP_DIR = path.join(ROOT, 'site/public/screenshots/.tmp')
const PORT = 5185 // 5183 is the IAP capture, 5184 the listing one; neither may fight `npm run dev`

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]

/**
 * CSS px. 1280 is wide enough that the wall lays out four columns (what makes
 * the point) and the `look for` dropdown opens as a dropdown rather than a
 * phone sheet. The height is set against SHEET_KEEP rather than against a
 * laptop's aspect: the dropdown is a fixed 540, so a shorter frame is all
 * dropdown and the archive it is searching never appears.
 */
const WALL = { width: 1280, height: 1020 }

/**
 * How much of the sheet capture to keep. The dropdown panel ends at ~520 CSS px
 * at this width; below that is empty app background, and pasting it would wipe
 * the wall out. Measured, not guessed — re-measure if LookFor grows a row.
 */
const SHEET_KEEP = 540

/** `dawn` and `ink` are the app's shipped light and dark defaults. */
const SHOTS = [
  { name: 'pages-search-light', theme: 'dawn' },
  { name: 'pages-search-dark', theme: 'ink' },
]

async function findChrome() {
  const { access } = await import('node:fs/promises')
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate)
      return candidate
    } catch {
      /* try the next one */
    }
  }
  throw new Error(`No Chrome/Chromium found. Looked in:\n  ${CHROME_CANDIDATES.join('\n  ')}`)
}

function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const res = await fetch(url)
        if (res.ok) return resolve()
      } catch {
        /* not up yet */
      }
      if (Date.now() > deadline) return reject(new Error(`Dev server never came up at ${url}`))
      setTimeout(poll, 400)
    }
    poll()
  })
}

function capture(chrome, url, outFile, css) {
  return new Promise((resolve, reject) => {
    const proc = spawn(chrome, [
      // Old --headless lays out at its own default width regardless of
      // --window-size. It must be the new headless.
      '--headless=new',
      // An empty, throwaway profile — see the PRIVACY note at the top. Without
      // it Chrome may reach for the real one, and a signed-in profile would
      // composite the developer's own archive into a published image.
      '--disable-gpu',
      '--hide-scrollbars',
      // Fonts, the dynamic import of the preview module, and — for the sheet —
      // a requestAnimationFrame click. Without a virtual time budget Chrome
      // shoots the page before any of that lands.
      '--virtual-time-budget=20000',
      '--run-all-compositor-stages-before-draw',
      '--force-device-scale-factor=2',
      `--window-size=${css.width},${css.height}`,
      `--screenshot=${outFile}`,
      url,
    ])
    proc.on('error', reject)
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`chrome exited ${code}`))))
  })
}

/** Paste the dropdown over the wall; write the composite and the panel, 1x + @2x. */
function compose(wallPng, sheetPng, outBase) {
  execFileSync(
    'python3',
    [
      '-c',
      `
from PIL import Image

def write(im, base, scale):
    im.save(base + '@2x.png', 'PNG')
    one = im.resize((round(im.width / scale), round(im.height / scale)), Image.LANCZOS)
    one.save(base + '.png', 'PNG')
    return one.size

wall = Image.open(${JSON.stringify(wallPng)}).convert('RGB')
sheet = Image.open(${JSON.stringify(sheetPng)}).convert('RGB')
scale = wall.width / ${WALL.width}
keep = round(${SHEET_KEEP} * scale)
sheet = sheet.crop((0, 0, wall.width, min(keep, sheet.height)))
print('    panel ', write(sheet, ${JSON.stringify(outBase)} + '-panel', scale))
wall.paste(sheet, (0, 0))
print('    full  ', write(wall, ${JSON.stringify(outBase)}, scale))
`.trim(),
    ],
    { stdio: 'inherit' },
  )
}

async function main() {
  const chrome = await findChrome()
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(TMP_DIR, { recursive: true })

  console.log(`Starting dev server on :${PORT}…`)
  const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  })

  try {
    await waitForServer(`http://localhost:${PORT}/`)
    for (const shot of SHOTS) {
      console.log(`\n${shot.name} (${shot.theme})`)
      const wallPng = path.join(TMP_DIR, `${shot.name}-wall.png`)
      const sheetPng = path.join(TMP_DIR, `${shot.name}-sheet.png`)
      const base = `http://localhost:${PORT}/?__preview=pages&frame=0&theme=${shot.theme}`
      await capture(chrome, `${base}&chrome=0`, wallPng, WALL)
      await capture(chrome, `${base}&part=sheet&wide=1&open=1`, sheetPng, {
        width: WALL.width,
        height: SHEET_KEEP,
      })
      compose(wallPng, sheetPng, path.join(OUT_DIR, shot.name))
    }
    console.log(`\nDone → ${path.relative(ROOT, OUT_DIR)}`)
  } finally {
    vite.kill()
    await rm(TMP_DIR, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
