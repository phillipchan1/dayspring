import postgres from 'postgres'
import { connectionHostname, isLoopbackHostname } from './authUrl.ts'
import type { Env } from './env.ts'
import { databaseUrl } from './env.ts'

export type Sql = postgres.Sql

/**
 * Honor an explicit sslmode. Otherwise loopback is disable and everything
 * else is verify-full (pg treats require/prefer/verify-ca as verify-full
 * and warns unless the URL says so).
 */
export function withPgSslMode(connectionString: string): string {
  let parsed: URL
  try {
    parsed = new URL(connectionString)
  } catch {
    return connectionString
  }
  const existing = parsed.searchParams.get('sslmode')?.toLowerCase() ?? ''
  if (existing === 'disable') return connectionString
  const host = parsed.hostname
  const loopback = Boolean(host && isLoopbackHostname(host))
  if (loopback) {
    if (!existing) parsed.searchParams.set('sslmode', 'disable')
    return parsed.toString()
  }
  if (!existing || existing === 'prefer' || existing === 'require' || existing === 'verify-ca') {
    parsed.searchParams.set('sslmode', 'verify-full')
  }
  return parsed.toString()
}

/** postgres.js `ssl` option. Parse sslmode — never substring-match the URL. */
export function postgresSslOption(connectionString: string): false | 'require' {
  try {
    const mode = new URL(connectionString).searchParams.get('sslmode')?.toLowerCase()
    if (mode === 'disable') return false
    if (mode === 'require' || mode === 'verify-ca' || mode === 'verify-full') return 'require'
  } catch {
    // fall through to hostname
  }
  const host = connectionHostname(connectionString)
  return host && isLoopbackHostname(host) ? false : 'require'
}

/**
 * Per-request client. Workers cannot reuse I/O objects across requests, and
 * Hyperdrive (prod) already pools — `max: 1` is the recommended pattern.
 * Caller must `closeSql` (typically `ctx.waitUntil(sql.end())`).
 */
export function createSql(env: Env): Sql {
  const url = databaseUrl(env)
  if (!url) throw new Error('database is not configured (HYPERDRIVE or DATABASE_URL)')
  const prepared = withPgSslMode(url)
  return postgres(prepared, {
    max: 1,
    // fetch_types must stay on: with it false, JS arrays bind as text and
    // entries.tags / feature_flags inserts fail (then look like conflicts).
    prepare: false,
    ssl: postgresSslOption(prepared),
  })
}

/** @deprecated alias — not cached; same as createSql. */
export function getSql(env: Env): Sql {
  return createSql(env)
}

export async function closeSql(sql: Sql): Promise<void> {
  await sql.end({ timeout: 5 })
}

export function asJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

/** postgres.js JSONValue is invariant; clone through JSON so we can bind objects. */
export function jsonParam(sql: Sql, value: unknown): ReturnType<Sql['json']> {
  return sql.json(JSON.parse(JSON.stringify(value)) as Parameters<Sql['json']>[0])
}

/** Bind a TEXT[] so tags / feature_flags / terms never serialize as a scalar. */
export function textArray(sql: Sql, values: string[]): ReturnType<Sql['array']> {
  return sql.array(values)
}
