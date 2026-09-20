#!/usr/bin/env node
/**
 * Capture the flagship image — the one picture that carries the whole product.
 *
 *   npm run flagship                     # every cut, every canvas, both themes
 *   npm run flagship -- --canvas=16x9    # one canvas, while iterating
 *   npm run flagship -- --cut=write      # one cut
 *   npm run flagship -- --cut=x-verses   # one of the EXPERIMENTS — see
 *                                        # flagship.ts; never in a bare run
 *   npm run flagship -- --theme=ink      # one palette
 *
 * Output: assets/flagship/<cut>-<theme>/<canvas>.png, plus CONTACT_SHEET.png
 * and MANIFEST.md beside them.
 *
 * WATCH THIS WITH A SUBSET RUN. Both MANIFEST.md and CONTACT_SHEET.png are
 * rebuilt from what THIS run rendered, not from what is on disk — so
 * `--cut=paid` leaves a manifest claiming the write and bare cuts do not
 * exist, while their PNGs sit right there. Nothing errors. Finish with a bare
 * `npm run flagship` before committing, or the index lies about the folder.
 *
 * Standalone rather than a refactor of capture-ads.mjs, for the reason that
 * script gives for not being a refactor of the listing one: those assets are
 * already uploaded, and sharing helpers would mean regenerating a submitted
 * image for no benefit.
 *
 * The image renders the real components through the dev-only `?__preview=`
 * route (src/features/flagship/), so the hero can never drift from the app —
 * and the `/` palette in the picture is opened through the shipped `+` gutter
 * path, not faked. Sample content is fabricated; no real journal is ever in a
 * public asset.
 */

import { spawn, execFileSync } from 'node:child_process'
import { mkdir, access, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT_DIR = path.join(ROOT, 'assets/flagship')
const FLAGSHIP_TS = path.join(ROOT, 'src/features/flagship/flagship.ts')
// 5183 is the IAP capture, 5184 the listing one, 5185 the ads and the site
// shots; none of them may fight `npm run dev`.
const PORT = 5187

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]

/**
 * MUST match CANVASES in src/features/flagship/flagship.ts — the frame reads
 * the canvas size from the URL, so a mismatch here silently produces a
 * correctly-sized file with the wrong layout inside it.
 */
const CANVASES = {
  '16x9': { css: { w: 1280, h: 720 }, out: { w: 2560, h: 1440 } },
  og: { css: { w: 1200, h: 630 }, out: { w: 1200, h: 630 } },
  '1x1': { css: { w: 720, h: 720 }, out: { w: 1080, h: 1080 } },
  '4x5': { css: { w: 660, h: 825 }, out: { w: 1080, h: 1350 } },
  '9x16': { css: { w: 675, h: 1200 }, out: { w: 1080, h: 1920 } },
}

/** The two shipped defaults. Dawn leads; ink is for dark placements. */
const THEMES = ['dawn', 'ink']

/** Frame ground — site/'s --ink. Must match FlagshipFrame.css. */
const BG = [12, 13, 17]

/**
 * Extra window height handed to Chrome so the VIEWPORT is at least the canvas.
 *
 * `--window-size` sizes the WINDOW, not the viewport: at `--window-size=720,720`
 * the page gets 720x633 while the screenshot is still 720x720. Left uncorrected
 * every export carries a band of bare background under the footer. So: oversize,
 * pass the true canvas in the URL, and crop back here.
 */
const WINDOW_SLACK = 120

/**
 * How long Chrome's virtual clock runs before the shot.
 *
 * Longer than the other capture scripts, and it is not padding. This page boots
 * an iframe that boots the whole app, CodeMirror lays the document out, fonts
 * land, and only then does the scene press the `+` on a frame loop and wait for
 * the palette to mount. Cut this and the failure is silent and specific: a hero
 * image of an app with no menu open, which is the one thing it exists to show.
 * Check CONTACT_SHEET.png after every run — that is what it is for.
 */
const TIME_BUDGET = 30_000

