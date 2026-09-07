#!/usr/bin/env node
import { cpSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const slug = process.argv[2]?.trim().toLowerCase()
const titleArg = process.argv.slice(3).join(' ').trim()
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('Usage: npm run prototype:new <slug> [title]')
  process.exit(1)
}

const title =
  titleArg ||
  slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const target = join(root, slug)
const template = join(root, '_template')

if (existsSync(target)) {
  console.error(`Already exists: prototypes/${slug}`)
  process.exit(1)
}

cpSync(template, target, { recursive: true })
replaceInTree(target, { __SLUG__: slug, __TITLE__: title })

const pkgPath = join(target, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
pkg.name = `dayspring-${slug}-prototype`
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

const manifestPath = join(root, 'prototypes.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
if (!manifest.prototypes.some((p) => p.slug === slug)) {
  manifest.prototypes.push({
    slug,
    title,
    status: 'draft',
    listed: false,
    hasFeedback: true,
    startHash: 'intro',
  })
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
}

console.log(`Created prototypes/${slug}`)
console.log(`  cd prototypes/${slug} && npm install && npm run dev`)

function replaceInTree(dir, map) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      replaceInTree(path, map)
      continue
    }
    if (!/\.(tsx?|json|md|html|css|mjs)$/.test(name)) continue
    let text = readFileSync(path, 'utf8')
    for (const [from, to] of Object.entries(map)) {
      text = text.split(from).join(to)
    }
    writeFileSync(path, text)
  }
}
