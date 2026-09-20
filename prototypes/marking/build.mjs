// No bundler: this prototype is one self-contained page, because the thing it
// has to demonstrate is a browser selection gesture and nothing else. Build is
// a copy, so `npm run build` still satisfies scripts/build-all.mjs.
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, 'dist')

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })
cpSync(join(here, 'index.html'), join(dist, 'index.html'))

console.log('marking → dist/index.html')
