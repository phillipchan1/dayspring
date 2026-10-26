// Run: node --experimental-strip-types worker/src/profile.check.ts
// B3: profile/ensure never overwrites a paid plan; trial/extend is one-time.
import { PGlite } from '@electric-sql/pglite'
import { applyNeonSchema } from './isolationDb.ts'
import { makePgliteSql } from './pgliteSql.ts'
import {
  TRIAL_EXTENDED_FLAG,
  canExtendTrial,
  canGrantReverseTrial,
  ensureProfile,
  extendTrialOnce,
  getProfile,
  makeStore,
  upsertProfile,
} from './store.ts'

const OWNER = '33333333-3333-3333-3333-333333333333'
const PAID = '44444444-4444-4444-4444-444444444444'

const fails: string[] = []
let checks = 0
function ok(cond: boolean, msg: string) {
  checks++
  if (!cond) fails.push(msg)
}

const db = new PGlite()
await applyNeonSchema(db)
await db.query(
  `INSERT INTO "user" (id, name, email, email_verified) VALUES
    ($1, 'Cara', 'cara@example.test', TRUE),
    ($2, 'Paid', 'paid@example.test', TRUE)`,
  [OWNER, PAID],
)

const sql = makePgliteSql(db)
const fresh = makeStore(sql, OWNER)
const paid = makeStore(sql, PAID)

ok(canGrantReverseTrial(null), 'null profile is eligible for reverse trial')

const granted = await ensureProfile(fresh)
ok(granted.plan === 'trialing', 'ensureProfile grants trialing on first call')
ok(granted.trial_ends_at != null, 'ensureProfile sets trial_ends_at')
ok(!granted.plan_source, 'ensureProfile does not set plan_source (matches Vercel)')
const firstEnd = granted.trial_ends_at

const again = await ensureProfile(fresh)
ok(again.plan === 'trialing', 'ensureProfile is idempotent for trialing')
ok(
  new Date(again.trial_ends_at ?? 0).getTime() === new Date(firstEnd ?? 0).getTime(),
  'ensureProfile does not reset trial_ends_at',
)

await upsertProfile(paid, { plan: 'active', plan_source: 'stripe' })
await db.query(
  "UPDATE profiles SET stripe_customer_id = 'cus_paid' WHERE owner = $1",
  [PAID],
)
const paidBefore = await getProfile(paid)
ok(paidBefore?.plan === 'active', 'paid fixture is active')
ok(!canGrantReverseTrial(paidBefore), 'paid profile is not eligible for reverse trial')
ok(!canExtendTrial(paidBefore!), 'paid profile is not extendable')

const paidAfter = await ensureProfile(paid)
ok(paidAfter.plan === 'active', 'ensureProfile does not downgrade active → trialing')
ok(paidAfter.plan_source === 'stripe', 'ensureProfile does not overwrite plan_source')
ok(paidAfter.stripe_customer_id === 'cus_paid', 'ensureProfile leaves stripe_customer_id')

const firstExtend = await extendTrialOnce(fresh)
ok(firstExtend.ok === true, 'first trial/extend succeeds')
if (firstExtend.ok) {
  ok(firstExtend.profile.feature_flags.includes(TRIAL_EXTENDED_FLAG), 'sets trial_extended flag')
  ok(
    new Date(firstExtend.trial_ends_at).getTime() > new Date(firstEnd ?? 0).getTime(),
    'extends trial_ends_at by +7 days from current end',
  )
}

const secondExtend = await extendTrialOnce(fresh)
ok(secondExtend.ok === false && secondExtend.status === 409, 'second trial/extend is 409')
ok(
  secondExtend.ok === false && secondExtend.error.includes('already extended'),
  'second extend names the one-time limit',
)

const paidExtend = await extendTrialOnce(paid)
ok(paidExtend.ok === false && paidExtend.status === 409, 'paid trial/extend is 409')
ok(
  (await getProfile(paid))?.plan === 'active',
  'trial/extend does not write plan=trialing over a subscriber',
)

const PARALLEL = '55555555-5555-5555-5555-555555555555'
await db.query(
  `INSERT INTO "user" (id, name, email, email_verified) VALUES ($1, 'Par', 'par@example.test', TRUE)`,
  [PARALLEL],
)
const racing = makeStore(sql, PARALLEL)
await ensureProfile(racing)
const parallel = await Promise.all(Array.from({ length: 8 }, () => extendTrialOnce(racing)))
const wins = parallel.filter((row) => row.ok)
const conflicts = parallel.filter((row) => !row.ok && row.status === 409)
ok(wins.length === 1, 'parallel extendTrialOnce: exactly one 200')
ok(conflicts.length === 7, 'parallel extendTrialOnce: the rest are 409')
ok(
  (await getProfile(racing))?.feature_flags.filter((flag) => flag === TRIAL_EXTENDED_FLAG).length === 1,
  'parallel extendTrialOnce writes trial_extended once',
)

console.log(`${checks} checks, ${fails.length} failed`)
if (fails.length) {
  for (const f of fails) console.error('  FAIL', f)
  process.exit(1)
}
console.log('profile ensure/extend: ok')
