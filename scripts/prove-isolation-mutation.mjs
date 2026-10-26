#!/usr/bin/env node
/**
 * Mutation proof for access isolation.
 * Asserts the unmutated tree is green, then deletes each owner filter in
 * store.ts on its own and expects access.check to fail.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const storePath = 'worker/src/store.ts'
const originalStore = readFileSync(storePath, 'utf8')

const OWNER_FILTER = /(?:[\w.]+\.)?owner = \$\{store\.ownerId\}/g

function restore() {
  writeFileSync(storePath, originalStore)
}

function runCheck() {
  return spawnSync(process.execPath, ['--experimental-strip-types', 'worker/src/access.check.ts'], {
    encoding: 'utf8',
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
  })
}

function lineOf(source, index) {
  return source.slice(0, index).split('\n').length
}

function collectFilters() {
  const items = []
  OWNER_FILTER.lastIndex = 0
  for (const match of originalStore.matchAll(OWNER_FILTER)) {
    const index = match.index ?? 0
    const lineStart = originalStore.lastIndexOf('\n', index) + 1
    const lineEnd = originalStore.indexOf('\n', index)
    const line = originalStore.slice(lineStart, lineEnd === -1 ? undefined : lineEnd)
    const trimmed = line.trimStart()
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/**')) continue
    items.push({
      path: storePath,
      source: originalStore,
      index,
      text: match[0],
      line: lineOf(originalStore, index),
    })
  }
  return items
}

function neutralize(source, index, text) {
  const before = source.slice(0, index)
  const after = source.slice(index + text.length)
  if (before.endsWith('WHERE ')) return `${before}TRUE${after}`
  return `${before}TRUE${after}`
}

function expectFail(label, mutate) {
  try {
    mutate()
    const res = runCheck()
    const out = `${res.stdout || ''}\n${res.stderr || ''}`.trim()
    console.log(`\n=== ${label} ===`)
    console.log(out)
    if (res.status === 0) {
      throw new Error(`${label}: isolation check still passed — mutation was not detected`)
    }
    const failed = / (\d+) failed/.exec(out)
    console.log(`${label}: failed as expected (exit ${res.status}, ${failed?.[1] ?? '?'} checks failed)`)
  } finally {
    restore()
  }
}

const baseline = runCheck()
const baselineOut = `${baseline.stdout || ''}\n${baseline.stderr || ''}`.trim()
console.log('=== baseline (unmutated) ===')
console.log(baselineOut)
if (baseline.status !== 0) {
  throw new Error('unmutated isolation check must be green before mutations run')
}
console.log('baseline: isolation check green')

const filters = collectFilters()
if (filters.length === 0) {
  throw new Error('no owner filters found in store.ts')
}
console.log(`derived ${filters.length} owner filters:`)
for (const f of filters) console.log(`  store.ts:${f.line} ${f.text}`)

expectFail('M1 delete getEntry owner filter', () => {
  const next = originalStore.replace(
    /WHERE id = \$\{id\}\n\s+AND owner = \$\{store\.ownerId\}/,
    'WHERE id = ${id}',
  )
  if (next === originalStore) throw new Error('M1: could not find getEntry owner filter')
  writeFileSync(storePath, next)
})

expectFail('M2 set owner filters to TRUE', () => {
  writeFileSync(
    storePath,
    originalStore.replace(/(?:[\w.]+\.)?owner = \$\{store\.ownerId\}/g, 'TRUE'),
  )
})

for (const filter of filters) {
  const label = `store.ts:${filter.line} delete \`${filter.text}\``
  expectFail(label, () => {
    writeFileSync(filter.path, neutralize(filter.source, filter.index, filter.text))
  })
}

console.log(`\nmutation proof: ok (${filters.length}/${filters.length})`)
