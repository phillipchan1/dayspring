#!/usr/bin/env node
/**
 * Capture every image in the welcome email series.
 *
 *   npm run email:welcome:assets                 # everything
 *   npm run email:welcome:assets -- --only=slash # one asset, while iterating
 *
 * Output: site/public/email/welcome/<id>.jpg|gif, served by the marketing site
 * at https://www.usedayspring.app/email/welcome/<id>.*, which is where every
 * <img> in marketing/email/welcome/templates/ points. The marketing site, not
 * the app: `public/` in the app would ship these inside the Mac and iPhone
 * bundles. Plus CONTACT_SHEET.png in marketing/email/welcome/ to eyeball the
 * whole set at once.
 *
 * How it works, and why it isn't capture-flagship.mjs:
 *   1. The SURFACE is rendered by the real app through the dev-only preview
 *      routes (listing-*&raw=1, flagship&raw=1, email-*), against fixtures.
 *   2. It is screenshotted over the DevTools protocol, not `--screenshot`, so
 *      the GIF can be driven with real keystrokes — `/`, then `pray`, then
 *      Enter — and photographed between them.
 *   3. Stills are then set into a FRAME (eyebrow, headline, surface in a card)
 *      rendered from plain HTML with the brand's own font files, so the type
 *      in an email image is real Fraunces, not a Pillow approximation.
 *
 * No dependencies beyond Chrome, ffmpeg and Pillow; Node's built-in WebSocket
 * talks to Chrome. Sample content is fabricated; no real journal is ever in a
 * public asset.
 */

import { spawn, execFileSync } from 'node:child_process'
import { mkdir, access, writeFile, rm, mkdtemp } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import path from 'node:path'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT_DIR = path.join(ROOT, 'site/public/email/welcome')
const SHEET = path.join(ROOT, 'marketing/email/welcome/CONTACT_SHEET.png')
// 5183–5188 belong to the other capture scripts. A dev server already on 5203
// is reused; otherwise the script starts (and stops) its own.
const PORT = Number(process.env.EMAIL_CAPTURE_PORT || 5203)
const BASE = `http://localhost:${PORT}`
const CDP_PORT = 9339
const DSF = 2

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]

/**
 * Every still: which scene to photograph, at what CSS size, and the words the
 * frame sets above it. Copy follows docs/product/BRANDSCRIPT.md — no journey,
 * unlock, track, streak, insights, AI-powered.
 */
const STILLS = [
  {
    id: 'page',
    url: '/?__preview=email-page&theme=dawn',
    viewport: { w: 1100, h: 640 },
    eyebrow: 'Welcome to Dayspring',
    lead: 'A blank page,',
    accent: 'and a quiet place to begin.',
  },
  {
    id: 'rituals',
    url: '/?__preview=listing-rituals&raw=1',
    viewport: { w: 560, h: 900 },
    // Past the library's greeting and chips, onto the named forms.
    cropTop: 330,
    eyebrow: 'Rituals',
    lead: "When you don't know where to",
    accent: 'begin.',
  },
  {
    id: 'altar',
    url: '/?__preview=listing-altar&raw=1',
    viewport: { w: 560, h: 640 },
    // Past the surface's own title and subtitle; the frame already names it.
    cropTop: 150,
    eyebrow: 'The Altar',
    lead: 'Your prayers,',
    accent: 'gathered.',
  },
  {
    id: 'lamp',
    url: '/?__preview=listing-lamp&raw=1',
    viewport: { w: 560, h: 560 },
    eyebrow: 'The Lamp',
    lead: 'The verses that',
    accent: 'kept finding you.',
  },
  {
    // Not the Summit's lone mountain: a new writer needs to see the promise,
    // which is their own lines quoted back. The year ledger's thread does that.
    id: 'ascent',
    url: '/?__preview=ledger',
    viewport: { w: 700, h: 700 },
    prepare: `(async () => {
      const t = [...document.querySelectorAll('.ascent *')].find(
        (e) => e.children.length === 0 && e.textContent.trim() === 'Tom and the elders')
      const sc = document.querySelector('.ascent')
      sc.scrollTop += t.getBoundingClientRect().top - 36
      await new Promise((r) => setTimeout(r, 400))
      return true
    })()`,
    cardMax: 420,
    eyebrow: 'The Ascent',
    lead: 'What you wrote,',
    accent: 'told back.',
  },
]

// ── Chrome over the DevTools protocol ────────────────────────────────────────

async function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    try {
      await access(c)
      return c
    } catch {
      /* next */
    }
  }
  throw new Error('No Chrome/Chromium found')
}

