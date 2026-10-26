// Run: node --experimental-strip-types worker/src/access.check.ts
// Proves: user A cannot read, edit, or delete user B's rows on every
// store query path. Mutating those SQL filters must make this fail.

import { PGlite } from '@electric-sql/pglite'
import { applyIsolationSchema } from './isolationDb.ts'
import { makePgliteSql } from './pgliteSql.ts'
import { makeStore } from './store.ts'
import {
  countEntries,
  deleteAttachment,
  deleteEntry,
  deleteInsight,
  deleteKeptSubject,
  deleteMark,
  deleteOwnedAccount,
  deletePrayerThread,
  deleteSpiritualItem,
  deleteThread,
  enqueueJob,
  ensureProfile,
  extendTrialOnce,
  fireReminder,
  getAttachment,
  getEntry,
  getProfile,
  getWelcomeDrip,
  insertConcordanceEvent,
  insertEchoDismissal,
  insertEntry,
  insertInsight,
  insertPrayerThread,
  insertReminder,
  insertRope,
  insertScriptureRef,
  insertSpiritualItem,
  insertThread,
  insertThreadMember,
  listAttachments,
  listConcordance,
  listDueReminders,
  listEchoCandidates,
  listEntries,
  listEntriesSince,
  listInsights,
  listKeptSubjects,
  listMarks,
  listPrayerThreads,
  listProcessingJobs,
  listReminders,
  listRopes,
  listScriptureRefs,
  listSpiritualItems,
  listThreadMembers,
  listThreads,
  replaceEntry,
  updateEntry,
  upsertAttachment,
  upsertEchoCandidate,
  upsertEntryChecked,
  upsertKeptSubject,
  upsertMark,
  upsertProfile,
  TRIAL_EXTENDED_FLAG,
} from './store.ts'

const OWNER_A = '11111111-1111-1111-1111-111111111111'
const OWNER_B = '22222222-2222-2222-2222-222222222222'
const ENTRY_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'
const ENTRY_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
const INSIGHT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'
const ITEM_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'
const REMINDER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'
const ATTACH_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5'
const MARK_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb6'
const KEPT_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb7'
const THREAD_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb8'
const PRAYER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb14'

const fails: string[] = []
let checks = 0
function ok(cond: boolean, msg: string) {
  checks++
  if (!cond) fails.push(msg)
}

const db = new PGlite()
await applyIsolationSchema(db)
const sql = makePgliteSql(db)
const storeA = makeStore(sql, OWNER_A)
const storeB = makeStore(sql, OWNER_B)

async function scalar<T>(text: string, params: unknown[] = []): Promise<T | undefined> {
  const result = await db.query<{ v: T }>(`SELECT (${text}) AS v`, params)
  return result.rows[0]?.v
}

