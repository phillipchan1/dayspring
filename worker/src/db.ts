import postgres from 'postgres'
import { connectionHostname, isLoopbackHostname } from './authUrl.ts'
import type { Env } from './env.ts'
import { databaseUrl } from './env.ts'

export type Sql = postgres.Sql

/** True only when `connectionString` is the bound Hyperdrive value — not a hostname match. */
export function isBoundHyperdrive(
  env: Pick<Env, 'HYPERDRIVE'> | undefined,
  connectionString: string,
): boolean {
  const bound = env?.HYPERDRIVE?.connectionString
  return typeof bound === 'string' && bound === connectionString
}

/**
 * Honor an explicit sslmode. Otherwise loopback is disable and everything
 * else is verify-full (pg treats require/prefer/verify-ca as verify-full
 * and warns unless the URL says so). Bound Hyperdrive is left unchanged
 * (Cloudflare already terminates TLS to the origin).
 */
export function withPgSslMode(
  connectionString: string,
  env?: Pick<Env, 'HYPERDRIVE'>,
): string {
  if (isBoundHyperdrive(env, connectionString)) return connectionString
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
export function postgresSslOption(
  connectionString: string,
  env?: Pick<Env, 'HYPERDRIVE'>,
): false | 'require' {
  if (isBoundHyperdrive(env, connectionString)) return false
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

/** Shared TLS options for the data client and the Better Auth `pg.Pool`. */
export function pgClientOptions(
  env: Pick<Env, 'HYPERDRIVE'>,
  connectionString: string,
): { connectionString: string; ssl: false | 'require' } {
  if (isBoundHyperdrive(env, connectionString)) {
    return { connectionString, ssl: false }
  }
  const prepared = withPgSslMode(connectionString, env)
  return { connectionString: prepared, ssl: postgresSslOption(prepared, env) }
}

/**
 * Per-request client. Workers cannot reuse I/O objects across requests, and
 * Hyperdrive (prod) already pools — `max: 1` is the recommended pattern.
 * Caller must `closeSql` (typically `ctx.waitUntil(sql.end())`).
 */
export function createSql(env: Env): Sql {
  const url = databaseUrl(env)
  if (!url) throw new Error('database is not configured (HYPERDRIVE or DATABASE_URL)')
  const opts = pgClientOptions(env, url)
  return postgres(opts.connectionString, {
    max: 1,
    // fetch_types must stay on: with it false, JS arrays bind as text and
    // entries.tags / feature_flags inserts fail (then look like conflicts).
    prepare: false,
    ssl: opts.ssl,
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
