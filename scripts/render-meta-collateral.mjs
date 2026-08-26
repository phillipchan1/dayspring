#!/usr/bin/env node

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CREATIVE_DIR = path.join(ROOT, 'assets/marketing/meta')
const OUTPUT_DIR = path.join(CREATIVE_DIR, 'exports')
const PORT = 5191

const FORMATS = {
  square: { width: 1080, height: 1080 },
  feed: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
}

const DIRECTION_BOARD = [
  'journaling-growth',
  'long-view',
  'remembered',
  'inner-life',
  'history-read-back',
]

const PRODUCTION_SELECTION = ['journaling-growth', 'history-read-back']

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome-stable',
  '/usr/local/bin/google-chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next known location.
    }
  }
  throw new Error(`Chrome not found. Checked:\n${CHROME_CANDIDATES.join('\n')}`)
}

function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`)
      const pathname = url.pathname === '/' ? '/assets/marketing/meta/template.html' : url.pathname
      const resolved = path.resolve(ROOT, `.${decodeURIComponent(pathname)}`)

      if (!resolved.startsWith(`${ROOT}${path.sep}`)) {
        response.writeHead(403)
        response.end('Forbidden')
        return
      }

      const body = await readFile(resolved)
      response.writeHead(200, {
        'Content-Type': CONTENT_TYPES[path.extname(resolved)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store',
      })
      response.end(body)
    } catch {
      response.writeHead(404)
      response.end('Not found')
    }
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(PORT, '127.0.0.1', () => resolve(server))
  })
}

function capture(chrome, url, outputFile, { width, height }) {
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--hide-scrollbars',
      `--user-data-dir=/tmp/dayspring-meta-chrome-${process.pid}`,
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=6000',
      '--force-device-scale-factor=1',
      `--window-size=${width},${height}`,
      `--screenshot=${outputFile}`,
      url,
    ])

    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Chrome exited ${code}\n${stderr}`))
    })
  })
}

async function pngDimensions(file) {
  const bytes = await readFile(file)
  const signature = bytes.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') throw new Error(`${file} is not a PNG`)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

async function renderOne(chrome, concept, format, outputFile) {
  const size = FORMATS[format]
  await mkdir(path.dirname(outputFile), { recursive: true })
  const url =
    `http://127.0.0.1:${PORT}/assets/marketing/meta/template.html` +
    `?concept=${encodeURIComponent(concept)}&format=${encodeURIComponent(format)}`

  await capture(chrome, url, outputFile, size)
  const actual = await pngDimensions(outputFile)
  if (actual.width !== size.width || actual.height !== size.height) {
    throw new Error(
      `${path.relative(ROOT, outputFile)} is ${actual.width}×${actual.height}; ` +
        `expected ${size.width}×${size.height}`,
    )
  }
  return { concept, format, file: path.relative(ROOT, outputFile), ...actual }
}

async function main() {
  const chrome = await findChrome()
  const server = await startServer()
  const rendered = []

  try {
    for (const [index, concept] of DIRECTION_BOARD.entries()) {
      const output = path.join(
        OUTPUT_DIR,
        'direction-board',
        `${String(index + 1).padStart(2, '0')}-${concept}.png`,
      )
      rendered.push(await renderOne(chrome, concept, 'feed', output))
      console.log(path.relative(ROOT, output))
    }

    for (const concept of PRODUCTION_SELECTION) {
      for (const format of Object.keys(FORMATS)) {
        const output = path.join(OUTPUT_DIR, 'placements', concept, `${format}.png`)
        rendered.push(await renderOne(chrome, concept, format, output))
        console.log(path.relative(ROOT, output))
      }
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      directionBoard: DIRECTION_BOARD,
      productionSelection: PRODUCTION_SELECTION,
      rendered,
    }
    await writeFile(path.join(OUTPUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
