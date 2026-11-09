#!/usr/bin/env node
/**
 * One-shot copy: Supabase-shaped Postgres → Neon (Better Auth + public tables).
 *
 *   node scripts/migrate-neon.mjs --dry-run
 *   node scripts/migrate-neon.mjs --apply
 *   node scripts/migrate-neon.mjs --ci
 *
 * Connections from env only. Password from PGPASSWORD / SOURCE_PGPASSWORD /
 * TARGET_PGPASSWORD, each optionally loaded from a 0600 *PASSWORD_FILE.
 * Never on argv. --ci uses DAYSPRING_TEST_DATABASE_URL (local Postgres).
 */
import { closeSync, existsSync, openSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import pg from 'pg'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const schemaDir = join(root, 'worker/schema')

const argv = process.argv.slice(2)
for (const arg of argv) {
  if (/^postgres(ql)?:\/\//i.test(arg) || /password=/i.test(arg) || arg.includes('@')) {
    console.error('Postgres credentials must not appear on argv. Use PGPASSWORD from a 0600 file.')
    process.exit(2)
  }
}

const ciMode = argv.includes('--ci')
const apply = argv.includes('--apply') || ciMode
const dryRun = !apply

/** Target-only columns the Worker still SELECTs. Source name → target name. */
export const DERIVE = {
  scripture_refs: [{ target: 'canonical', from: 'osis_ref' }],
  concordance: [{ target: 'term', from: 'canonical' }],
  threads: [{ target: 'title', from: 'label' }],
  prayer_threads: [{ target: 'label', from: 'title' }],
}

const COPY_TABLES = [
  { target: 'profiles', source: 'public.profiles', pk: ['id'] },
  { target: 'entries', source: 'public.entries', pk: ['id'] },
  { target: 'insights', source: 'public.insights', pk: ['id'] },
  { target: 'spiritual_items', source: 'public.spiritual_items', pk: ['id'] },
  { target: 'reminders', source: 'public.reminders', pk: ['id'] },
  { target: 'echo_candidates', source: 'public.echo_candidates', pk: ['owner'] },
  { target: 'echo_dismissals', source: 'public.echo_dismissals', pk: ['id'] },
  { target: 'resurface_dismissals', source: 'public.resurface_dismissals', pk: ['id'] },
  { target: 'scripture_refs', source: 'public.scripture_refs', pk: ['id'] },
  { target: 'scripture_text', source: 'public.scripture_text', pk: ['ref', 'translation'] },
  { target: 'prayer_threads', source: 'public.prayer_threads', pk: ['id'] },
  { target: 'encounters', source: 'public.encounters', pk: ['id'] },
  { target: 'altar_candidates', source: 'public.altar_candidates', pk: ['id'] },
  { target: 'altar_candidate_dismissals', source: 'public.altar_candidate_dismissals', pk: ['id'] },
  { target: 'item_subjects', source: 'public.item_subjects', pk: ['id'] },
  { target: 'threads', source: 'public.threads', pk: ['id'] },
  { target: 'ropes', source: 'public.ropes', pk: ['id'] },
  { target: 'thread_members', source: 'public.thread_members', pk: ['id'] },
  { target: 'attachments', source: 'public.attachments', pk: ['id'] },
  { target: 'processing_jobs', source: 'public.processing_jobs', pk: ['id'] },
  { target: 'concordance', source: 'public.concordance', pk: ['id'] },
  { target: 'concordance_occurrences', source: 'public.concordance_occurrences', pk: ['id'] },
  { target: 'concordance_events', source: 'public.concordance_events', pk: ['id'] },
  { target: 'concordance_shadow', source: 'public.concordance_shadow', pk: ['id'] },
  { target: 'marks', source: 'public.marks', pk: ['id'] },
  { target: 'kept_subjects', source: 'public.kept_subjects', pk: ['id'] },
  { target: 'welcome_drip_enrollments', source: 'public.welcome_drip_enrollments', pk: ['owner'] },
]

function fail(message) {
  console.error(String(message))
  process.exit(1)
}

function modeIsPrivate(mode) {
  return (mode & 0o077) === 0
}

function readPasswordFile(path) {
  if (!existsSync(path)) fail('password file missing')
  const st = statSync(path)
  if (!st.isFile()) fail('password file is not a file')
  if (!modeIsPrivate(st.mode)) fail('password file must be mode 0600')
  const fd = openSync(path, 'r')
  try {
    return readFileSync(fd, 'utf8').replace(/\r?\n$/, '')
  } finally {
    closeSync(fd)
  }
}

function parseUrl(url) {
  const u = new URL(url)
  return {
    host: decodeURIComponent(u.hostname),
    port: u.port || '5432',
    database: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
    user: decodeURIComponent(u.username || 'postgres'),
    password: decodeURIComponent(u.password || ''),
  }
}

function envConn(prefix) {
  const urlKey = prefix ? `${prefix}_DATABASE_URL` : 'DATABASE_URL'
  const rawUrl = process.env[urlKey]?.trim()
  if (rawUrl) return parseUrl(rawUrl)
  const p = prefix ? `${prefix}_` : ''
  return {
    host: process.env[`${p}PGHOST`] || process.env.PGHOST || '127.0.0.1',
    port: process.env[`${p}PGPORT`] || process.env.PGPORT || '5432',
    database: process.env[`${p}PGDATABASE`] || process.env.PGDATABASE || 'postgres',
    user: process.env[`${p}PGUSER`] || process.env.PGUSER || 'postgres',
    password: '',
  }
}

function resolvePassword(conn, prefix) {
  const fileKey = prefix ? `${prefix}_PGPASSWORD_FILE` : 'PGPASSWORD_FILE'
  const envKey = prefix ? `${prefix}_PGPASSWORD` : 'PGPASSWORD'
  const file = process.env[fileKey]?.trim()
  if (file) return readPasswordFile(file)
  if (process.env[envKey]) return process.env[envKey]
  if (process.env.PGPASSWORD && !prefix) return process.env.PGPASSWORD
  return conn.password || ''
}

function isLoopback(host) {
  const h = String(host ?? '').replace(/^\[|\]$/g, '').toLowerCase()
  return h === 'localhost' || h === '::1' || h === '127.0.0.1' || /^127\.\d+\.\d+\.\d+$/.test(h)
}

function clientConfig(conn, password) {
  return {
    host: conn.host,
    port: Number(conn.port),
    database: conn.database,
    user: conn.user,
    password,
    ssl: isLoopback(conn.host) ? false : { rejectUnauthorized: true },
    connectionTimeoutMillis: 10_000,
  }
}

async function withClient(conn, password, fn) {
  const client = new pg.Client(clientConfig(conn, password))
  try {
    await client.connect()
    return await fn(client)
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err))
  } finally {
    await client.end().catch(() => {})
  }
}

