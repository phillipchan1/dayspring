// Run: node --experimental-strip-types worker/src/migrate.check.ts
// Bind helpers always; --ci copy against workflow Postgres when
// DAYSPRING_TEST_DATABASE_URL is set (skipped on local PGlite).
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { bindCopyValue, derivedPairs, insertPlaceholder, isJsonColumn } from '../../scripts/migrate-neon.mjs'
import { createAuth } from './auth.ts'

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

const srcOsis = new Map([['osis_ref', { column_name: 'osis_ref', data_type: 'text', udt_name: 'text' }]])
const tgtCanon = new Map([['canonical', { column_name: 'canonical', data_type: 'text', udt_name: 'text' }]])
ok(
  derivedPairs('scripture_refs', srcOsis, tgtCanon, new Set()).some((p) => p.name === 'canonical' && p.expr.includes('osis_ref')),
  'scripture_refs.canonical derives from osis_ref',
)
ok(derivedPairs('scripture_refs', srcOsis, tgtCanon, new Set(['canonical'])).length === 0, 'derive skips when target already copied')

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

  const expectedTables = [
    'user', 'account', 'profiles', 'entries', 'insights', 'spiritual_items', 'reminders',
    'echo_candidates', 'echo_dismissals', 'resurface_dismissals', 'scripture_refs', 'scripture_text',
    'prayer_threads', 'encounters', 'altar_candidates', 'altar_candidate_dismissals', 'item_subjects',
    'threads', 'ropes', 'thread_members', 'attachments', 'processing_jobs', 'concordance',
    'concordance_occurrences', 'concordance_events', 'concordance_shadow', 'marks', 'kept_subjects',
    'welcome_drip_enrollments',
  ]
  for (const table of expectedTables) {
    const line = out.split('\n').find((row) => row.startsWith(`${table.padEnd(32)}`))
    if (!line || !/source=\d+ target=\d+ ok/.test(line)) {
      console.error(`missing or mismatched copy for ${table}`, line ?? '(no line)')
      process.exit(1)
    }
  }

  const ackedCol = await client.query(
    `SELECT data_type, is_nullable
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'acked_processing_completion'`,
  )
  if (ackedCol.rows[0]?.data_type !== 'text') {
    console.error('acked_processing_completion should be text', ackedCol.rows[0])
    process.exit(1)
  }
  const acked = await client.query(
    `SELECT acked_processing_completion FROM profiles WHERE owner = '11111111-1111-1111-1111-111111111111'`,
  )
  if (acked.rows[0]?.acked_processing_completion !== '2026-03-01T12:00:00.000Z') {
    console.error('acked_processing_completion text key did not copy', acked.rows[0])
    process.exit(1)
  }
  const ackedNull = await client.query(
    `SELECT acked_processing_completion FROM profiles WHERE owner = '22222222-2222-2222-2222-222222222222'`,
  )
  if (ackedNull.rows[0]?.acked_processing_completion != null) {
    console.error('nullable acked_processing_completion NULL did not copy', ackedNull.rows[0])
    process.exit(1)
  }

  const refs = await client.query(
    `SELECT canonical, osis_ref FROM scripture_refs WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa22'`,
  )
  if (refs.rows[0]?.canonical !== 'Ps.23.1' || refs.rows[0]?.osis_ref !== 'Ps.23.1') {
    console.error('scripture_refs.canonical should derive from osis_ref', refs.rows[0])
    process.exit(1)
  }
  const terms = await client.query(
    `SELECT term, canonical FROM concordance WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa28'`,
  )
  if (terms.rows[0]?.term !== 'Esther' || terms.rows[0]?.canonical !== 'Esther') {
    console.error('concordance.term should derive from canonical', terms.rows[0])
    process.exit(1)
  }
  const thread = await client.query(
    `SELECT title, label FROM threads WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8'`,
  )
  if (thread.rows[0]?.title !== 'Ada thread' || thread.rows[0]?.label !== 'Ada thread') {
    console.error('threads.title should derive from label', thread.rows[0])
    process.exit(1)
  }
  const prayer = await client.query(
    `SELECT label, title FROM prayer_threads WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa14'`,
  )
  if (prayer.rows[0]?.label !== 'Ada cairn' || prayer.rows[0]?.title !== 'Ada cairn') {
    console.error('prayer_threads.label should derive from title', prayer.rows[0])
    process.exit(1)
  }
  const subjectKey = await client.query(
    `SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'item_subjects' AND column_name = 'subject_key'`,
  )
  if (subjectKey.rows[0]?.is_nullable !== 'YES') {
    console.error('item_subjects.subject_key should be nullable', subjectKey.rows[0])
    process.exit(1)
  }
  const occTerm = await client.query(
    `SELECT is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'concordance_occurrences' AND column_name = 'term'`,
  )
  if (occTerm.rows[0]?.is_nullable !== 'YES') {
    console.error('concordance_occurrences.term should be nullable', occTerm.rows[0])
    process.exit(1)
  }

  const appleRow = await client.query<{ user_id: string; account_id: string; provider_id: string }>(
    `SELECT user_id, account_id, provider_id FROM account WHERE provider_id = 'apple'`,
  )
  if (
    appleRow.rows[0]?.user_id !== '11111111-1111-1111-1111-111111111111' ||
    appleRow.rows[0]?.account_id !== '001234.ada.apple'
  ) {
    console.error('copied apple identity did not preserve user id', appleRow.rows[0])
    process.exit(1)
  }

  const pool = new pg.Pool({
    host: decodeURIComponent(u.hostname),
    port: Number(u.port || '5432'),
    database: 'dayspring_migrate_tgt',
    user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || ''),
    ssl: false,
    max: 1,
  })
  try {
    const auth = createAuth(
      {
        ENVIRONMENT: 'local',
        BETTER_AUTH_SECRET: 'x'.repeat(32),
        DATABASE_URL: url,
        APPLE_CLIENT_ID: 'com.dayspring.web',
        APPLE_CLIENT_SECRET: 'dummy-apple-secret',
        APPLE_APP_BUNDLE_IDENTIFIER: 'app.usedayspring.ios',
        GOOGLE_CLIENT_ID: 'dummy.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'dummy-google-secret',
      },
      pool,
    )
    const ctx = await auth.$context
    const found = await ctx.adapter.findOne<{ userId: string; accountId: string }>({
      model: 'account',
      where: [
        { field: 'providerId', value: 'apple' },
        { field: 'accountId', value: '001234.ada.apple' },
      ],
    })
    if (found?.userId !== '11111111-1111-1111-1111-111111111111') {
      console.error('Better Auth did not resolve migrated apple account to preserved user id', found)
      process.exit(1)
    }
  } finally {
    await pool.end().catch(() => {})
  }
} finally {
  await client.end().catch(() => {})
}

console.log(res.stdout || '')
console.log('migrate --ci: ok')
console.log('json bind round-trip: jsonb array, jsonb object, NULL, text[] ok')
