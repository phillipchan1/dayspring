#!/usr/bin/env node
/**
 * Capture the App Store *listing* screenshots — the marketing gallery a browser
 * sees before deciding, not the IAP review shot.
 *
 *   npm run screenshots:appstore-listing
 *
 * Output: assets/appstore/listing/<size>/NN-name.png
 *
 * Deliberately standalone rather than a refactor of
 * capture-appstore-screenshots.mjs: that script produced the IAP review asset
 * already uploaded to App Store Connect, and sharing helpers would mean
 * re-running it — regenerating a submitted image for no benefit.
 *
 * Each shot renders the real components through the dev-only `?__preview=` route
 * (src/features/appstore/preview.tsx), so what gets uploaded is always what
 * ships. Caption copy lives in src/features/appstore/shots.ts.
 */

import { spawn, execFileSync } from 'node:child_process'
import { mkdir, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT_DIR = path.join(ROOT, 'assets/appstore/listing')
const PORT = 5184 // 5183 belongs to the IAP capture; neither may fight `npm run dev`

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]

/**
 * App Store Connect's current default slot for new submissions is 6.9"; 6.5" is
 * still accepted and is what the existing IAP asset uses. Filling both avoids a
 * missing-required-size block at submission and any upscaling artifacts.
 *
 * Both CSS widths (660, 642) clear two constraints at once: above the ~640px
 * macOS minimum window width (below it Chrome lays out at the minimum while
 * still cropping to --window-size, silently slicing the right edge off), and
 * below useIsMobile()'s 767px breakpoint, so the app renders its phone layout.
 *
 * @see https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
 */
const SIZES = [
  { dir: '6.9', width: 1320, height: 2868, platform: 'iphone' }, // iPhone 16 Pro Max
  { dir: '6.5', width: 1284, height: 2778, platform: 'iphone' }, // iPhone 11 Pro Max / XS Max
  // The build declares TARGETED_DEVICE_FAMILY = "1,2", so ASC will not accept a
  // submission with an empty iPad slot. 2064x2752 is the iPad 13" portrait spec.
  { dir: 'ipad-13', width: 2064, height: 2752, platform: 'ipad' },
]

/** Frame background — dayspring-site's --ink. Must match ShotFrame.css. */
const BG = [12, 13, 17]

/** Mirrors SHOTS in src/features/appstore/shots.ts. */
const SHOTS = [
  { preview: 'listing-ascent', file: '01-ascent' },
  { preview: 'listing-capture', file: '02-capture' },
  { preview: 'listing-rituals', file: '03-rituals' },
  { preview: 'listing-altar', file: '04-altar' },
  { preview: 'listing-lamp', file: '05-lamp' },
  { preview: 'listing-history', file: '06-history' },
  { preview: 'listing-devices', file: '07-devices' },
]

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

function capture(chrome, url, outFile, size) {
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
      // The cross-device shot's phone pane shows the voice sheet, which
      // auto-starts dictation on mount. Without a fake capture device it lands
      // in its "couldn't reach the microphone" state.
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--force-device-scale-factor=2',
      `--window-size=${size.width / 2},${size.height / 2}`,
      `--screenshot=${outFile}`,
      url,
    ])
    proc.on('error', reject)
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`chrome exited ${code}`))))
  })
}

function finalizePng(outFile, size) {
  // Guarantee exact Apple dimensions, RGB, no alpha (ASC rejects transparency).
  execFileSync(
    'python3',
    [
      '-c',
      `
from PIL import Image
path = ${JSON.stringify(outFile)}
target = (${size.width}, ${size.height})
bg = (${BG.join(', ')})
with Image.open(path) as im:
    rgba = im.convert('RGBA')
    flat = Image.new('RGB', rgba.size, bg)
    flat.paste(rgba, mask=rgba.split()[3])
    if flat.size != target:
        ratio = target[0] / flat.width
        resized = flat.resize((target[0], round(flat.height * ratio)), Image.LANCZOS)
        canvas = Image.new('RGB', target, bg)
        if resized.height >= target[1]:
            canvas.paste(resized.crop((0, 0, target[0], target[1])), (0, 0))
        else:
            canvas.paste(resized, (0, 0))
        flat = canvas
    flat.save(path, 'PNG')
print('   ', flat.size, flat.mode)
`.trim(),
    ],
    { stdio: 'inherit' },
  )
}

async function main() {
  const chrome = await findChrome()
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const shots = only.length ? SHOTS.filter((s) => only.some((o) => s.file.includes(o))) : SHOTS
  if (!shots.length) throw new Error(`No shots matched: ${only.join(', ')}`)

  console.log(`Starting dev server on :${PORT}…`)
  const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  })

  try {
    await waitForServer(`http://localhost:${PORT}/`)
    for (const size of SIZES) {
      const dir = path.join(OUT_DIR, size.dir)
      await mkdir(dir, { recursive: true })
      console.log(`\n${size.dir}" — ${size.width}x${size.height}`)
      // 07 is a phone-and-Mac composite; on an iPad sheet it argues the wrong
      // thing, so the iPad set closes on the year list instead.
      const forSize = size.platform === 'ipad' ? shots.filter((s) => s.preview !== 'listing-devices') : shots
      for (const shot of forSize) {
        const out = path.join(dir, `${shot.file}.png`)
        const q = size.platform === 'ipad' ? '&platform=ipad' : ''
        await capture(chrome, `http://localhost:${PORT}/?__preview=${shot.preview}${q}`, out, size)
        console.log(`  ${path.relative(ROOT, out)}`)
        finalizePng(out, size)
      }
    }
    console.log('\nDone. Upload both sizes in App Store Connect → Previews and Screenshots.')
  } finally {
    vite.kill()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