async function tableExists(client, schema, name) {
  const r = await client.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`${schema}.${name}`])
  return Boolean(r.rows[0]?.ok)
}

async function applyNeonSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  const stamped = new Set((await client.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version))
  const files = readdirSync(schemaDir)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort()
  for (const name of files) {
    const version = name.slice(0, 4)
    if (stamped.has(version)) continue
    if (version === '0001' && [...stamped].some((v) => Number(v) >= 2)) continue
    await client.query(readFileSync(join(schemaDir, name), 'utf8'))
    await client.query(`INSERT INTO schema_migrations (version) VALUES ($1)`, [version])
    stamped.add(version)
  }
}

async function tableColumns(client, schema, table) {
  const q = `
    SELECT column_name, data_type, udt_name
      FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2
       AND is_generated = 'NEVER'
     ORDER BY ordinal_position
  `
  const r = await client.query(q, [schema, table])
  return new Map(r.rows.map((row) => [row.column_name, row]))
}

function colPair(name, src, tgt) {
  return {
    name,
    srcType: src.udt_name,
    tgtType: tgt.udt_name,
    srcDataType: src.data_type,
    tgtDataType: tgt.data_type,
  }
}

/** Overlapping same-name columns plus DERIVE aliases the Worker still reads. */
export function derivedPairs(tgtTable, srcCols, tgtCols, existingNames) {
  const extra = []
  for (const rule of DERIVE[tgtTable] ?? []) {
    if (existingNames.has(rule.target)) continue
    const from = srcCols.get(rule.from)
    const to = tgtCols.get(rule.target)
    if (!from || !to) continue
    extra.push({
      ...colPair(rule.target, from, to),
      expr: `"${rule.from}" AS "${rule.target}"`,
    })
  }
  return extra
}