async function count(table: string, where: string, params: unknown[]): Promise<number> {
  const result = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM ${table} WHERE ${where}`,
    params,
  )
  return result.rows[0]?.n ?? 0
}

ok((await listEntries(storeA)).every((e) => e.id === ENTRY_A), 'listEntries: A sees only A')
ok((await listEntries(storeB)).every((e) => e.id === ENTRY_B), 'listEntries: B sees only B')
ok((await listEntriesSince(storeA, '1970-01-01T00:00:00.000Z')).every((e) => e.id !== ENTRY_B), 'listEntriesSince: A misses B')
ok((await getEntry(storeA, ENTRY_B)) === null, 'getEntry: A cannot read B entry')
ok((await getEntry(storeB, ENTRY_B))?.id === ENTRY_B, 'getEntry: B can read B entry')
ok((await countEntries(storeA)) === 1, 'countEntries: A count is 1')

ok((await updateEntry(storeA, ENTRY_B, { title: 'stolen' })) === null, 'updateEntry: A cannot patch B')
ok(
  (await scalar<string>('SELECT title FROM entries WHERE id = $1', [ENTRY_B])) === 'Ben day',
  'updateEntry: B title unchanged',
)

ok((await deleteEntry(storeA, ENTRY_B)) === false, 'deleteEntry: A cannot delete B')
ok((await count('entries', 'id = $1', [ENTRY_B])) === 1, 'deleteEntry: B row remains')

const bUpdatedAt = await scalar<string>('SELECT updated_at::text FROM entries WHERE id = $1', [ENTRY_B])
const conflict = await upsertEntryChecked(storeA, {
  id: ENTRY_B,
  created_at: '2020-01-01T00:00:00.000Z',
  body_markdown: 'stolen body',
  title: 'stolen',
  mood: null,
  tags: [],
  word_count: 2,
  source: 'native',
  external_id: null,
  base_updated_at: bUpdatedAt ?? '2020-01-01T00:00:00.000Z',
  circumstances: {},
})
ok(
  (await scalar<string>('SELECT body_markdown FROM entries WHERE id = $1', [ENTRY_B])) === 'Ben wrote this.',
  'upsertEntryChecked: A cannot overwrite B body',
)
ok(conflict.conflicted === true, 'upsertEntryChecked: A conflicts on B id')
ok(
  (await replaceEntry(storeA, {
    id: ENTRY_B,
    created_at: '2020-01-01T00:00:00.000Z',
    body_markdown: 'stolen body',
    title: 'stolen',
    mood: null,
    tags: [],
    word_count: 2,
    source: 'native',
    external_id: null,
    circumstances: {},
  })) === null,
  'replaceEntry: A cannot replace B',
)
ok(
  (await scalar<string>('SELECT body_markdown FROM entries WHERE id = $1', [ENTRY_B])) === 'Ben wrote this.',
  'replaceEntry: B body unchanged',
)

const planted = await insertEntry(storeA, {
  body_markdown: 'Ada two',
  word_count: 2,
  tags: ['mercy', 'hope'],
})
ok(planted.id !== ENTRY_B, 'insertEntry: A insert is a new id')
ok(
  Array.isArray(planted.tags) && planted.tags.includes('mercy') && planted.tags.includes('hope'),
  'insertEntry: tags array round-trips (not a conflict)',
)
ok(
  (await getEntry(storeA, planted.id))?.tags.includes('mercy') === true,
  'getEntry: tags persist as text[]',
)
ok((await count('entries', 'owner = $1', [OWNER_A])) === 2, 'insertEntry: A now has 2')
ok((await count('entries', 'owner = $1', [OWNER_B])) === 1, 'insertEntry: B still has 1')

ok((await getProfile(storeA))?.owner === OWNER_A, 'getProfile: A sees A')
ok((await getProfile(storeA))?.owner !== OWNER_B, 'getProfile: A profile is not B')
const bPlanBefore = await scalar<string>('SELECT plan FROM profiles WHERE owner = $1', [OWNER_B])
await upsertProfile(storeA, { plan: 'stolen-plan' })
ok(
  (await scalar<string>('SELECT plan FROM profiles WHERE owner = $1', [OWNER_B])) === bPlanBefore,
  'upsertProfile: A cannot rewrite B plan',
)
ok((await getProfile(storeA))?.plan === 'stolen-plan', 'upsertProfile: A updated own plan')

ok((await listInsights(storeA)).every((r) => r.id !== INSIGHT_B), 'listInsights: A misses B')
ok((await deleteInsight(storeA, INSIGHT_B)) === false, 'deleteInsight: A cannot delete B')
ok((await count('insights', 'id = $1', [INSIGHT_B])) === 1, 'deleteInsight: B insight remains')
await insertInsight(storeA, { type: 'win' })
ok((await count('insights', 'owner = $1', [OWNER_A])) === 2, 'insertInsight: A owns new insight')

ok((await listSpiritualItems(storeA)).every((r) => r.id !== ITEM_B), 'listSpiritualItems: A misses B')
ok((await deleteSpiritualItem(storeA, ITEM_B)) === false, 'deleteSpiritualItem: A cannot delete B')
await insertSpiritualItem(storeA, { type: 'sense', content: 'Ada sense' })

ok((await listReminders(storeA)).every((r) => r.id !== REMINDER_B), 'listReminders: A misses B')
ok((await fireReminder(storeA, REMINDER_B)) === false, 'fireReminder: A cannot fire B')
ok((await scalar<boolean>('SELECT fired FROM reminders WHERE id = $1', [REMINDER_B])) === false, 'fireReminder: B still unfired')
ok((await listDueReminders(storeA, '2021-01-01T00:00:00Z')).every((r) => r.id !== REMINDER_B), 'listDueReminders: A misses B')
await insertReminder(storeA, { content: 'later', remind_at: '2030-01-01T00:00:00Z' })

ok((await getAttachment(storeA, 'ben-hash')) === null, 'getAttachment: A cannot read B hash')
ok((await listAttachments(storeA)).every((r) => r.hash !== 'ben-hash'), 'listAttachments: A misses B')
ok((await deleteAttachment(storeA, ATTACH_B)) === false, 'deleteAttachment: A cannot delete B')
await upsertAttachment(storeA, { hash: 'ada-2', storage_key: `${OWNER_A}/ada-2.jpg` })

ok((await listMarks(storeA)).every((r) => r.id !== MARK_B), 'listMarks: A misses B')
ok((await deleteMark(storeA, MARK_B)) === false, 'deleteMark: A cannot delete B')
await upsertMark(storeA, { entry_id: ENTRY_B, quote: 'Ben quote', kind: 'stolen' })
ok(
  (await scalar<string | null>('SELECT kind FROM marks WHERE id = $1', [MARK_B])) !== 'stolen',
  'upsertMark: A cannot rewrite B mark',
)
await upsertMark(storeA, { entry_id: ENTRY_A, quote: 'new ada mark' })

ok((await listKeptSubjects(storeA)).every((r) => r.id !== KEPT_B), 'listKeptSubjects: A misses B')
ok((await deleteKeptSubject(storeA, KEPT_B)) === false, 'deleteKeptSubject: A cannot delete B')
await upsertKeptSubject(storeA, { subject_key: 'hope', label: 'Hope' })

ok((await listThreads(storeA)).every((r) => r.id !== THREAD_B), 'listThreads: A misses B')
ok((await deleteThread(storeA, THREAD_B)) === false, 'deleteThread: A cannot delete B')
ok((await listThreadMembers(storeA, THREAD_B)).length === 0, 'listThreadMembers: A cannot read B members')
ok((await insertThreadMember(storeA, THREAD_B, ENTRY_A)) === null, 'insertThreadMember: A cannot join B thread')
ok((await count('thread_members', 'thread_id = $1', [THREAD_B])) === 1, 'insertThreadMember: B member count unchanged')
await insertThread(storeA, 'Ada extra')

ok((await listRopes(storeA)).length >= 1, 'listRopes: A sees own')
ok((await listRopes(storeA)).every((r) => r.id !== 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb10'), 'listRopes: A misses B')
await insertRope(storeA, 'Ada extra rope')

ok((await listProcessingJobs(storeA)).every((r) => r.id !== 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb11'), 'listProcessingJobs: A misses B')
await enqueueJob(storeA, 'concordance')

ok((await listConcordance(storeA)).every((r) => r.id !== 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb12'), 'listConcordance: A misses B')
await insertConcordanceEvent(storeA, { kind: 'seen' })
ok((await count('concordance_events', 'owner = $1', [OWNER_B])) === 1, 'insertConcordanceEvent: did not land on B')

ok((await listScriptureRefs(storeA)).every((r) => r.id !== 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb13'), 'listScriptureRefs: A misses B')
await insertScriptureRef(storeA, { canonical: 'Ps.23.1' })

ok((await listEchoCandidates(storeA)).every((r) => r.owner === OWNER_A), 'listEchoCandidates: A only')
await upsertEchoCandidate(storeA, ENTRY_A)
ok(
  (await scalar<string>('SELECT entry_id::text FROM echo_candidates WHERE owner = $1', [OWNER_B])) === ENTRY_B,
  'upsertEchoCandidate: B candidate unchanged',
)
await insertEchoDismissal(storeA, ENTRY_A)
ok((await count('echo_dismissals', 'owner = $1', [OWNER_B])) === 1, 'insertEchoDismissal: not on B')

ok((await listPrayerThreads(storeA)).every((r) => r.id !== PRAYER_B), 'listPrayerThreads: A misses B')
ok((await deletePrayerThread(storeA, PRAYER_B)) === false, 'deletePrayerThread: A cannot delete B')
await insertPrayerThread(storeA, 'Ada extra cairn')

ok((await getWelcomeDrip(storeA))?.owner === OWNER_A, 'getWelcomeDrip: A sees A')
ok((await getWelcomeDrip(storeB))?.owner === OWNER_B, 'getWelcomeDrip: B sees B')
ok((await getWelcomeDrip(storeA))?.owner !== OWNER_B, 'getWelcomeDrip: A is not B')

await db.query("UPDATE profiles SET plan = 'active', plan_source = 'stripe' WHERE owner = $1", [OWNER_B])
await ensureProfile(storeA)
ok(
  (await scalar<string>('SELECT plan FROM profiles WHERE owner = $1', [OWNER_B])) === 'active',
  'ensureProfile: A cannot overwrite B paid plan',
)
await db.query(
  "UPDATE profiles SET plan = 'trialing', plan_source = NULL, feature_flags = '{}' WHERE owner = $1",
  [OWNER_A],
)
await db.query(
  "UPDATE profiles SET plan = 'trialing', plan_source = NULL, feature_flags = '{}' WHERE owner = $1",
  [OWNER_B],
)
const extended = await extendTrialOnce(storeA)
ok(extended.ok === true, 'extendTrialOnce: A can extend own trial')
ok(
  !(await getProfile(storeB))?.feature_flags?.includes(TRIAL_EXTENDED_FLAG),
  'extendTrialOnce: A cannot mark B trial_extended',
)

await db.query(
  `INSERT INTO session (id, expires_at, token, user_id)
   VALUES ('sess-ada', NOW() + INTERVAL '1 day', 'tok-ada', $1),
          ('sess-ben', NOW() + INTERVAL '1 day', 'tok-ben', $2)`,
  [OWNER_A, OWNER_B],
)
await db.query(
  `INSERT INTO account (id, account_id, provider_id, user_id)
   VALUES ('acct-ada', 'ada', 'credential', $1),
          ('acct-ben', 'ben', 'credential', $2)`,
  [OWNER_A, OWNER_B],
)
const bEntriesBefore = await count('entries', 'owner = $1', [OWNER_B])
const bProfilesBefore = await count('profiles', 'owner = $1', [OWNER_B])
await deleteOwnedAccount(storeA)
ok((await count('entries', 'owner = $1', [OWNER_B])) === bEntriesBefore, 'deleteOwnedAccount: B entries remain')
ok((await count('profiles', 'owner = $1', [OWNER_B])) === bProfilesBefore, 'deleteOwnedAccount: B profile remains')
ok((await count('marks', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B marks remain')
ok((await count('insights', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B insights remain')
ok((await count('reminders', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B reminders remain')
ok((await count('attachments', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B attachments remain')
ok((await count('kept_subjects', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B kept_subjects remain')
ok((await count('threads', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B threads remain')
ok((await count('ropes', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B ropes remain')
ok((await count('processing_jobs', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B jobs remain')
ok((await count('concordance', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B concordance remain')
ok((await count('scripture_refs', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B scripture_refs remain')
ok((await count('echo_candidates', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B echo_candidates remain')
ok((await count('prayer_threads', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B prayer_threads remain')
ok((await count('welcome_drip_enrollments', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B drip remain')
ok((await count('spiritual_items', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B spiritual_items remain')
ok((await count('thread_members', 'thread_id = $1', [THREAD_B])) === 1, 'deleteOwnedAccount: B thread_members remain')
ok((await count('echo_dismissals', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B echo_dismissals remain')
ok((await count('resurface_dismissals', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B resurface_dismissals remain')
ok((await count('altar_candidates', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B altar_candidates remain')
ok((await count('altar_candidate_dismissals', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B altar dismissals remain')
ok((await count('item_subjects', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B item_subjects remain')
ok((await count('encounters', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B encounters remain')
ok((await count('concordance_events', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B concordance_events remain')
ok((await count('concordance_occurrences', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B concordance_occurrences remain')
ok((await count('concordance_shadow', 'owner = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B concordance_shadow remain')
ok((await count('entries', 'owner = $1', [OWNER_A])) === 0, 'deleteOwnedAccount: A entries gone')
ok((await count('profiles', 'owner = $1', [OWNER_A])) === 0, 'deleteOwnedAccount: A profile gone')
ok((await getWelcomeDrip(storeA)) === null, 'deleteOwnedAccount: A drip gone')
ok((await count('"user"', 'id = $1', [OWNER_A])) === 0, 'deleteOwnedAccount: A auth user gone')
ok((await count('session', 'user_id = $1', [OWNER_A])) === 0, 'deleteOwnedAccount: A sessions gone')
ok((await count('account', 'user_id = $1', [OWNER_A])) === 0, 'deleteOwnedAccount: A accounts gone')
ok((await count('"user"', 'id = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B auth user remains')
ok((await count('session', 'user_id = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B session remains')
ok((await count('account', 'user_id = $1', [OWNER_B])) === 1, 'deleteOwnedAccount: B account remains')

console.log(`${checks} checks, ${fails.length} failed`)
if (fails.length) {
  for (const f of fails) console.error('  FAIL', f)
  process.exit(1)
}
console.log('access isolation: ok')