/**
 * Read the registry rather than mirroring it by hand. A `.mjs` cannot import a
 * `.ts`, but it can certainly read one; deliberately narrow — the ids, and the
 * canvas list where a cut restricts itself to some of them.
 *
 * The listing script mirrors its registry by hand and has to be edited in step
 * with it. This one cannot drift, which matters more here: a cut rendered onto
 * a canvas it was never composed for does not fail, it just produces a bad
 * picture that somebody might ship.
 */
async function readCuts() {
  const src = await readFile(FLAGSHIP_TS, 'utf8')
  const ids = [...src.matchAll(/^\s{4}id: '([a-z0-9-]+)',$/gm)]
  if (!ids.length) throw new Error(`Parsed no cuts out of ${path.relative(ROOT, FLAGSHIP_TS)}`)
  // Everything declared after EXPERIMENTS is a combination under test, not part
  // of the set. A bare `npm run flagship` must not quietly triple in size and
  // write seven directories of unreviewed pictures; ask for one by name.
  const experimentsAt = src.indexOf('export const EXPERIMENTS')
  return ids.map((m, i) => {
    // The cut's own span: from its id to the next cut's, or the end of CUTS.
    const span = src.slice(m.index, ids[i + 1]?.index ?? src.length)
    const only = span.match(/canvases: \[([^\]]+)\]/)
    return {
      id: m[1],
      experiment: experimentsAt !== -1 && m.index > experimentsAt,
      canvases: only ? only[1].split(',').map((c) => c.trim().replace(/'/g, '')) : null,
    }
  })
}

async function findChrome() {
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
      '--disable-gpu',
      '--hide-scrollbars',
      `--virtual-time-budget=${TIME_BUDGET}`,
      '--run-all-compositor-stages-before-draw',
      '--force-device-scale-factor=2',
      `--window-size=${css.w},${css.h + WINDOW_SLACK}`,
      `--screenshot=${outFile}`,
      url,
    ])
    proc.on('error', reject)
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`chrome exited ${code}`))))
  })
}

/** Crop off the window slack, flatten onto our own ground, resample to spec. */
function finalizePng(outFile, css, out) {
  execFileSync(
    'python3',
    [
      '-c',
      `
from PIL import Image
path = ${JSON.stringify(outFile)}
target = (${out.w}, ${out.h})
bg = (${BG.join(', ')})
with Image.open(path) as im:
    rgba = im.convert('RGBA')
    flat = Image.new('RGB', rgba.size, bg)
    flat.paste(rgba, mask=rgba.split()[3])
    # The device scale factor is derived from the capture rather than assumed,
    # so the crop stays correct if the factor is ever changed.
    dsf = flat.width / ${css.w}
    frame = (0, 0, flat.width, round(${css.h} * dsf))
    if frame[3] > flat.height:
        raise SystemExit('Capture is shorter than the canvas — raise WINDOW_SLACK')
    flat = flat.crop(frame)
    if flat.size != target:
        # The canvas is the target aspect exactly, so this is a clean supersample
        # down — never a stretch, and never an upscale.
        flat = flat.resize(target, Image.LANCZOS)
    flat.save(path, 'PNG')
print('   ', flat.size, flat.mode)
`.trim(),
    ],
    { stdio: 'inherit' },
  )
}

/**
 * One sheet with every export on it, at a glance.
 *
 * The failure this catches is the one the type system cannot: a palette that
 * did not open, a headline that overflowed, a window cropped through its own
 * titlebar. None of them throws. All of them are obvious on a contact sheet.
 */
function contactSheet(files, outFile) {
  execFileSync(
    'python3',
    [
      '-c',
      `
from PIL import Image
files = ${JSON.stringify(files)}
cell = 460
pad = 18
cols = 4
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cell + pad * (cols + 1), rows * cell + pad * (rows + 1)), (24, 25, 31))
for i, f in enumerate(files):
    with Image.open(f) as im:
        im = im.convert('RGB')
        im.thumbnail((cell, cell), Image.LANCZOS)
        x = pad + (i % cols) * (cell + pad) + (cell - im.width) // 2
        y = pad + (i // cols) * (cell + pad) + (cell - im.height) // 2
        sheet.paste(im, (x, y))
sheet.save(${JSON.stringify(outFile)}, 'PNG')
print('   contact sheet:', sheet.size)
`.trim(),
    ],
    { stdio: 'inherit' },
  )
}

