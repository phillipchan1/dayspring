// Run: node --experimental-strip-types worker/src/legacyPassword.check.ts
// Proves Supabase email + password users can sign in after the Neon move:
// copyCredentialAccounts carries the bcrypt hash over as a Better Auth
// `credential` account, and the Worker's verifyPassword accepts it.
import { PGlite } from '@electric-sql/pglite'
import bcrypt from 'bcryptjs'
import { applyNeonSchema } from './isolationDb.ts'
import { createAuth, verifyPassword, type AuthDatabase } from './auth.ts'
// @ts-expect-error plain .mjs script, no types
import { copyCredentialAccounts } from '../../scripts/migrate-neon.mjs'

const fails: string[] = []
let checks = 0
function ok(cond: boolean, msg: string) {
  checks++
  if (!cond) fails.push(msg)
}

/** pg.Client-shaped wrapper (query → { rows, rowCount }). */
function client(db: PGlite) {
  return {
    async query(sql: string, params: unknown[] = []) {
      const r = await db.query(sql, params)
      return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }
    },
  }
}

function pool(db: PGlite): AuthDatabase {
  const query = async (sql: string, parameters: readonly unknown[]) => {
    const r = await db.query(sql, parameters as unknown[])
    const verb = sql.trim().split(/\s+/)[0]?.toUpperCase() ?? 'SELECT'
    return { command: verb, rowCount: r.affectedRows ?? r.rows.length, rows: r.rows }
  }
  return { options: {}, async connect() { return { query, release() {} } }, async end() {} }
}

// --- verifyPassword on its own
const legacy = bcrypt.hashSync('correct horse', 10).replace(/^\$2b\$/, '$2a$') // Supabase writes $2a$
ok(await verifyPassword({ hash: legacy, password: 'correct horse' }), 'bcrypt $2a$ hash verifies')
ok(!(await verifyPassword({ hash: legacy, password: 'wrong' })), 'bcrypt rejects a wrong password')

// --- Source: Supabase-shaped auth.users
const src = new PGlite()
await src.exec(`
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (
    id UUID PRIMARY KEY, email TEXT, encrypted_password TEXT,
    deleted_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
  );
`)
const IDS = {
  email: '11111111-1111-4111-8111-111111111111', // password user, migrated
  google: '22222222-2222-4222-8222-222222222222', // OAuth only, no hash
  changed: '33333333-3333-4333-8333-333333333333', // already has a Neon credential
  gone: '44444444-4444-4444-8444-444444444444', // not on Neon
}
await src.query(`INSERT INTO auth.users (id, email, encrypted_password) VALUES
  ($1, 'pw@example.test', $5), ($2, 'g@example.test', ''), ($3, 'changed@example.test', $5), ($4, 'gone@example.test', $5)`,
[IDS.email, IDS.google, IDS.changed, IDS.gone, legacy])

// --- Target: Neon schema with users already copied
const tgt = new PGlite()
await applyNeonSchema(tgt)
for (const [id, email] of [[IDS.email, 'pw@example.test'], [IDS.google, 'g@example.test'], [IDS.changed, 'changed@example.test']]) {
  await tgt.query(`INSERT INTO "user" (id, name, email, email_verified) VALUES ($1, 'n', $2, true)`, [id, email])
}
await tgt.query(`INSERT INTO account (id, account_id, provider_id, user_id, password)
  VALUES ('keep', $1, 'credential', $1, 'salt:already-scrypt')`, [IDS.changed])

const dry = await copyCredentialAccounts(client(src), client(tgt), { write: false })
ok(dry.inserted === 1 && dry.existing === 1 && dry.missingUser === 1 && dry.source === 3, `dry run counts (${JSON.stringify(dry)})`)
const none = await tgt.query(`SELECT count(*)::int AS n FROM account WHERE provider_id = 'credential'`)
ok((none.rows[0] as { n: number }).n === 1, 'dry run writes nothing')

const applied = await copyCredentialAccounts(client(src), client(tgt))
ok(applied.inserted === 1, 'apply inserts the one missing credential')
const again = await copyCredentialAccounts(client(src), client(tgt))
ok(again.inserted === 0 && again.existing === 2, 'apply is idempotent')
const kept = await tgt.query(`SELECT password FROM account WHERE id = 'keep'`)
ok((kept.rows[0] as { password: string }).password === 'salt:already-scrypt', 'a newer Neon password is never overwritten')

// --- Real Better Auth sign-in against the migrated row
const BASE = 'https://api.dayspring.test'
const auth = createAuth({
  BETTER_AUTH_URL: BASE,
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/dayspring',
}, pool(tgt))

async function signIn(email: string, password: string) {
  return auth.handler(new Request(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ email, password }),
  }))
}

const good = await signIn('pw@example.test', 'correct horse')
ok(good.status === 200, `migrated user signs in with their old password (got ${good.status})`)
ok((good.headers.get('set-auth-token') ?? '').includes('.'), 'migrated sign-in returns a signed bearer')
const bad = await signIn('pw@example.test', 'nope')
ok(bad.status === 401, `wrong password still refused (got ${bad.status})`)

// New sign-ups keep Better Auth's own scrypt hashes and still work.
const up = await auth.handler(new Request(`${BASE}/api/auth/sign-up/email`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: BASE },
  body: JSON.stringify({ email: 'new@example.test', password: 'brand new pass', name: 'New' }),
}))
ok(up.status === 200, `new sign-up works (got ${up.status})`)
const newHash = await tgt.query(`SELECT a.password FROM account a JOIN "user" u ON u.id = a.user_id WHERE u.email = 'new@example.test'`)
ok(!String((newHash.rows[0] as { password: string }).password).startsWith('$2'), 'new passwords are not bcrypt')
ok((await signIn('new@example.test', 'brand new pass')).status === 200, 'new user signs in')

console.log(`${checks} checks, ${fails.length} failed`)
if (fails.length) {
  for (const f of fails) console.error(`FAIL: ${f}`)
  process.exit(1)
}
console.log('legacy passwords: ok')
