// Run: node --experimental-strip-types worker/src/migrate.check.ts
// Bind helpers always; --ci copy against workflow Postgres when
// DAYSPRING_TEST_DATABASE_URL is set (skipped on local PGlite).
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { bindCopyValue, insertPlaceholder, isJsonColumn } from '../../scripts/migrate-neon.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const fails: string[] = []
let checks = 0
function ok(cond: boolean, msg: string) {
  checks++
  if (!cond) fails.push(msg)
}

const jsonbCol = { name: 'subject_tags', tgtType: 'jsonb', tgtDataType: 'jsonb' }
const jsonCol = { name: 'payload', tgtType: 'json', tgtDataType: 'json' }
const textArr = { name: 'tags', tgtType: '_text', tgtDataType: 'ARRAY' }
const uuidArr = { name: 'source_ids', tgtType: '_uuid', tgtDataType: 'ARRAY' }
const jsonbArr = { name: 'payloads', tgtType: '_jsonb', tgtDataType: 'ARRAY' }
const tags = ['mercy', 'hope']

ok(isJsonColumn(jsonbCol), 'jsonb scalar is a json column')
ok(isJsonColumn(jsonCol), 'json scalar is a json column')
ok(!isJsonColumn(textArr), 'text[] is not a json column')
ok(!isJsonColumn(uuidArr), 'uuid[] is not a json column')
ok(!isJsonColumn(jsonbArr), 'jsonb[] stays a Postgres array')
ok(bindCopyValue(jsonbCol, ['mercy', 'hope']) === JSON.stringify(['mercy', 'hope']), 'jsonb array stringifies')
ok(bindCopyValue(jsonbCol, { kind: 'prayer' }) === JSON.stringify({ kind: 'prayer' }), 'jsonb object stringifies')
ok(bindCopyValue(jsonbCol, null) === null, 'jsonb NULL stays NULL')
ok(bindCopyValue(jsonbCol, undefined) === null, 'jsonb undefined stays NULL')
ok(bindCopyValue(textArr, tags) === tags, 'text[] stays a JS array')
ok(insertPlaceholder(jsonbCol, 1) === '$1::jsonb', 'jsonb placeholder casts ::jsonb')
ok(insertPlaceholder(jsonCol, 3) === '$3::jsonb', 'json placeholder casts ::jsonb')
ok(insertPlaceholder(textArr, 2) === '$2', 'text[] placeholder has no json cast')

if (fails.length) {
  console.error(fails.join('\n'))
  process.exit(1)
}
console.log(`json bind: ${checks} ok`)

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

const u = new URL(url)
const client = new pg.Client({
  host: decodeURIComponent(u.hostname),
  port: Number(u.port || '5432'),
  database: 'dayspring_migrate_tgt',
  user: decodeURIComponent(u.username || 'postgres'),
  password: decodeURIComponent(u.password || ''),
  ssl: false,
})
await client.connect()
try {
  const items = await client.query(
    `SELECT id::text AS id, metadata, subject_tags FROM spiritual_items ORDER BY id`,
  )
  const ada = items.rows.find((r) => String(r.id).endsWith('aa51'))
  const ben = items.rows.find((r) => String(r.id).endsWith('bb51'))
  if (!ada || !ben) {
    console.error('expected two spiritual_items rows after --ci')
    process.exit(1)
  }
  if (!Array.isArray(ada.subject_tags) || ada.subject_tags.join(',') !== 'mercy,hope') {
    console.error('jsonb array did not round-trip', ada.subject_tags)
    process.exit(1)
  }
  if (!ada.metadata || typeof ada.metadata !== 'object' || Array.isArray(ada.metadata) || ada.metadata.kind !== 'intercession') {
    console.error('jsonb object did not round-trip', ada.metadata)
    process.exit(1)
  }
  if (ben.subject_tags !== null) {
    console.error('jsonb NULL did not round-trip', ben.subject_tags)
    process.exit(1)
  }
  if (ben.metadata !== null) {
    console.error('nullable metadata NULL did not round-trip', ben.metadata)
    process.exit(1)
  }
  const metaCol = await client.query(
    `SELECT is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'spiritual_items' AND column_name = 'metadata'`,
  )
  if (metaCol.rows[0]?.is_nullable !== 'YES') {
    console.error('spiritual_items.metadata should be nullable', metaCol.rows[0])
    process.exit(1)
  }
  if (!String(metaCol.rows[0]?.column_default ?? '').includes('{}')) {
    console.error('spiritual_items.metadata default should stay {}', metaCol.rows[0])
    process.exit(1)
  }
  const entry = await client.query(
    `SELECT tags FROM entries WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'`,
  )
  const copiedTags = entry.rows[0]?.tags
  if (!Array.isArray(copiedTags) || copiedTags.join(',') !== 'mercy,hope') {
    console.error('text[] did not round-trip', copiedTags)
    process.exit(1)
  }
} finally {
  await client.end().catch(() => {})
}

console.log(res.stdout || '')
console.log('migrate --ci: ok')
console.log('json bind round-trip: jsonb array, jsonb object, NULL, text[] ok')
