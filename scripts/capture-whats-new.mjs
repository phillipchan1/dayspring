#!/usr/bin/env node
/**
 * Capture the pictures for the "Open your Bible" What's new deck (internal name:
 * First Light) and for the email that goes with it.
 *
 *   npm i --no-save playwright-core     # once; not a repo dependency
 *   npm run whatsnew:assets
 *
 * Output (same two files in two places):
 *   open-your-bible.jpg  slide 1 — the composer as it looks: the chapter on the
 *                        left, the page on the right, a quote carried across
 *   open-your-bible.gif  slide 2 — how to start it, with a caption on each step
 *
 *   src/features/firstlight/assets/   bundled into the app, imported by the deck
 *   site/public/email/whats-new/      served at
 *                                     https://www.usedayspring.app/email/whats-new/…
 *                                     for the email. Not the app's public/ — that
 *                                     ships inside the Mac and iPhone bundles.
 *
 * It drives the REAL app through the dev-only `?__preview=ritual&blank=1`
 * harness: blank page → the "Open your Bible" door → the finder → a chapter →
 * select words → Return. Nothing is mocked. The passage text is the harness's
 * public-domain fixture (WEB), not the licensed ESV — which is also why these
 * images are safe to publish. No real journal is ever in a public asset.
 *
 * The first frame of the GIF is what Outlook desktop shows forever, so it is the
 * calm blank page with the door in view.
 */

import { spawn, execFileSync } from 'node:child_process'
import { mkdir, writeFile, rm, mkdtemp, copyFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT_DIRS = [
  path.join(ROOT, 'src/features/firstlight/assets'),
  path.join(ROOT, 'site/public/email/whats-new'),
]
const PORT = Number(process.env.WHATSNEW_CAPTURE_PORT || 5204)
const BASE = `http://localhost:${PORT}`
const THEME = 'dawn'
const VIEW = { width: 1100, height: 680 }
const GIF_WIDTH = 760
const NAME = 'open-your-bible'

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/opt/pw-browsers/chromium',
].filter(Boolean)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const exists = (p) => access(p).then(() => true, () => false)

async function startServer() {
  try {
    const res = await fetch(BASE)
    if (res.ok) return () => {}
  } catch {
    /* not running — start our own */
  }
  const child = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    await sleep(500)
    try {
      if ((await fetch(BASE)).ok) return () => child.kill()
    } catch {
      /* keep waiting */
    }
  }
  child.kill()
  throw new Error(`dev server did not come up on ${PORT}`)
}

/** The step caption: a small pill at the top, so it never covers the shelf. */
async function caption(page, n, text) {
  await page.evaluate(
    ([num, label]) => {
      let el = document.getElementById('wn-caption')
      if (!el) {
        el = document.createElement('div')
        el.id = 'wn-caption'
        el.style.cssText =
          'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:10px;' +
          'padding:8px 18px 8px 9px;border-radius:999px;background:rgba(42,33,24,.93);color:#fbf6ee;' +
          'font:500 15px/1 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 10px 28px -10px rgba(0,0,0,.5);white-space:nowrap'
        document.body.appendChild(el)
      }
      el.innerHTML =
        `<b style="display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#c2683a;color:#fff;font:700 12px/1 system-ui,sans-serif">${num}</b>` +
        `<span>${label}</span>`
    },
    [n, text],
  )
}

async function main() {
  let playwright
  try {
    playwright = await import('playwright-core')
  } catch {
    throw new Error('playwright-core is not installed. Run: npm i --no-save playwright-core')
  }
  let executablePath
  for (const c of CHROME_CANDIDATES) if (await exists(c)) { executablePath = c; break }

  const stopServer = await startServer()
  const work = await mkdtemp(path.join(tmpdir(), 'whatsnew-'))
  const browser = await playwright.chromium.launch(executablePath ? { executablePath } : {})
  try {
    const page = await browser.newPage({ viewport: VIEW })
    await page.goto(`${BASE}/?__preview=ritual&blank=1&theme=${THEME}&hour=9`)
    await page.waitForSelector('text=Open your Bible')
    await sleep(1200)

    const frames = []
    let n = 0
    const snap = async (holdMs, settleMs = 120) => {
      await sleep(settleMs)
      const file = path.join(work, `f-${String(n++).padStart(3, '0')}.png`)
      await page.screenshot({ path: file })
      frames.push({ file, holdMs })
      return file
    }

    // 1 — the door, on a blank page.
    await caption(page, 1, 'Choose Open your Bible')
    const door = page.getByText('Open your Bible').first()
    await door.hover()
    await snap(1500, 250)
    await door.click()

    // 2 — the finder: type a reference, or pick a passage.
    const input = page.locator('input').first()
    await input.waitFor()
    await caption(page, 2, 'Type a reference, or pick a passage')
    await snap(1400, 500)
    for (const upTo of ['Jo', 'John 1']) {
      await input.fill(upTo)
      await snap(260, 60)
    }
    await input.fill('John 15')
    await snap(900, 60)
    await input.press('Enter')

    // 3 — the page opens beside the chapter. Select words, press Return.
    // Choosing a chapter opens on the Read stop and eases to the first writing
    // movement; photograph the settled page, not the crossfade.
    await page.waitForSelector('text=Write whatever comes')
    await page.waitForSelector('text=Read it slowly', { state: 'detached' })
    await caption(page, 3, 'Select words, then press Return')
    await snap(1500, 700)
    // The first line of verse 1, "I am the true vine". The viewport is fixed, so
    // the line sits at a fixed place; getByText would also match the editor
    // that is hidden behind the composer.
    const y = 346
    await page.mouse.move(64, y)
    await page.mouse.down()
    await page.mouse.move(198, y, { steps: 14 })
    await page.waitForSelector('text=Reflect on this')
    await snap(1600, 300)
    await page.mouse.up()
    await page.keyboard.press('Enter')
    await sleep(700)
    await snap(1300, 200)
    let typed = ''
    for (const chunk of ['Rooted', ' in him.', ' Nothing without him.']) {
      await page.keyboard.type(chunk, { delay: 35 })
      typed += chunk
      await snap(typed.length < 20 ? 300 : 3200, 150)
    }

    // The still for slide 1: the finished state, without the caption.
    await page.evaluate(() => document.getElementById('wn-caption')?.remove())
    await sleep(200)
    const still = path.join(work, 'still.png')
    await page.screenshot({ path: still })

    for (const dir of OUT_DIRS) await mkdir(dir, { recursive: true })
    const jpg = path.join(OUT_DIRS[0], `${NAME}.jpg`)
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', still, '-vf', 'scale=1000:-1:flags=lanczos', '-q:v', '4', jpg])

    const list = path.join(work, 'frames.txt')
    const lines = frames.flatMap((f) => [`file '${f.file}'`, `duration ${(f.holdMs / 1000).toFixed(3)}`])
    lines.push(`file '${frames[frames.length - 1].file}'`)
    await writeFile(list, lines.join('\n'))
    const gif = path.join(OUT_DIRS[0], `${NAME}.gif`)
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
      '-vf', `scale=${GIF_WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
      '-loop', '0', gif,
    ])
    for (const dir of OUT_DIRS.slice(1)) {
      await copyFile(jpg, path.join(dir, `${NAME}.jpg`))
      await copyFile(gif, path.join(dir, `${NAME}.gif`))
    }
    console.log('wrote', jpg, 'and', gif, '(+ copies in', OUT_DIRS.slice(1).join(', ') + ')')
  } finally {
    await browser.close()
    stopServer()
    await rm(work, { recursive: true, force: true })
  }
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