async function main() {
  const chrome = await findChrome()
  const argv = process.argv.slice(2)
  const pick = (flag) => argv.find((a) => a.startsWith(`--${flag}=`))?.split('=')[1]

  const canvasArg = pick('canvas')
  const canvases = canvasArg ? { [canvasArg]: CANVASES[canvasArg] } : CANVASES
  if (canvasArg && !CANVASES[canvasArg]) {
    throw new Error(`Unknown canvas "${canvasArg}". Try: ${Object.keys(CANVASES).join(', ')}`)
  }

  const themeArg = pick('theme')
  const themes = themeArg ? [themeArg] : THEMES

  const cutArg = pick('cut')
  const allCuts = await readCuts()
  const cuts = cutArg ? allCuts.filter((c) => c.id === cutArg) : allCuts.filter((c) => !c.experiment)
  if (!cuts.length) {
    throw new Error(`No cut matched "${cutArg}". Have: ${allCuts.map((c) => c.id).join(', ')}`)
  }

  console.log(`Starting dev server on :${PORT}…`)
  const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  })

  const written = []
  try {
    await waitForServer(`http://localhost:${PORT}/`)
    for (const cut of cuts) {
      for (const theme of themes) {
        const wanted = Object.entries(canvases).filter(
          ([name]) => !cut.canvases || cut.canvases.includes(name),
        )
        if (!wanted.length) continue
        const dir = path.join(OUT_DIR, `${cut.id}-${theme}`)
        await mkdir(dir, { recursive: true })
        console.log(`\n${cut.id} · ${theme}`)
        for (const [name, size] of wanted) {
          const out = path.join(dir, `${name}.png`)
          // The canvas travels in the URL so the layout never has to infer it
          // from a viewport that is not what we asked for.
          const url =
            `http://localhost:${PORT}/?__preview=flagship&cut=${cut.id}&theme=${theme}` +
            `&canvas=${name}&w=${size.css.w}&h=${size.css.h}`
          await capture(chrome, url, out, size.css)
          console.log(`  ${path.relative(ROOT, out)}`)
          finalizePng(out, size.css, size.out)
          written.push(out)
        }
      }
    }
    if (written.length > 1) {
      const sheet = path.join(OUT_DIR, 'CONTACT_SHEET.png')
      contactSheet(written, sheet)
      console.log(`\n${path.relative(ROOT, sheet)} — look at it before shipping any of these.`)
    }
    await writeManifest(written)
  } finally {
    vite.kill()
  }
}

/** What each file is for, so nobody has to open five PNGs to find the hero. */
async function writeManifest(files) {
  const src = await readFile(FLAGSHIP_TS, 'utf8')
  const uses = Object.fromEntries(
    [...src.matchAll(/'?([\w.]+)'?: \{ css:.*?use: '([^']+)' \}/g)].map((m) => [m[1], m[2]]),
  )
  const lines = [
    '# Flagship — what is here',
    '',
    '> Generated by `npm run flagship`. Do not edit by hand, and do not retouch the',
    '> PNGs — everything in them comes from `src/features/flagship/`, which is where',
    '> a change belongs so the image cannot drift from the app.',
    '',
    '| File | Size | For |',
    '|---|---|---|',
  ]
  for (const f of files) {
    const rel = path.relative(OUT_DIR, f)
    const canvas = path.basename(f, '.png')
    const size = CANVASES[canvas]
    lines.push(`| \`${rel}\` | ${size.out.w}×${size.out.h} | ${uses[canvas] ?? ''} |`)
  }
  lines.push('')
  lines.push('`-dawn` is the light palette and leads; `-ink` is the same image for dark')
  lines.push('placements. The `bare` cut prints no words at all — for the places that')
  lines.push('bring their own (the site hero, a press kit, a slide).')
  lines.push('')
  await writeFile(path.join(OUT_DIR, 'MANIFEST.md'), lines.join('\n'))
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
