#!/usr/bin/env node

import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { access, copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CREATIVE_DIR = path.join(ROOT, 'assets/marketing/facebook-page')
const OUTPUT_DIR = path.join(CREATIVE_DIR, 'exports')
const PORT = 5192

const COVER_SIZE = { width: 1200, height: 630 }
const PROFILE_ICON_SOURCE = path.join(ROOT, 'public/icons/icon-1024.png')

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/opt/pw-browsers/chromium',
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
      const pathname =
        url.pathname === '/' ? '/assets/marketing/facebook-page/template.html' : url.pathname
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
      `--user-data-dir=/tmp/dayspring-fb-page-chrome-${process.pid}`,
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

async function main() {
  const chrome = await findChrome()
  const server = await startServer()

  try {
    await mkdir(OUTPUT_DIR, { recursive: true })

    const coverFile = path.join(OUTPUT_DIR, 'cover.png')
    const coverUrl = `http://127.0.0.1:${PORT}/assets/marketing/facebook-page/template.html`
    await capture(chrome, coverUrl, coverFile, COVER_SIZE)
    const actual = await pngDimensions(coverFile)
    if (actual.width !== COVER_SIZE.width || actual.height !== COVER_SIZE.height) {
      throw new Error(
        `${path.relative(ROOT, coverFile)} is ${actual.width}x${actual.height}; ` +
          `expected ${COVER_SIZE.width}x${COVER_SIZE.height}`,
      )
    }
    console.log(path.relative(ROOT, coverFile))

    const profileIconFile = path.join(OUTPUT_DIR, 'profile-icon.png')
    await copyFile(PROFILE_ICON_SOURCE, profileIconFile)
    console.log(path.relative(ROOT, profileIconFile))
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