async function overlappingColumns(src, tgt, srcSchema, srcTable, tgtTable) {
  const [srcCols, tgtCols] = await Promise.all([
    tableColumns(src, srcSchema, srcTable),
    tableColumns(tgt, 'public', tgtTable),
  ])
  const cols = []
  for (const [name, row] of srcCols) {
    const t = tgtCols.get(name)
    if (!t) continue
    cols.push(colPair(name, row, t))
  }
  return { cols, srcCols, tgtCols }
}

/** json/jsonb scalars — not ARRAY (text[], uuid[], jsonb[], …). Types from information_schema. */
export function isJsonColumn(col) {
  if (String(col.tgtDataType || '').toLowerCase() === 'array') return false
  const t = String(col.tgtType || '').toLowerCase()
  const d = String(col.tgtDataType || '').toLowerCase()
  return t === 'json' || t === 'jsonb' || d === 'json' || d === 'jsonb'
}

/** node-pg binds JS arrays as Postgres arrays; jsonb must be JSON text. NULLs stay NULL. */
export function bindCopyValue(col, value) {
  if (!isJsonColumn(col)) return value
  if (value === null || value === undefined) return null
  return JSON.stringify(value)
}

export function insertPlaceholder(col, index) {
  return isJsonColumn(col) ? `$${index}::jsonb` : `$${index}`
}

function selectExpr(col, kind) {
  const n = `"${col.name}"`
  if (kind === 'supabase' && (col.name === 'owner' || col.name === 'user_id')) {
    return `${n}::text AS ${n}`
  }
  if (col.srcType === col.tgtType) return n
  if (col.tgtType === 'text' || col.tgtType === 'varchar') return `${n}::text AS ${n}`
  if (col.srcType === 'uuid' && col.tgtType === 'text') return `${n}::text AS ${n}`
  if (col.srcType === 'date' && col.tgtType === 'timestamptz') return `${n}::timestamptz AS ${n}`
  if (col.srcType === 'text' && col.tgtType === 'uuid') return `${n}::uuid AS ${n}`
  return null
}

async function countOf(client, qualified) {
  const r = await client.query(`SELECT COUNT(*)::bigint AS n FROM ${qualified}`)
  return Number(r.rows[0]?.n ?? 0)
}

