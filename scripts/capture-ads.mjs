#!/usr/bin/env node
/**
 * Capture the paid-social ad creative for Facebook and Instagram.
 *
 *   npm run ads                  # every ad, every ratio
 *   npm run ads -- pile verdict  # only ads whose file stem matches
 *   npm run ads -- --ratio=4x5   # only one ratio
 *
 * Output: assets/ads/<NN-name>/<ratio>.png
 *
 * Standalone rather than a refactor of capture-listing-screenshots.mjs, for the
 * same reason that script is standalone from the IAP one: it produced assets
 * already uploaded to App Store Connect, and sharing helpers would mean
 * re-running it and regenerating a submitted image for no benefit.
 *
 * Each ad renders the real components through the dev-only `?__preview=` route
 * (src/features/ads/preview.tsx), so what we buy media against is always what
 * ships. Copy lives in src/features/ads/ads.ts.
 */

import { spawn, execFileSync } from 'node:child_process'
import { mkdir, access, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT_DIR = path.join(ROOT, 'assets/ads')
const ADS_TS = path.join(ROOT, 'src/features/ads/ads.ts')
// 5183 belongs to the IAP capture and 5184 to the listing capture; none of the
// three may fight `npm run dev`.
const PORT = 5185

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]

/**
 * Meta's placement sizes, and the CSS canvas each is rendered at.
 *
 * MUST match AD_RATIOS in src/features/ads/preview.tsx — the frame reads
 * `window.innerWidth`, so a mismatch silently produces a correctly-sized image
 * with the wrong layout inside it.
 *
 * Capture is supersampled: each canvas is >= 660 CSS px wide, which clears the
 * listing script's hard-won floor (below roughly 640, macOS's minimum window
 * width makes Chrome lay out narrow while still cropping to `--window-size`,
 * slicing the right-hand edge off), and is then Lanczos-downsampled to spec.
 * Cheaper than fighting the minimum, and crisper than rendering at 540.
 */
const RATIOS = {
  '4x5': { css: { w: 660, h: 825 }, out: { w: 1080, h: 1350 } },
  '1x1': { css: { w: 720, h: 720 }, out: { w: 1080, h: 1080 } },
  '9x16': { css: { w: 675, h: 1200 }, out: { w: 1080, h: 1920 } },
}

/** Frame background — site/'s --ink. Must match AdFrame.css. */
const BG = [12, 13, 17]

/**
 * Extra window height, in CSS px, to hand Chrome so the VIEWPORT is at least the
 * frame we asked for.
 *
 * `--window-size` sizes the window, not the viewport: at `--window-size=720,720`
 * the page gets 720x633 while the screenshot is still 720x720 at scale. Left
 * uncorrected the frame lays out ~87px short and every export carries a band of
 * bare background under the footer. So: oversize the window, pass the true frame
 * size to the page in the URL, and crop back to it here. 120 is comfortably more
 * than the chrome observed on macOS and costs nothing but a crop.
 */
const WINDOW_SLACK = 120

/**
 * Read the registry rather than mirroring it by hand.
 *
 * The listing script keeps its own copy of SHOTS and has to be edited in step
 * with shots.ts; this one cannot drift, because a `.mjs` cannot import a `.ts`
 * but it can certainly read one. Deliberately narrow: only the two string
 * literals the capture actually needs.
 */
async function readAds() {
  const src = await readFile(ADS_TS, 'utf8')
  const ads = []
  const re = /id:\s*'(ad-[a-z0-9-]+)',\s*\n\s*file:\s*'([a-z0-9-]+)'/g
  let m
  while ((m = re.exec(src))) ads.push({ preview: m[1], file: m[2] })
  if (!ads.length) throw new Error(`Parsed no ads out of ${path.relative(ROOT, ADS_TS)}`)
  return ads
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
      // The page boots asynchronously (fonts, the dynamic import of the preview
      // module, and then a nested iframe booting the app all over again).
      // Without a virtual time budget Chrome shoots a blank page.
      '--virtual-time-budget=20000',
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

function finalizePng(outFile, css, out) {
  // Guarantee exact placement dimensions and RGB with no alpha. Meta accepts
  // transparency, but a PNG whose alpha is flattened by whatever renders it is
  // a preview that does not match the buy — flatten it here, on our ground.
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
    # Crop away WINDOW_SLACK before scaling. The device scale factor is derived
    # from the capture rather than assumed, so the crop stays correct if the
    # factor is ever changed.
    dsf = flat.width / ${css.w}
    frame = (0, 0, flat.width, round(${css.h} * dsf))
    if frame[3] > flat.height:
        raise SystemExit('Capture is shorter than the frame — raise WINDOW_SLACK')
    flat = flat.crop(frame)
    if flat.size != target:
        # The frame is the target aspect exactly, so this is a clean supersample
        # down — never a stretch, and never an upscale.
        flat = flat.resize(target, Image.LANCZOS)
    flat.save(path, 'PNG')
print('   ', flat.size, flat.mode)
`.trim(),
    ],
    { stdio: 'inherit' },
  )
}

async function main() {
  const chrome = await findChrome()
  const argv = process.argv.slice(2)
  const only = argv.filter((a) => !a.startsWith('-'))
  const ratioArg = argv.find((a) => a.startsWith('--ratio='))?.split('=')[1]
  const ratios = ratioArg ? { [ratioArg]: RATIOS[ratioArg] } : RATIOS
  if (ratioArg && !RATIOS[ratioArg]) {
    throw new Error(`Unknown ratio "${ratioArg}". Try one of: ${Object.keys(RATIOS).join(', ')}`)
  }

  const all = await readAds()
  const ads = only.length ? all.filter((a) => only.some((o) => a.file.includes(o))) : all
  if (!ads.length) throw new Error(`No ads matched: ${only.join(', ')}`)

  console.log(`Starting dev server on :${PORT}…`)
  const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  })

  try {
    await waitForServer(`http://localhost:${PORT}/`)
    for (const ad of ads) {
      const dir = path.join(OUT_DIR, ad.file)
      await mkdir(dir, { recursive: true })
      console.log(`\n${ad.file}`)
      for (const [name, size] of Object.entries(ratios)) {
        const out = path.join(dir, `${name}.png`)
        // The frame size travels in the URL so the page never has to infer it
        // from a viewport that is not what we asked for.
        const url = `http://localhost:${PORT}/?__preview=${ad.preview}&ratio=${name}&w=${size.css.w}&h=${size.css.h}`
        await capture(chrome, url, out, size.css)
        console.log(`  ${path.relative(ROOT, out)}`)
        finalizePng(out, size.css, size.out)
      }
    }
    console.log('\nDone. Copy for each ad: assets/ads/COPY.md (npm run ads:copy).')
  } finally {
    vite.kill()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