async function launchChrome(chrome, profileDir) {
  const proc = spawn(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--mute-audio',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    // file:// frame pages load their fonts and the surface PNG beside them.
    '--allow-file-access-from-files',
    'about:blank',
  ])
  const deadline = Date.now() + 15_000
  for (;;) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page) return { proc, wsUrl: page.webSocketDebuggerUrl }
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error('Chrome DevTools never came up')
    await sleep(200)
  }
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  const listeners = new Set()
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(`${msg.error.message}`)) : resolve(msg.result)
    } else if (msg.method) {
      for (const l of listeners) l(msg)
    }
  }
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id
      pending.set(n, { resolve, reject })
      ws.send(JSON.stringify({ id: n, method, params }))
    })
  const once = (method) =>
    new Promise((resolve) => {
      const l = (msg) => {
        if (msg.method === method) {
          listeners.delete(l)
          resolve(msg.params)
        }
      }
      listeners.add(l)
    })
  return { ready, send, once, close: () => ws.close() }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function setViewport(cdp, { w, h }) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: w,
    height: h,
    deviceScaleFactor: DSF,
    // Desktop, not mobile: the `/` palette is the hardware-keyboard door. A
    // mobile emulation gets the bottom sheet instead.
    mobile: false,
  })
}

async function navigate(cdp, url) {
  const loaded = cdp.once('Page.loadEventFired')
  await cdp.send('Page.navigate', { url })
  await loaded
}

async function evaluate(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  return r.result?.value
}

async function waitFor(cdp, expression, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await evaluate(cdp, `Boolean(${expression})`)) return
    await sleep(120)
  }
  throw new Error(`Timed out waiting for: ${expression}`)
}

/** Fonts, CodeMirror measure, and any entrance transitions. */
async function settle(cdp, ms = 900) {
  await evaluate(cdp, 'document.fonts.ready.then(() => true)')
  await sleep(ms)
}

async function shoot(cdp, file, clip) {
  const params = { format: 'png', captureBeyondViewport: false }
  if (clip) params.clip = { ...clip, scale: 1 }
  const { data } = await cdp.send('Page.captureScreenshot', params)
  await writeFile(file, Buffer.from(data, 'base64'))
}

async function key(cdp, k) {
  const named = {
    Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
    ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 },
  }[k]
  const d = named ?? {
    key: k,
    text: k,
    code: k === '/' ? 'Slash' : `Key${k.toUpperCase()}`,
    windowsVirtualKeyCode: k === '/' ? 191 : k.toUpperCase().charCodeAt(0),
  }
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...d })
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: d.key, code: d.code, windowsVirtualKeyCode: d.windowsVirtualKeyCode })
}

// ── Stills, set into the frame ───────────────────────────────────────────────

const FONT_DIR = path.join(ROOT, 'marketing/ads/fonts')
const FRAUNCES_300 = path.join(ROOT, 'node_modules/@fontsource/fraunces/files/fraunces-latin-300-normal.woff2')

