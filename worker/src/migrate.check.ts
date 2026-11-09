// Run: node --experimental-strip-types worker/src/migrate.check.ts
// One CI copy against the workflow Postgres service. Skips without
// DAYSPRING_TEST_DATABASE_URL (local PGlite path).
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const url = process.env.DAYSPRING_TEST_DATABASE_URL?.trim()

if (!url) {
  console.log('migrate skipped (no DAYSPRING_TEST_DATABASE_URL)')
  process.exit(0)
}

if (/supabase\.co/i.test(url)) {
  console.error('Refusing DAYSPRING_TEST_DATABASE_URL that looks like supabase.co')
  process.exit(1)
}

const res = spawnSync(process.execPath, [join(root, 'scripts/migrate-neon.mjs'), '--ci'], {
  encoding: 'utf8',
  env: { ...process.env, DAYSPRING_TEST_DATABASE_URL: url },
  cwd: root,
})

const out = `${res.stdout || ''}\n${res.stderr || ''}`
if (!out.includes('verify: PASS')) {
  console.error(out)
  console.error('migrate --ci did not print verify: PASS')
  process.exit(1)
}
if (res.status !== 0) {
  console.error(out)
  process.exit(res.status ?? 1)
}
console.log(res.stdout || '')
console.log('migrate --ci: ok')
