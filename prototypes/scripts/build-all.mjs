#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const manifest = JSON.parse(readFileSync(join(root, 'prototypes.json'), 'utf8'))

const dist = join(root, 'dist')
rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

for (const p of manifest.prototypes) {
  if (p.status === 'archived') continue
  const dir = join(root, p.slug)
  if (!existsSync(join(dir, 'package.json'))) {
    console.warn(`skip ${p.slug}: no package.json`)
    continue
  }

  console.log(`\n→ ${p.slug}`)
  if (!existsSync(join(dir, 'node_modules'))) {
    execSync('npm install', { cwd: dir, stdio: 'inherit' })
  }
  execSync('npm run build', {
    cwd: dir,
    stdio: 'inherit',
    env: { ...process.env, PROTOTYPE_BASE: `/${p.slug}/` },
  })

  const out = join(dir, 'dist')
  cpSync(out, join(dist, p.slug), { recursive: true })
}

writeHub(dist, manifest)

console.log('\n✓ prototypes dist ready')

function writeHub(outDir, cfg) {
  const listed = cfg.prototypes.filter((p) => p.status !== 'archived' && p.listed !== false)
  const items = listed
    .map((p) => {
      const hash = p.startHash ? `#${p.startHash}` : ''
      const path = `/${p.slug}/${hash}`
      const sub = `https://${p.slug}.prototypes.usedayspring.app/${hash}`
      const desc = p.description ? `<p class="desc">${escapeHtml(p.description)}</p>` : ''
      return `<li>
  <a href="${path}"><strong>${escapeHtml(p.title)}</strong></a>
  ${desc}
  <p class="alt"><a href="${sub}">${p.slug}.prototypes.usedayspring.app</a></p>
</li>`
    })
    .join('\n')

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Dayspring prototypes</title>
  <style>
    body { font-family: Georgia, serif; background: #f6f1e8; color: #2a2118; margin: 0; padding: 2.5rem 1.25rem; }
    main { max-width: 34rem; margin: 0 auto; }
    h1 { font-size: 1.35rem; font-weight: 500; margin: 0 0 0.5rem; }
    .lede { color: #6b5f4f; margin: 0 0 1.75rem; line-height: 1.55; }
    ul { list-style: none; padding: 0; margin: 0; }
    li { background: #fffcf7; border: 1px solid #e8dfd0; border-radius: 8px; padding: 1rem 1.1rem; margin-bottom: 0.75rem; }
    a { color: #3d3428; }
    .desc { margin: 0.35rem 0 0; color: #6b5f4f; font-size: 0.95rem; line-height: 1.5; }
    .alt { margin: 0.5rem 0 0; font-size: 0.82rem; }
    .alt a { color: #8a7c69; }
  </style>
</head>
<body>
  <main>
    <h1>Dayspring prototypes</h1>
    <p class="lede">Click-through mockups for beta feedback. Not the live app.</p>
    <ul>
${items || '      <li>No listed prototypes.</li>'}
    </ul>
  </main>
</body>
</html>`

  writeFileSync(join(outDir, 'index.html'), html)
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