async function copyTable(src, tgt, spec, kind) {
  const srcSchema = spec.source.split('.')[0]
  const srcName = spec.source.split('.')[1]
  if (!(await tableExists(src, srcSchema, srcName))) return { table: spec.target, source: 0, target: 0, skipped: true }
  const { cols, srcCols, tgtCols } = await overlappingColumns(src, tgt, srcSchema, srcName, spec.target)
  const pairs = cols.map((c) => ({ ...c, expr: selectExpr(c, kind) })).filter((p) => p.expr)
  pairs.push(...derivedPairs(spec.target, srcCols, tgtCols, new Set(pairs.map((p) => p.name))))
  if (!pairs.length) fail(`no overlapping columns for ${spec.target}`)
  const names = pairs.map((p) => p.name)
  const rows = await src.query(`SELECT ${pairs.map((p) => p.expr).join(', ')} FROM ${spec.source}`)
  const colSql = names.map((c) => `"${c}"`).join(', ')
  const pk = spec.pk.filter((c) => names.includes(c))
  const updateSet = names
    .filter((c) => !pk.includes(c))
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(', ')
  for (const row of rows.rows) {
    const values = pairs.map((c) => bindCopyValue(c, row[c.name]))
    const placeholders = pairs.map((c, i) => insertPlaceholder(c, i + 1)).join(', ')
    const conflict = pk.length ? pk.map((c) => `"${c}"`).join(', ') : null
    const sql = conflict && updateSet
      ? `INSERT INTO ${spec.target} (${colSql}) VALUES (${placeholders})
         ON CONFLICT (${conflict}) DO UPDATE SET ${updateSet}`
      : conflict
        ? `INSERT INTO ${spec.target} (${colSql}) VALUES (${placeholders})
           ON CONFLICT (${conflict}) DO NOTHING`
        : `INSERT INTO ${spec.target} (${colSql}) VALUES (${placeholders})`
    await tgt.query(sql, values)
  }
  return { table: spec.target, source: rows.rows.length, skipped: false }
}

async function copyAuthUsers(src, tgt) {
  const rows = await src.query(`
    SELECT id::text AS id,
           COALESCE(raw_user_meta_data->>'name', raw_user_meta_data->>'full_name',
                    split_part(COALESCE(email, ''), '@', 1), '') AS name,
           COALESCE(email, id::text || '@migrated.invalid') AS email,
           (email_confirmed_at IS NOT NULL) AS email_verified,
           COALESCE(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture') AS image,
           created_at,
           updated_at
      FROM auth.users
     WHERE deleted_at IS NULL
  `)
  for (const row of rows.rows) {
    await tgt.query(
      `INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         email_verified = EXCLUDED.email_verified,
         image = EXCLUDED.image,
         updated_at = EXCLUDED.updated_at`,
      [row.id, row.name, row.email, row.email_verified, row.image, row.created_at, row.updated_at],
    )
  }
  return rows.rows.length
}

async function copyAuthIdentities(src, tgt) {
  if (!(await tableExists(src, 'auth', 'identities'))) return 0
  const rows = await src.query(`
    SELECT id::text AS id,
           provider_id AS account_id,
           provider AS provider_id,
           user_id::text AS user_id,
           created_at,
           updated_at
      FROM auth.identities
  `)
  for (const row of rows.rows) {
    await tgt.query(
      `INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         account_id = EXCLUDED.account_id,
         provider_id = EXCLUDED.provider_id,
         user_id = EXCLUDED.user_id,
         updated_at = EXCLUDED.updated_at`,
      [row.id, row.account_id, row.provider_id, row.user_id, row.created_at, row.updated_at],
    )
  }
  return rows.rows.length
}

async function runCopy(src, tgt) {
  const supabase = await tableExists(src, 'auth', 'users')
  await tgt.query('SET session_replication_role = replica').catch(() => {})
  if (supabase) {
    await copyAuthUsers(src, tgt)
    await copyAuthIdentities(src, tgt)
  }
  for (const spec of COPY_TABLES) {
    await copyTable(src, tgt, spec, supabase ? 'supabase' : 'neon')
  }
  await tgt.query('SET session_replication_role = DEFAULT').catch(() => {})
}

function logCounts(rows) {
  let failed = 0
  for (const r of rows) {
    const mark = r.source === r.target ? 'ok' : 'FAIL'
    if (mark === 'FAIL') failed += 1
    console.log(`${r.table.padEnd(32)} source=${r.source} target=${r.target} ${mark}`)
  }
  const verdict = failed === 0 ? 'PASS' : 'FAIL'
  console.log(`verify: ${verdict} (${rows.length - failed}/${rows.length} tables)`)
  return failed === 0
}

