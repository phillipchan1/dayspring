#!/usr/bin/env node
/**
 * Capture the App Store Connect "Review Information" screenshots.
 *
 * App Review requires a screenshot showing the in-app purchase, and the most
 * common rejection for a subscription app is a reviewer who cannot find the
 * paywall. Producing that shot by hand means a provisioned device, a signed-in
 * account and a deliberately expired trial — enough friction that the image
 * silently goes stale every time the paywall changes. This renders the real
 * components through the dev server's `?__preview=` route instead.
 *
 *   npm run screenshots:appstore
 *
 * Output: assets/appstore/*.png
 */

import { spawn, execFileSync } from 'node:child_process'
import { mkdir, access } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT_DIR = path.join(ROOT, 'assets/appstore')
const PORT = 5183 // off the normal dev port so this never fights `npm run dev`

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]

/**
 * iPhone 6.5" portrait — an accepted App Store / IAP review screenshot size.
 * IAP Review Information requires a screenshot that meets *any* size your app
 * supports (not the old 640×920 minimum). See Apple's screenshot specifications:
 * https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
 *
 * 642 CSS px at 2× = 1284×2778.
 *
 * Do NOT drop width below ~640 CSS px. macOS enforces a ~500px minimum window
 * width, and Chrome lays out at that minimum while still cropping to
 * --window-size — which silently slices the right-hand side off the auto-renew
 * disclosure.
 */
const OUTPUT = { width: 1284, height: 2778 }
const VIEWPORT = {
  width: OUTPUT.width / 2,
  height: OUTPUT.height / 2,
  scale: 2,
}

const SHOTS = [
  { name: 'iap-review-screenshot', preview: 'locked' },
  { name: 'paywall', preview: 'paywall' },
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
  throw new Error(
    `No Chrome/Chromium found. Looked in:\n  ${CHROME_CANDIDATES.join('\n  ')}`,
  )
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

function capture(chrome, url, outFile) {
  return new Promise((resolve, reject) => {
    const proc = spawn(chrome, [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      // The app boots asynchronously (fonts, dynamic import of the preview
      // module). Without a virtual time budget Chrome shoots a blank page.
      '--virtual-time-budget=15000',
      '--run-all-compositor-stages-before-draw',
      `--force-device-scale-factor=${VIEWPORT.scale}`,
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      `--screenshot=${outFile}`,
      url,
    ])
    proc.on('error', reject)
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`chrome exited ${code}`))))
  })
}

/**
 * True when Chrome already produced exactly what App Store Connect wants.
 *
 * It usually does: the viewport above is the output size divided by the scale
 * factor, and every surface we shoot paints an opaque background, so there is no
 * alpha to flatten. The PNG header is enough to tell — IHDR carries width and
 * height at bytes 16..24, and byte 25 is the colour type (2 = RGB, no alpha).
 */
function alreadyCorrect(outFile) {
  const head = readFileSync(outFile).subarray(0, 26)
  if (head.toString('ascii', 1, 4) !== 'PNG') return false
  return (
    head.readUInt32BE(16) === OUTPUT.width &&
    head.readUInt32BE(20) === OUTPUT.height &&
    head[25] === 2
  )
}

function finalizePng(outFile) {
  // Pillow is the belt-and-braces path here, not the load-bearing one. It is
  // absent on plenty of Macs, and on any machine where `python3` is the Xcode
  // stub it dies asking for a licence agreement — a poor thing to discover the
  // evening a rejection needs answering. Skip it when there is demonstrably
  // nothing left to do; still fail loudly if the image really needs the work.
  if (alreadyCorrect(outFile)) {
    console.log('    (already ' + OUTPUT.width + 'x' + OUTPUT.height + ' RGB — nothing to convert)')
    return
  }

  // Guarantee exact Apple dimensions, RGB, no alpha (ASC rejects transparency).
  execFileSync(
    'python3',
    [
      '-c',
      `
from PIL import Image
path = ${JSON.stringify(outFile)}
target = (${OUTPUT.width}, ${OUTPUT.height})
bg = (20, 18, 16)  # dusk theme base — matches paywall preview
with Image.open(path) as im:
    rgba = im.convert('RGBA')
    flat = Image.new('RGB', rgba.size, bg)
    flat.paste(rgba, mask=rgba.split()[3])
    if flat.size != target:
        # Scale to fit width, pad vertically (paywall is top-aligned content)
        ratio = target[0] / flat.width
        resized = flat.resize((target[0], round(flat.height * ratio)), Image.LANCZOS)
        canvas = Image.new('RGB', target, bg)
        if resized.height >= target[1]:
            canvas.paste(resized.crop((0, 0, target[0], target[1])), (0, 0))
        else:
            canvas.paste(resized, (0, 0))
        flat = canvas
    flat.save(path, 'PNG')
print(flat.size, flat.mode)
`.trim(),
    ],
    { stdio: 'inherit' },
  )
}

async function main() {
  const chrome = await findChrome()
  await mkdir(OUT_DIR, { recursive: true })

  console.log(`Starting dev server on :${PORT}…`)
  const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  })

  try {
    await waitForServer(`http://localhost:${PORT}/`)
    for (const shot of SHOTS) {
      const out = path.join(OUT_DIR, `${shot.name}.png`)
      await capture(chrome, `http://localhost:${PORT}/?__preview=${shot.preview}`, out)
      finalizePng(out)
      console.log(`  ${path.relative(ROOT, out)}`)
    }
    console.log(
      `\nDone — ${OUTPUT.width}x${OUTPUT.height} (iPhone 6.5" portrait, IAP review size).`,
    )
  } finally {
    vite.kill()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