function frameHtml(still, surfaceFile) {
  const f = (p) => pathToFileURL(p).href
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Fraunces;font-weight:300;font-style:normal;src:url(${f(FRAUNCES_300)})}
@font-face{font-family:Fraunces;font-weight:300;font-style:italic;src:url(${f(path.join(FONT_DIR, 'fraunces-300-italic.woff2'))})}
@font-face{font-family:Mono;src:url(${f(path.join(FONT_DIR, 'mono-400.woff2'))})}
html,body{margin:0;background:#12131a}
.frame{width:600px;box-sizing:border-box;padding:34px 36px 0;
  background:radial-gradient(120% 70% at 18% -8%, rgba(196,145,60,.30), rgba(196,145,60,0) 60%),
             linear-gradient(180deg,#1a1812 0%,#12131a 46%);
  color:#f3ece0;font-family:Fraunces,Georgia,serif;overflow:hidden}
.eyebrow{font-family:Mono,monospace;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#d9a35a;margin:0 0 12px}
h1{font-weight:300;font-size:38px;line-height:1.08;margin:0 0 26px;letter-spacing:-.01em}
h1 em{font-style:italic;background:linear-gradient(90deg,#e7b673,#c4913c 70%);-webkit-background-clip:text;color:transparent}
.card{position:relative;border-radius:14px 14px 0 0;overflow:hidden;
  box-shadow:0 -1px 0 rgba(255,255,255,.08),0 24px 60px rgba(0,0,0,.55);height:${still.cardH}px}
.card img{display:block;width:100%;margin-top:${-(still.cropTop ?? 0) * still.scale}px}
.card:after{content:'';position:absolute;left:0;right:0;bottom:0;height:70px;
  background:linear-gradient(180deg,rgba(18,19,26,0),#12131a)}
</style></head><body><div class="frame" id="frame">
<p class="eyebrow">${still.eyebrow}</p>
<h1>${still.lead} <em>${still.accent}</em></h1>
<div class="card"><img src="${f(surfaceFile)}"></div>
</div></body></html>`
}

async function captureStill(cdp, still, work) {
  console.log(`→ ${still.id}`)
  await setViewport(cdp, still.viewport)
  await navigate(cdp, `${BASE}${still.url}`)
  if (still.url.includes('email-')) await waitFor(cdp, `document.documentElement.dataset.emailReady`)
  await settle(cdp, 1400)
  if (still.prepare) await evaluate(cdp, still.prepare)
  const surface = path.join(work, `${still.id}-surface.png`)
  await shoot(cdp, surface)

  // The card is 528 CSS px wide; the surface is scaled to fit it.
  const scale = 528 / still.viewport.w
  const visible = still.viewport.h - (still.cropTop ?? 0)
  const cardH = Math.min(Math.round(visible * scale), still.cardMax ?? 360)
  const html = path.join(work, `${still.id}-frame.html`)
  await writeFile(html, frameHtml({ ...still, scale, cardH }, surface))

  await setViewport(cdp, { w: 600, h: 900 })
  await navigate(cdp, pathToFileURL(html).href)
  await settle(cdp, 300)
  const h = await evaluate(cdp, `Math.ceil(document.getElementById('frame').getBoundingClientRect().height)`)
  const framed = path.join(work, `${still.id}-framed.png`)
  await shoot(cdp, framed, { x: 0, y: 0, width: 600, height: h })

  // JPEG at 1200px: a still in an inbox is photographed once and downloaded by
  // every recipient, so 150KB beats a 1MB lossless PNG nobody can tell apart.
  const out = path.join(OUT_DIR, `${still.id}.jpg`)
  py(`
from PIL import Image
im = Image.open(${JSON.stringify(framed)}).convert('RGB')
im.save(${JSON.stringify(out)}, 'JPEG', quality=86, optimize=True, progressive=True)
print('   ', im.size)
`)
  return out
}

// ── The `/` GIF ──────────────────────────────────────────────────────────────

/**
 * A storyboard, not a screen recording: act, let it settle, photograph, and
 * give that frame its own hold. Typing gets short holds so it reads as typing;
 * the open palette and the finished prayer get long ones so they can be read.
 */
async function captureSlashGif(cdp, work) {
  console.log('→ slash (gif)')
  // ≥768 wide or useIsMobile() hands us the phone's bottom sheet, not the palette.
  const vp = { w: 820, h: 540 }
  await setViewport(cdp, vp)
  await navigate(cdp, `${BASE}/?__preview=email-slash&theme=dawn`)
  await waitFor(cdp, `document.documentElement.dataset.emailReady`)
  await settle(cdp, 1200)

  const frames = []
  let n = 0
  const snap = async (holdMs, settleMs = 90) => {
    await sleep(settleMs)
    const file = path.join(work, `slash-${String(n++).padStart(3, '0')}.png`)
    await shoot(cdp, file)
    frames.push({ file, holdMs })
  }

  await snap(1300)
  await key(cdp, '/')
  await waitFor(cdp, `document.querySelector('.slash-palette')`)
  await snap(1900, 260)
  for (const ch of 'pray') {
    await key(cdp, ch)
    await snap(150)
  }
  await snap(900, 200)
  await key(cdp, 'Enter')
  // Prayer opens its own small popover with the field focused.
  await waitFor(cdp, `document.querySelector('[aria-label="Prayer"]')`)
  await snap(700, 350)
  for (const ch of 'Courage for Thursday, and for Dad.') {
    await cdp.send('Input.insertText', { text: ch })
    await snap(ch === ' ' ? 55 : 75, 35)
  }
  await snap(900, 150)
  await key(cdp, 'Enter')
  await waitFor(cdp, `!document.querySelector('[aria-label="Prayer"]')`)
  await snap(3400, 600)

  // The first frame is what Outlook desktop shows forever; it's the calm page
  // with a line already written, which stands alone as a picture.
  return encodeGif(frames, work, 'slash', { colors: 128, dither: 'bayer:bayer_scale=4' })
}

/**
 * ffmpeg concat with per-frame holds, then a palette pass so flat grounds
 * don't band. 900px wide: displayed at 600, sharp on a retina inbox, and still
 * a sane download.
 */
async function encodeGif(frames, work, id, { colors, dither, width = 900 }) {
  const list = path.join(work, `${id}.txt`)
  const lines = frames.flatMap((f) => [`file '${f.file}'`, `duration ${(f.holdMs / 1000).toFixed(3)}`])
  lines.push(`file '${frames[frames.length - 1].file}'`)
  await writeFile(list, lines.join('\n'))
  const out = path.join(OUT_DIR, `${id}.gif`)
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=${dither}:diff_mode=rectangle`,
    '-loop', '0', out,
  ])
  console.log('   ', out)
  return out
}

// ── The Look for concept GIF ─────────────────────────────────────────────────

/**
 * scripts/email-scenes/journal.html is plain HTML with a `scene(typed, p)`
 * hook, so every frame is a state set exactly rather than a moment caught
 * mid-transition. The idle wall is frame one — Outlook's only frame.
 */
async function captureJournalGif(cdp, work) {
  console.log('→ journal (gif)')
  await setViewport(cdp, { w: 600, h: 900 })
  await navigate(cdp, pathToFileURL(path.join(ROOT, 'scripts/email-scenes/journal.html')).href)
  await settle(cdp, 300)
  const h = await evaluate(cdp, `Math.ceil(document.getElementById('frame').getBoundingClientRect().height)`)
  const clip = { x: 0, y: 0, width: 600, height: h }

  const frames = []
  let n = 0
  const snap = async (typed, p, holdMs) => {
    await evaluate(cdp, `window.scene(${JSON.stringify(typed)}, ${p})`)
    const file = path.join(work, `journal-${String(n++).padStart(3, '0')}.png`)
    await shoot(cdp, file, clip)
    frames.push({ file, holdMs })
  }

  await snap(null, 0, 1500)
  await snap('', 0, 500)
  for (const t of ['D', 'Da', 'Dad']) await snap(t, 0, 200)
  await snap('Dad', 0, 250)
  const STEPS = 5
  for (let i = 1; i <= STEPS; i++) {
    // ease-out: most of the dimming happens early, then it settles.
    const t = i / STEPS
    await snap('Dad', 1 - (1 - t) ** 3, 55)
  }
  await snap('Dad', 1, 3800)
  // Back to the full wall before the loop restarts, not a hard cut.
  await snap('Dad', 0.5, 60)

  // Every fade frame repaints most of the wall, so frames and dithering are
  // what the size is made of: few fade steps, and no dither — the UI is flat
  // colour, and the one gradient (the header's glow) never changes, so it is
  // only encoded once.
  return encodeGif(frames, work, 'journal', { colors: 256, dither: 'none', width: 800 })
}

// ── Plumbing ─────────────────────────────────────────────────────────────────

function py(code) {
  execFileSync('python3', ['-c', code.trim()], { stdio: 'inherit' })
}

async function serverUp() {
  try {
    return (await fetch(BASE)).ok
  } catch {
    return false
  }
}

async function main() {
  const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]
  await mkdir(OUT_DIR, { recursive: true })
  await mkdir(path.dirname(SHEET), { recursive: true })

  let vite = null
  if (!(await serverUp())) {
    console.log(`Starting vite on ${PORT}…`)
    vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' })
    const deadline = Date.now() + 60_000
    while (!(await serverUp())) {
      if (Date.now() > deadline) throw new Error('vite never came up')
      await sleep(400)
    }
  }

  const work = await mkdtemp(path.join(tmpdir(), 'welcome-email-'))
  const { proc, wsUrl } = await launchChrome(await findChrome(), path.join(work, 'profile'))
  const cdp = connect(wsUrl)
  await cdp.ready
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  const outputs = []
  try {
    for (const still of STILLS) {
      if (only && only !== still.id) continue
      outputs.push(await captureStill(cdp, still, work))
    }
    if (!only || only === 'slash') outputs.push(await captureSlashGif(cdp, work))
    if (!only || only === 'journal') outputs.push(await captureJournalGif(cdp, work))
  } finally {
    cdp.close()
    const exited = new Promise((r) => proc.once('exit', r))
    proc.kill()
    await exited
    vite?.kill()
  }

  if (!only) {
    // The GIF's first frame stands in for it on the sheet.
    py(`
from PIL import Image
files = ${JSON.stringify(outputs)}
cell, pad, cols = 420, 16, 4
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols*cell + pad*(cols+1), rows*cell + pad*(rows+1)), (24,25,31))
for i, f in enumerate(files):
    im = Image.open(f).convert('RGB'); im.thumbnail((cell, cell), Image.LANCZOS)
    x = pad + (i % cols)*(cell+pad) + (cell-im.width)//2
    y = pad + (i // cols)*(cell+pad) + (cell-im.height)//2
    sheet.paste(im, (x, y))
sheet.save(${JSON.stringify(SHEET)})
print('   contact sheet', sheet.size)
`)
  }
  // Chrome can still be flushing its profile a beat after exit.
  await rm(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {})
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