async function collectCounts(src, tgt) {
  const supabase = await tableExists(src, 'auth', 'users')
  const rows = []
  if (supabase) {
    rows.push({
      table: 'user',
      source: await countOf(src, `auth.users WHERE deleted_at IS NULL`),
      target: await countOf(tgt, '"user"'),
    })
    if (await tableExists(src, 'auth', 'identities')) {
      rows.push({
        table: 'account',
        source: await countOf(src, 'auth.identities'),
        target: await countOf(tgt, 'account'),
      })
    }
  }
  for (const spec of COPY_TABLES) {
    const srcSchema = spec.source.split('.')[0]
    const srcName = spec.source.split('.')[1]
    if (!(await tableExists(src, srcSchema, srcName))) continue
    rows.push({
      table: spec.target,
      source: await countOf(src, spec.source),
      target: await countOf(tgt, spec.target),
    })
  }
  return rows
}

async function bootstrapCi(adminConn, password) {
  const srcName = 'dayspring_migrate_src'
  const tgtName = 'dayspring_migrate_tgt'
  await withClient({ ...adminConn, database: adminConn.database || 'postgres' }, password, async (admin) => {
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [srcName])
    await admin.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [tgtName])
    await admin.query(`DROP DATABASE IF EXISTS ${srcName}`)
    await admin.query(`DROP DATABASE IF EXISTS ${tgtName}`)
    await admin.query(`CREATE DATABASE ${srcName}`)
    await admin.query(`CREATE DATABASE ${tgtName}`)
  })
  const srcConn = { ...adminConn, database: srcName }
  const tgtConn = { ...adminConn, database: tgtName }
  await withClient(srcConn, password, async (src) => {
    await src.query(readFileSync(join(schemaDir, 'migrate-source-fixture.sql'), 'utf8'))
    await src.query(readFileSync(join(schemaDir, 'migrate-source-seed.sql'), 'utf8'))
  })
  await withClient(tgtConn, password, async (tgt) => {
    await applyNeonSchema(tgt)
  })
  return { srcConn, tgtConn }
}

async function main() {
  if (ciMode) {
    const url = process.env.DAYSPRING_TEST_DATABASE_URL?.trim()
    if (!url) fail('DAYSPRING_TEST_DATABASE_URL is required for --ci')
    const admin = parseUrl(url)
    if (!isLoopback(admin.host)) fail('--ci must use a loopback host')
    const password = resolvePassword(admin, '') || admin.password
    const { srcConn, tgtConn } = await bootstrapCi(admin, password)
    const reports = await withClient(srcConn, password, async (src) =>
      withClient(tgtConn, password, async (tgt) => {
        await runCopy(src, tgt)
        return collectCounts(src, tgt)
      }),
    )
    if (!logCounts(reports)) process.exit(1)
    return
  }

  const srcConn = envConn('SOURCE')
  const tgtConn = envConn('TARGET')
  const srcPass = resolvePassword(srcConn, 'SOURCE')
  const tgtPass = resolvePassword(tgtConn, 'TARGET')
  if (!srcPass) fail('source password missing (SOURCE_PGPASSWORD_FILE / SOURCE_PGPASSWORD / PGPASSWORD)')
  if (!tgtPass) fail('target password missing (TARGET_PGPASSWORD_FILE / TARGET_PGPASSWORD / PGPASSWORD)')

  if (dryRun) {
    const reports = await withClient(srcConn, srcPass, async (src) =>
      withClient(tgtConn, tgtPass, async (tgt) => collectCounts(src, tgt)),
    )
    console.log('dry-run (read-only; no writes)')
    logCounts(reports)
    return
  }

  await withClient(tgtConn, tgtPass, async (tgt) => {
    await applyNeonSchema(tgt)
  })
  const reports = await withClient(srcConn, srcPass, async (src) =>
    withClient(tgtConn, tgtPass, async (tgt) => {
      await runCopy(src, tgt)
      return collectCounts(src, tgt)
    }),
  )
  if (!logCounts(reports)) process.exit(1)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
