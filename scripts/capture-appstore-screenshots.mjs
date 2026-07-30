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

import { spawn } from 'node:child_process'
import { mkdir, access } from 'node:fs/promises'
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
 * 640 CSS px at 2x = 1280x2000, clearing Apple's 640x920 minimum.
 *
 * Do NOT drop this to a true phone width. macOS enforces a minimum window
 * width of roughly 500px, and Chrome lays out at that minimum while still
 * cropping the capture to --window-size — which silently slices the right-hand
 * side off the auto-renew disclosure. The clipped text is easy to miss and is
 * exactly the copy App Review is checking for.
 */
const VIEWPORT = { width: 640, height: 1000, scale: 2 }

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
      console.log(`  ${path.relative(ROOT, out)}`)
    }
    console.log(
      `\nDone — ${VIEWPORT.width * VIEWPORT.scale}x${VIEWPORT.height * VIEWPORT.scale}, ` +
        'above Apple’s 640x920 minimum.',
    )
  } finally {
    vite.kill()
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
