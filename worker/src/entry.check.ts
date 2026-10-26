// Run: node --experimental-strip-types worker/src/entry.check.ts
// B5: postgres.js returns Date for timestamptz; edits must not always conflict.
import { sameTimestamp, timestampMs, upsertEntryChecked, makeStore } from './store.ts'
import { openWireSql } from './testPg.ts'

const fails: string[] = []
let checks = 0
function ok(cond: boolean, msg: string) {
  checks++
  if (!cond) fails.push(msg)
}

const iso = '2026-03-01T12:00:00.123Z'
const date = new Date(iso)
const pgText = '2026-03-01 12:00:00.123+00'
ok(timestampMs(date) === Date.parse(iso), 'Date epoch matches ISO')
ok(sameTimestamp(date, iso), 'Date === ISO string')
ok(sameTimestamp(iso, pgText), 'ISO === PG text')
ok(sameTimestamp(date, pgText), 'Date === PG text')
ok(sameTimestamp(date, date), 'Date === Date')
ok(!sameTimestamp(date, '2020-01-01T00:00:00.000Z'), 'stale ISO is not equal')
ok(!sameTimestamp(date, null), 'null base is not equal')
ok(!sameTimestamp(date, ''), 'empty base is not equal')

const wire = await openWireSql()
ok(
  wire.kind === 'postgres' || wire.kind === 'pglite-socket',
  `wire sql opened (${wire.kind})`,
)
const OWNER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01'
try {
  await wire.sql`DELETE FROM entries WHERE owner = ${OWNER}`
  await wire.sql`DELETE FROM "user" WHERE id = ${OWNER}`
  await wire.sql`
    INSERT INTO "user" (id, name, email, email_verified)
    VALUES (${OWNER}, 'Edie', ${`edie-${crypto.randomUUID()}@example.test`}, TRUE)
  `
  const store = makeStore(wire.sql, OWNER)
  const created = await upsertEntryChecked(store, {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa11',
    created_at: '2026-03-01T12:00:00.000Z',
    body_markdown: 'first draft',
    title: 'One',
    mood: null,
    tags: ['mercy'],
    word_count: 2,
    source: 'native',
    external_id: null,
    base_updated_at: null,
    circumstances: {},
  })
  ok(created.conflicted === false, 'insert path is not conflicted')
  ok(
    created.entry.updated_at instanceof Date || typeof created.entry.updated_at === 'string',
    'postgres.js returns updated_at as Date or string',
  )
  ok(
    created.entry.updated_at instanceof Date,
    'real postgres.js path returns Date for updated_at',
  )

  const isoBase = created.entry.updated_at instanceof Date
    ? created.entry.updated_at.toISOString()
    : String(created.entry.updated_at)
  const matched = await upsertEntryChecked(store, {
    id: created.entry.id,
    created_at: '2026-03-01T12:00:00.000Z',
    body_markdown: 'second draft',
    title: 'Two',
    mood: null,
    tags: ['mercy'],
    word_count: 2,
    source: 'native',
    external_id: null,
    base_updated_at: isoBase,
    circumstances: {},
  })
  ok(matched.conflicted === false, 'matching ISO base writes the edit')
  ok(matched.entry.body_markdown === 'second draft', 'matching base updated the body')

  const dateBase = matched.entry.updated_at
  const matchedDate = await upsertEntryChecked(store, {
    id: created.entry.id,
    created_at: '2026-03-01T12:00:00.000Z',
    body_markdown: 'third draft',
    title: 'Three',
    mood: null,
    tags: ['mercy'],
    word_count: 2,
    source: 'native',
    external_id: null,
    base_updated_at: dateBase as unknown as string,
    circumstances: {},
  })
  ok(matchedDate.conflicted === false, 'matching Date base writes the edit')
  ok(matchedDate.entry.body_markdown === 'third draft', 'Date base updated the body')

  const stale = await upsertEntryChecked(store, {
    id: created.entry.id,
    created_at: '2026-03-01T12:00:00.000Z',
    body_markdown: 'should not land',
    title: 'Nope',
    mood: null,
    tags: ['mercy'],
    word_count: 3,
    source: 'native',
    external_id: null,
    base_updated_at: '2020-01-01T00:00:00.000Z',
    circumstances: {},
  })
  ok(stale.conflicted === true, 'stale base is conflicted')
  ok(stale.entry.body_markdown === 'third draft', 'stale base does not overwrite')

  const raceId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa22'
  const seeded = await upsertEntryChecked(store, {
    id: raceId,
    created_at: '2026-03-01T12:00:00.000Z',
    body_markdown: 'race seed',
    title: 'Race',
    mood: null,
    tags: ['mercy'],
    word_count: 2,
    source: 'native',
    external_id: null,
    base_updated_at: null,
    circumstances: {},
  })
  ok(seeded.conflicted === false, 'race seed insert is not conflicted')
  const raceBase = seeded.entry.updated_at instanceof Date
    ? seeded.entry.updated_at.toISOString()
    : String(seeded.entry.updated_at)

  const raced = await Promise.all(Array.from({ length: 10 }, (_, i) => upsertEntryChecked(store, {
    id: raceId,
    created_at: '2026-03-01T12:00:00.000Z',
    body_markdown: `race ${i}`,
    title: `Race ${i}`,
    mood: null,
    tags: ['mercy'],
    word_count: 2,
    source: 'native',
    external_id: null,
    base_updated_at: raceBase,
    circumstances: {},
  })))
  const landed = raced.filter((row) => row.conflicted === false)
  const blocked = raced.filter((row) => row.conflicted === true)
  ok(landed.length === 1, `parallel edits: exactly 1 of 10 lands (got ${landed.length})`)
  ok(blocked.length === 9, `parallel edits: 9 of 10 conflict (got ${blocked.length})`)
  const latest = await upsertEntryChecked(store, {
    id: raceId,
    created_at: '2026-03-01T12:00:00.000Z',
    body_markdown: 'should not land after race',
    title: 'Nope',
    mood: null,
    tags: ['mercy'],
    word_count: 4,
    source: 'native',
    external_id: null,
    base_updated_at: raceBase,
    circumstances: {},
  })
  ok(latest.conflicted === true, 'same base after the race is conflicted')
  ok(
    landed[0] != null && latest.entry.body_markdown === landed[0].entry.body_markdown,
    'winning race body is what remains',
  )
} finally {
  await wire.close()
}

console.log(`${checks} checks, ${fails.length} failed (${wire.kind})`)
if (fails.length) {
  for (const f of fails) console.error('  FAIL', f)
  process.exit(1)
}
console.log('entry timestamps: ok')
