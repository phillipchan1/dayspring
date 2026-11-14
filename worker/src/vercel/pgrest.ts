/**
 * A supabase-js-shaped client over postgres.js, so the Vercel handlers in
 * api/** run unchanged on the Worker against Neon.
 *
 * Covers the subset that code uses: from().select/insert/upsert/update/delete
 * with eq/neq/gt/gte/lt/lte/like/ilike/is/in/not/match/filter, order, limit,
 * range, single, maybeSingle, count (exact, head), one level of many-to-one
 * embedding (`thread_members.select('…, spiritual_items(…)')`), rpc(), and the
 * auth.getUser / auth.admin.listUsers / getUserById calls (Better Auth tables).
 *
 * Rows come back through row_to_json, so values match PostgREST's JSON
 * (timestamps as ISO strings with offset, jsonb as objects, arrays as arrays).
 * Every bound value is sent as text and cast in SQL to the column's type; jsonb
 * goes in as `$n::text::jsonb` (never the double-encoding `${json}::jsonb`).
 */
import type { Sql } from '../db.ts'

export type PgError = { message: string; code: string; details: string | null; hint: string | null }
export type PgResult<T = unknown> = { data: T; error: PgError | null; count: number | null; status: number; statusText: string }

export interface AuthUserShape {
  id: string
  email?: string
  user_metadata: Record<string, unknown>
  app_metadata: Record<string, unknown>
  identities: Array<{ provider: string; id: string; user_id: string }>
  created_at?: string
  aud: 'authenticated'
}

export interface PgRestOptions {
  /** Resolve a bearer token (Better Auth session) to a user id, or null. */
  resolveToken?: (token: string) => Promise<string | null>
}

type Column = { name: string; udt: string; dataType: string; generated: boolean }
type TableMeta = { columns: Map<string, Column>; pk: string[] }
type FnMeta = { args: Array<{ name: string; type: string }>; retset: boolean; composite: boolean }

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/

function q(ident: string): string {
  if (!IDENT.test(ident)) throw pgErr(`invalid identifier: ${ident}`, '42602')
  return `"${ident}"`
}

function pgErr(message: string, code = 'PGRST100', details: string | null = null, hint: string | null = null): PgError & Error {
  const e = new Error(message) as PgError & Error
  e.code = code
  e.details = details
  e.hint = hint
  return e
}

function toPgError(err: unknown): PgError {
  const e = err as { message?: string; code?: string; detail?: string; details?: string; hint?: string }
  return {
    message: e?.message ?? String(err),
    code: e?.code ?? 'PGRST000',
    details: e?.details ?? e?.detail ?? null,
    hint: e?.hint ?? null,
  }
}

/** Text form of a JS value for a column of `udt` (sent as $n::text, cast in SQL). */
function serialize(value: unknown, col: Column | undefined): string | null {
  if (value === null || value === undefined) return null
  const udt = col?.udt ?? ''
  if (udt === 'jsonb' || udt === 'json') return JSON.stringify(value)
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value) || (typeof value === 'object')) {
    // vector-as-TEXT, or any object into a text column: pgvector's text form is JSON.
    return JSON.stringify(value)
  }
  return String(value)
}

/** SQL expression that turns param $n (text) into the column type. */
function castExpr(n: number, value: unknown, col: Column | undefined): string {
  const udt = col?.udt
  if (!udt) return `$${n}`
  if (udt.startsWith('_')) {
    // JS array → JSON text → array of the element type. A PostgREST literal string ('{a,b}') casts directly.
    if (Array.isArray(value)) return `ARRAY(SELECT jsonb_array_elements_text($${n}::text::jsonb))::${q(udt.slice(1))}[]`
    return `$${n}::text::${q(udt.slice(1))}[]`
  }
  return `$${n}::text::${q(udt)}`
}

type Filter = (meta: TableMeta, p: Params, alias: string) => string

class Params {
  values: (string | null)[] = []
  add(value: unknown, col: Column | undefined): string {
    this.values.push(serialize(value, col))
    return castExpr(this.values.length, value, col)
  }
  addText(value: string | null): string {
    this.values.push(value)
    return `$${this.values.length}::text`
  }
}

const OPS: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'ILIKE' }

/** Parse a PostgREST list literal `(a,b,"c d")`. */
function parseList(raw: string): string[] {
  const s = raw.trim().replace(/^\(/, '').replace(/\)$/, '')
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '"') { quoted = !quoted; continue }
    if (ch === '\\' && quoted && i + 1 < s.length) { cur += s[++i]; continue }
    if (ch === ',' && !quoted) { out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim() || out.length) out.push(cur.trim())
  return out.filter((v) => v !== '')
}

function splitTop(select: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of select) {
    if (ch === '(') depth++
    if (ch === ')') depth--
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function singular(rel: string): string {
  return rel.endsWith('ies') ? `${rel.slice(0, -3)}y` : rel.endsWith('s') ? rel.slice(0, -1) : rel
}

export class PgRestClient {
  private tables = new Map<string, Promise<TableMeta>>()
  private fns = new Map<string, Promise<FnMeta>>()
  readonly sql: Sql
  readonly opts: PgRestOptions
  readonly auth: ReturnType<PgRestClient['makeAuth']>

  constructor(sql: Sql, opts: PgRestOptions = {}) {
    this.sql = sql
    this.opts = opts
    this.auth = this.makeAuth()
  }

  async exec(text: string, params: (string | null)[]): Promise<Record<string, unknown>[]> {
    return (await this.sql.unsafe(text, params as never[])) as unknown as Record<string, unknown>[]
  }

  table(name: string): Promise<TableMeta> {
    let hit = this.tables.get(name)
    if (!hit) {
      hit = (async () => {
        const cols = await this.exec(
          `SELECT column_name AS name, udt_name AS udt, data_type AS "dataType", (is_generated <> 'NEVER') AS generated
             FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1::text ORDER BY ordinal_position`,
          [name],
        )
        if (!cols.length) throw pgErr(`relation "public.${name}" does not exist`, '42P01')
        const pk = await this.exec(
          `SELECT a.attname AS name FROM pg_index i
             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = ('public.' || quote_ident($1::text))::regclass AND i.indisprimary`,
          [name],
        )
        return {
          columns: new Map(cols.map((c) => [String(c.name), c as unknown as Column])),
          pk: pk.map((r) => String(r.name)),
        }
      })()
      hit.catch(() => this.tables.delete(name))
      this.tables.set(name, hit)
    }
    return hit
  }

  fn(name: string): Promise<FnMeta> {
    let hit = this.fns.get(name)
    if (!hit) {
      hit = (async () => {
        const rows = await this.exec(
          `SELECT p.proretset AS retset,
                  (t.typtype = 'c' OR p.proargmodes IS NOT NULL AND 't' = ANY(p.proargmodes::text[])) AS composite,
                  COALESCE(p.proargnames, '{}') AS names,
                  COALESCE(p.proargmodes::text[], '{}') AS modes,
                  ARRAY(SELECT format_type(x, NULL) FROM unnest(p.proallargtypes) x) AS alltypes,
                  ARRAY(SELECT format_type(x, NULL) FROM unnest(p.proargtypes::oid[]) x) AS intypes
             FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_type t ON t.oid = p.prorettype
            WHERE n.nspname = 'public' AND p.proname = $1::text`,
          [name],
        )
        const r = rows[0]
        if (!r) throw pgErr(`Could not find the function public.${name}`, 'PGRST202')
        const names = r.names as string[]
        const modes = r.modes as string[]
        const types = (modes.length ? (r.alltypes as string[]) : (r.intypes as string[]))
        const args: FnMeta['args'] = []
        names.forEach((argName, i) => {
          const mode = modes[i] ?? 'i'
          if (mode === 'i' || mode === 'b' || mode === 'v') args.push({ name: argName, type: types[i] })
        })
        return { args, retset: Boolean(r.retset), composite: Boolean(r.composite) }
      })()
      hit.catch(() => this.fns.delete(name))
      this.fns.set(name, hit)
    }
    return hit
  }

  from(table: string): QueryBuilder {
    return new QueryBuilder(this, table)
  }

  rpc(name: string, args: Record<string, unknown> = {}, options: { count?: 'exact'; head?: boolean } = {}): RpcBuilder {
    return new RpcBuilder(this, name, args, options)
  }

  // ── auth (Better Auth tables "user" / account) ───────────────────────────
  async userById(id: string): Promise<AuthUserShape | null> {
    const rows = await this.exec(
      `SELECT row_to_json(u)::text AS j FROM (
         SELECT u.id, u.email, u.name, u.image, u.created_at,
                COALESCE((SELECT json_agg(json_build_object('provider', a.provider_id, 'id', a.account_id, 'user_id', a.user_id))
                            FROM account a WHERE a.user_id = u.id), '[]'::json) AS identities
           FROM "user" u WHERE u.id = $1::text) u`,
      [id],
    )
    return rows[0] ? toAuthUser(JSON.parse(String(rows[0].j))) : null
  }

  private makeAuth() {
    const self = this
    return {
      async getUser(token?: string) {
        try {
          const id = token && self.opts.resolveToken ? await self.opts.resolveToken(token) : null
          const user = id ? await self.userById(id) : null
          if (!user) return { data: { user: null }, error: { message: 'invalid JWT', status: 401, name: 'AuthApiError' } }
          return { data: { user }, error: null }
        } catch (err) {
          return { data: { user: null }, error: { message: toPgError(err).message, status: 500, name: 'AuthApiError' } }
        }
      },
      admin: {
        async getUserById(id: string) {
          try {
            const user = await self.userById(id)
            if (!user) return { data: { user: null }, error: { message: 'User not found', status: 404, name: 'AuthApiError' } }
            return { data: { user }, error: null }
          } catch (err) {
            return { data: { user: null }, error: { message: toPgError(err).message, status: 500, name: 'AuthApiError' } }
          }
        },
        async listUsers(params: { page?: number; perPage?: number } = {}) {
          const perPage = Math.max(1, Math.min(params.perPage ?? 50, 1000))
          const page = Math.max(1, params.page ?? 1)
          try {
            const rows = await self.exec(
              `SELECT COALESCE(json_agg(row_to_json(u)), '[]'::json)::text AS j FROM (
                 SELECT u.id, u.email, u.name, u.image, u.created_at,
                        COALESCE((SELECT json_agg(json_build_object('provider', a.provider_id, 'id', a.account_id, 'user_id', a.user_id))
                                    FROM account a WHERE a.user_id = u.id), '[]'::json) AS identities
                   FROM "user" u ORDER BY u.created_at, u.id LIMIT $1::text::int OFFSET $2::text::int) u`,
              [String(perPage), String((page - 1) * perPage)],
            )
            const users = (JSON.parse(String(rows[0]?.j ?? '[]')) as Record<string, unknown>[]).map(toAuthUser)
            return { data: { users, aud: 'authenticated' }, error: null }
          } catch (err) {
            return { data: { users: [] as AuthUserShape[] }, error: { message: toPgError(err).message, status: 500, name: 'AuthApiError' } }
          }
        },
      },
    }
  }
}

/** Supabase-shaped user from a Better Auth row. Name/image stand in for provider metadata. */
function toAuthUser(row: Record<string, unknown>): AuthUserShape {
  const identities = (row.identities as AuthUserShape['identities']) ?? []
  const name = typeof row.name === 'string' && row.name ? row.name : undefined
  const image = typeof row.image === 'string' && row.image ? row.image : undefined
  return {
    id: String(row.id),
    email: typeof row.email === 'string' ? row.email : undefined,
    user_metadata: {
      ...(name ? { name, full_name: name } : {}),
      ...(image ? { avatar_url: image, picture: image } : {}),
    },
    app_metadata: { provider: identities[0]?.provider, providers: identities.map((i) => i.provider) },
    identities,
    created_at: typeof row.created_at === 'string' ? row.created_at : undefined,
    aud: 'authenticated',
  }
}

type Mode = 'select' | 'insert' | 'upsert' | 'update' | 'delete'

abstract class Thenable<T> implements PromiseLike<PgResult<T>> {
  protected throwing = false
  abstract run(): Promise<PgResult<T>>
  throwOnError(): this { this.throwing = true; return this }
  then<A = PgResult<T>, B = never>(ok?: ((v: PgResult<T>) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null): Promise<A | B> {
    return this.run().then((res) => {
      if (this.throwing && res.error) throw Object.assign(new Error(res.error.message), res.error)
      return res
    }).then(ok, bad)
  }
}

export class QueryBuilder extends Thenable<unknown> {
  private mode: Mode = 'select'
  private columns = '*'
  private returning = false
  private filters: Filter[] = []
  private orders: Array<{ col: string; asc: boolean; nullsFirst?: boolean }> = []
  private limitN: number | null = null
  private offsetN: number | null = null
  private singleMode: 'single' | 'maybe' | null = null
  private countMode: 'exact' | null = null
  private head = false
  private values: Record<string, unknown>[] = []
  private onConflict: string | null = null
  private ignoreDuplicates = false
  private multi = false
  private readonly client: PgRestClient
  private readonly tableName: string

  constructor(client: PgRestClient, table: string) {
    super()
    this.client = client
    this.tableName = table
  }

  select(columns = '*', opts: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean } = {}): this {
    if (this.mode === 'select') {
      this.columns = columns
      if (opts.count) this.countMode = 'exact'
      if (opts.head) this.head = true
    } else {
      this.returning = true
      this.columns = columns
    }
    return this
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[], opts: { count?: 'exact' } = {}): this {
    this.mode = 'insert'
    this.multi = Array.isArray(values)
    this.values = Array.isArray(values) ? values : [values]
    if (opts.count) this.countMode = 'exact'
    return this
  }

  upsert(values: Record<string, unknown> | Record<string, unknown>[], opts: { onConflict?: string; ignoreDuplicates?: boolean; count?: 'exact' } = {}): this {
    this.mode = 'upsert'
    this.multi = Array.isArray(values)
    this.values = Array.isArray(values) ? values : [values]
    this.onConflict = opts.onConflict ?? null
    this.ignoreDuplicates = Boolean(opts.ignoreDuplicates)
    if (opts.count) this.countMode = 'exact'
    return this
  }

  update(values: Record<string, unknown>, opts: { count?: 'exact' } = {}): this {
    this.mode = 'update'
    this.values = [values]
    if (opts.count) this.countMode = 'exact'
    return this
  }

  delete(opts: { count?: 'exact' } = {}): this {
    this.mode = 'delete'
    if (opts.count) this.countMode = 'exact'
    return this
  }

  /** `col`, or a JSON path `col->>key` / `col->key` (compared as text / jsonb). */
  private colRef(meta: TableMeta, alias: string, raw: string): { sql: string; col: Column | undefined } {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)((?:->>?[A-Za-z0-9_]+)*)$/.exec(raw)
    if (!m) throw pgErr(`unsupported column reference: ${raw}`)
    const [, name, path] = m
    const c = meta.columns.get(name)
    if (!c) throw pgErr(`column ${this.tableName}.${name} does not exist`, '42703')
    if (!path) return { sql: `${alias}.${q(name)}`, col: c }
    let sql = `${alias}.${q(name)}`
    let last = ''
    for (const step of path.match(/->>?[A-Za-z0-9_]+/g) ?? []) {
      last = step.startsWith('->>') ? '->>' : '->'
      const key = step.slice(last.length)
      sql += `${last}'${key}'`
    }
    const t: Column = { name, udt: last === '->>' ? 'text' : 'jsonb', dataType: '', generated: false }
    return { sql: `(${sql})`, col: t }
  }

  /** One PostgREST condition (`col`, op, value) → SQL. Shared by filters and or(). */
  private cond(meta: TableMeta, p: Params, alias: string, col: string, op: string, value: unknown, negate: boolean): string {
    let out: string
    if (op === 'is') {
      const r = this.colRef(meta, alias, col)
      const v = value === null || value === 'null' ? 'NULL' : value === true || value === 'true' ? 'TRUE' : 'FALSE'
      out = `${r.sql} IS ${v}`
    } else if (op === 'in') {
      const list = Array.isArray(value) ? value : parseList(String(value))
      out = this.inSql(meta, p, alias, col, list, false)
    } else {
      const sqlOp = OPS[op]
      if (!sqlOp) throw pgErr(`unsupported filter operator: ${op}`)
      const r = this.colRef(meta, alias, col)
      out = `${r.sql} ${sqlOp} ${p.add(value, r.col)}`
    }
    return negate ? `NOT (${out})` : out
  }

  private cmp(col: string, op: string, value: unknown): this {
    const key = Object.entries(OPS).find(([, v]) => v === op)?.[0] ?? op
    this.filters.push((meta, p, alias) => this.cond(meta, p, alias, col, key, value, false))
    return this
  }

  /** PostgREST `or=(a.eq.1,b.is.null,c->>k.eq.x,not.d.in.(1,2))` — one level, no nested and()/or(). */
  or(expr: string): this {
    const terms = splitTop(expr)
    this.filters.push((meta, p, alias) => {
      const parts = terms.map((term) => {
        let t = term
        let negate = false
        if (t.startsWith('not.')) { negate = true; t = t.slice(4) }
        const m = /^([A-Za-z0-9_>-]+)\.([a-z]+)\.(.*)$/s.exec(t)
        if (!m) throw pgErr(`unsupported or() term: ${term}`)
        let [, col, op, raw] = m
        if (op === 'not') {
          negate = !negate
          const m2 = /^([a-z]+)\.(.*)$/s.exec(raw)
          if (!m2) throw pgErr(`unsupported or() term: ${term}`)
          ;[, op, raw] = m2
        }
        const value = op === 'is' ? raw : op === 'in' ? parseList(raw) : raw.replace(/^"(.*)"$/s, '$1')
        return this.cond(meta, p, alias, col, op, value, negate)
      })
      return `(${parts.join(' OR ')})`
    })
    return this
  }

  eq(col: string, v: unknown): this { return this.cmp(col, '=', v) }
  neq(col: string, v: unknown): this { return this.cmp(col, '<>', v) }
  gt(col: string, v: unknown): this { return this.cmp(col, '>', v) }
  gte(col: string, v: unknown): this { return this.cmp(col, '>=', v) }
  lt(col: string, v: unknown): this { return this.cmp(col, '<', v) }
  lte(col: string, v: unknown): this { return this.cmp(col, '<=', v) }
  like(col: string, v: string): this { return this.cmp(col, 'LIKE', v) }
  ilike(col: string, v: string): this { return this.cmp(col, 'ILIKE', v) }

  is(col: string, v: null | boolean): this {
    this.filters.push((meta, _p, alias) => {
      if (!meta.columns.has(col)) throw pgErr(`column ${this.tableName}.${col} does not exist`, '42703')
      return `${alias}.${q(col)} IS ${v === null ? 'NULL' : v ? 'TRUE' : 'FALSE'}`
    })
    return this
  }

  in(col: string, values: readonly unknown[]): this {
    this.filters.push((meta, p, alias) => this.inSql(meta, p, alias, col, [...values], false))
    return this
  }

  private inSql(meta: TableMeta, p: Params, alias: string, col: string, values: unknown[], negate: boolean): string {
    const r = this.colRef(meta, alias, col)
    const c = r.col as Column
    if (!values.length) return negate ? 'TRUE' : 'FALSE'
    const arr = p.addText(JSON.stringify(values.map((v) => (v === null || v === undefined ? null : String(v)))))
    const expr = `${r.sql} = ANY(ARRAY(SELECT jsonb_array_elements_text(${arr}::jsonb))::${q(c.udt)}[])`
    return negate ? `NOT (${expr})` : expr
  }

  not(col: string, op: string, value: unknown): this {
    this.filters.push((meta, p, alias) => {
      if (op === 'is') {
        if (!meta.columns.has(col)) throw pgErr(`column ${this.tableName}.${col} does not exist`, '42703')
        const v = value === null || value === 'null' ? 'NULL' : value === true || value === 'true' ? 'TRUE' : 'FALSE'
        return `${alias}.${q(col)} IS NOT ${v}`
      }
      if (op === 'in') {
        const list = Array.isArray(value) ? value : parseList(String(value))
        return this.inSql(meta, p, alias, col, list, true)
      }
      const sqlOp = OPS[op]
      if (!sqlOp) throw pgErr(`unsupported not() operator: ${op}`)
      const c = meta.columns.get(col)
      if (!c) throw pgErr(`column ${this.tableName}.${col} does not exist`, '42703')
      return `NOT (${alias}.${q(col)} ${sqlOp} ${p.add(value, c)})`
    })
    return this
  }

  filter(col: string, op: string, value: unknown): this {
    if (op === 'in') {
      const list = Array.isArray(value) ? value : parseList(String(value))
      return this.in(col, list)
    }
    if (op === 'is') return this.is(col, value === null || value === 'null' ? null : value === true || value === 'true')
    const sqlOp = OPS[op]
    if (!sqlOp) throw pgErr(`unsupported filter operator: ${op}`)
    return this.cmp(col, sqlOp, value)
  }

  match(obj: Record<string, unknown>): this {
    for (const [k, v] of Object.entries(obj)) this.eq(k, v)
    return this
  }

  order(col: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}): this {
    this.orders.push({ col, asc: opts.ascending ?? true, nullsFirst: opts.nullsFirst })
    return this
  }

  limit(n: number): this { this.limitN = n; return this }
  range(from: number, to: number): this { this.offsetN = from; this.limitN = to - from + 1; return this }
  single(): this { this.singleMode = 'single'; return this }
  maybeSingle(): this { this.singleMode = 'maybe'; return this }

  /** SELECT list for `this.columns` over alias t (with one-level embeds). */
  private async selectList(meta: TableMeta, alias: string): Promise<string> {
    const parts: string[] = []
    for (const item of splitTop(this.columns)) {
      if (item === '*') {
        parts.push(`${alias}.*`)
        continue
      }
      const embed = /^(?:([A-Za-z_][A-Za-z0-9_]*):)?([A-Za-z_][A-Za-z0-9_]*)(?:!inner)?\((.*)\)$/s.exec(item)
      if (embed) {
        const [, as, rel, inner] = embed
        const relMeta = await this.client.table(rel)
        const fk = `${singular(rel)}_id`
        if (!meta.columns.has(fk) || !relMeta.columns.has('id')) {
          throw pgErr(`Could not find a relationship between '${this.tableName}' and '${rel}'`, 'PGRST200')
        }
        const innerCols = splitTop(inner).map((c) => {
          if (c === '*') return 'r.*'
          if (!relMeta.columns.has(c)) throw pgErr(`column ${rel}.${c} does not exist`, '42703')
          return `r.${q(c)}`
        })
        parts.push(`(SELECT row_to_json(x) FROM (SELECT ${innerCols.join(', ')} FROM ${q(rel)} r WHERE r."id" = ${alias}.${q(fk)}) x) AS ${q(as ?? rel)}`)
        continue
      }
      const m = /^(?:([A-Za-z_][A-Za-z0-9_]*):)?([A-Za-z_][A-Za-z0-9_]*)(?:::([a-z0-9_]+))?$/.exec(item)
      if (!m) throw pgErr(`unsupported select item: ${item}`)
      const [, as, col, cast] = m
      if (!meta.columns.has(col)) throw pgErr(`column ${this.tableName}.${col} does not exist`, '42703')
      parts.push(`${alias}.${q(col)}${cast ? `::${q(cast)}` : ''} AS ${q(as ?? col)}`)
    }
    return parts.join(', ')
  }

  private where(meta: TableMeta, p: Params, alias: string): string {
    const parts = this.filters.map((f) => f(meta, p, alias))
    return parts.length ? ` WHERE ${parts.join(' AND ')}` : ''
  }

  private tail(meta: TableMeta, alias: string): string {
    let s = ''
    if (this.orders.length) {
      s += ' ORDER BY ' + this.orders.map((o) => {
        if (!meta.columns.has(o.col)) throw pgErr(`column ${this.tableName}.${o.col} does not exist`, '42703')
        const nulls = o.nullsFirst === undefined ? '' : o.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST'
        return `${alias}.${q(o.col)} ${o.asc ? 'ASC' : 'DESC'}${nulls}`
      }).join(', ')
    }
    if (this.limitN !== null) s += ` LIMIT ${Math.max(0, Math.floor(this.limitN))}`
    if (this.offsetN !== null) s += ` OFFSET ${Math.max(0, Math.floor(this.offsetN))}`
    return s
  }

  private shape(rows: unknown[], count: number | null): PgResult<unknown> {
    if (this.singleMode) {
      if (rows.length === 1) return { data: rows[0], error: null, count, status: 200, statusText: 'OK' }
      if (rows.length === 0 && this.singleMode === 'maybe') return { data: null, error: null, count, status: 200, statusText: 'OK' }
      return {
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116', details: `The result contains ${rows.length} rows`, hint: null },
        count,
        status: 406,
        statusText: 'Not Acceptable',
      }
    }
    return { data: rows, error: null, count, status: 200, statusText: 'OK' }
  }

  async run(): Promise<PgResult<unknown>> {
    try {
      const meta = await this.client.table(this.tableName)
      const t = q(this.tableName)
      const p = new Params()
      if (this.mode === 'select') {
        const where = this.where(meta, p, 't')
        let count: number | null = null
        if (this.countMode) {
          const r = await this.client.exec(`SELECT count(*)::text AS n FROM ${t} t${where}`, p.values)
          count = Number(r[0]?.n ?? 0)
        }
        if (this.head) return { data: null, error: null, count, status: 200, statusText: 'OK' }
        const list = await this.selectList(meta, 't')
        const text = `SELECT COALESCE(json_agg(row_to_json(q)), '[]'::json)::text AS j FROM (SELECT ${list} FROM ${t} t${where}${this.tail(meta, 't')}) q`
        const r = await this.client.exec(text, p.values)
        return this.shape(JSON.parse(String(r[0]?.j ?? '[]')) as unknown[], count)
      }

      let core: string
      if (this.mode === 'insert' || this.mode === 'upsert') {
        if (!this.values.length) return { data: this.returning ? [] : null, error: null, count: null, status: 201, statusText: 'Created' }
        const cols = [...new Set(this.values.flatMap((v) => Object.keys(v)))]
        for (const c of cols) if (!meta.columns.has(c)) throw pgErr(`Could not find the '${c}' column of '${this.tableName}' in the schema cache`, 'PGRST204')
        const rowsSql = this.values.map((row) => `(${cols.map((c) => {
          const v = row[c]
          // supabase-js multi-row inserts send null for a key a row lacks (defaultToNull);
          // a single row only names its own keys, so this branch only triggers on arrays.
          return p.add(v === undefined ? null : v, meta.columns.get(c))
        }).join(', ')})`)
        core = `INSERT INTO ${t} AS t (${cols.map(q).join(', ')}) VALUES ${rowsSql.join(', ')}`
        if (this.mode === 'upsert') {
          const target = (this.onConflict ? this.onConflict.split(',').map((s) => s.trim()).filter(Boolean) : meta.pk)
          if (!target.length) throw pgErr(`no primary key for upsert on ${this.tableName}`)
          const sets = cols.filter((c) => !target.includes(c)).map((c) => `${q(c)} = EXCLUDED.${q(c)}`)
          core += ` ON CONFLICT (${target.map(q).join(', ')}) ${this.ignoreDuplicates || !sets.length ? 'DO NOTHING' : `DO UPDATE SET ${sets.join(', ')}`}`
        }
      } else if (this.mode === 'update') {
        const vals = this.values[0] ?? {}
        const cols = Object.keys(vals)
        for (const c of cols) if (!meta.columns.has(c)) throw pgErr(`Could not find the '${c}' column of '${this.tableName}' in the schema cache`, 'PGRST204')
        if (!cols.length) throw pgErr('update with no columns')
        const sets = cols.map((c) => `${q(c)} = ${p.add(vals[c], meta.columns.get(c))}`)
        core = `UPDATE ${t} AS t SET ${sets.join(', ')}${this.where(meta, p, 't')}`
      } else {
        core = `DELETE FROM ${t} AS t${this.where(meta, p, 't')}`
      }

      if (!this.returning && !this.countMode) {
        await this.client.exec(core, p.values)
        return { data: null, error: null, count: null, status: this.mode === 'insert' ? 201 : 204, statusText: 'OK' }
      }
      const list = this.returning ? await this.selectList(meta, 'm') : 'm.*'
      const text = `WITH m AS (${core} RETURNING t.*)
        SELECT (SELECT count(*) FROM m)::text AS n,
               COALESCE((SELECT json_agg(row_to_json(q)) FROM (SELECT ${list} FROM m${this.tail(meta, 'm')}) q), '[]'::json)::text AS j`
      const r = await this.client.exec(text, p.values)
      const count = this.countMode ? Number(r[0]?.n ?? 0) : null
      if (!this.returning) return { data: null, error: null, count, status: 200, statusText: 'OK' }
      const rows = JSON.parse(String(r[0]?.j ?? '[]')) as unknown[]
      if (!this.singleMode && !this.multi && this.mode !== 'update' && this.mode !== 'delete') {
        return { data: rows, error: null, count, status: 201, statusText: 'Created' }
      }
      return this.shape(rows, count)
    } catch (err) {
      return { data: null, error: toPgError(err), count: null, status: 400, statusText: 'Bad Request' }
    }
  }
}

export class RpcBuilder extends Thenable<unknown> {
  private singleMode: 'single' | 'maybe' | null = null
  private readonly client: PgRestClient
  private readonly name: string
  private readonly args: Record<string, unknown>
  private readonly options: { count?: 'exact'; head?: boolean }

  constructor(client: PgRestClient, name: string, args: Record<string, unknown>, options: { count?: 'exact'; head?: boolean }) {
    super()
    this.client = client
    this.name = name
    this.args = args
    this.options = options
  }

  single(): this { this.singleMode = 'single'; return this }
  maybeSingle(): this { this.singleMode = 'maybe'; return this }

  async run(): Promise<PgResult<unknown>> {
    try {
      const meta = await this.client.fn(this.name)
      const p = new Params()
      const named: string[] = []
      for (const [k, v] of Object.entries(this.args)) {
        const arg = meta.args.find((a) => a.name === k)
        if (!arg) throw pgErr(`Could not find the function public.${this.name}(${Object.keys(this.args).join(', ')})`, 'PGRST202')
        p.values.push(serialize(v, { name: k, udt: arg.type === 'jsonb' ? 'jsonb' : arg.type, dataType: arg.type, generated: false }))
        const n = p.values.length
        const type = arg.type.endsWith('[]') && Array.isArray(v)
          ? `ARRAY(SELECT jsonb_array_elements_text($${n}::text::jsonb))::${arg.type}`
          : `$${n}::text::${arg.type}`
        named.push(`${q(k)} => ${type}`)
      }
      const call = `${q(this.name)}(${named.join(', ')})`
      const text = meta.retset || meta.composite
        ? `SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json)::text AS j FROM ${call} r`
        : `SELECT to_json(${call})::text AS j`
      const r = await this.client.exec(text, p.values)
      let data: unknown = JSON.parse(String(r[0]?.j ?? 'null'))
      if (!meta.retset && meta.composite && Array.isArray(data)) data = data[0] ?? null
      if (this.singleMode && Array.isArray(data)) {
        if (data.length === 1) data = data[0]
        else if (data.length === 0 && this.singleMode === 'maybe') data = null
        else return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116', details: null, hint: null }, count: null, status: 406, statusText: 'Not Acceptable' }
      }
      const count = this.options.count && Array.isArray(data) ? data.length : null
      return { data: this.options.head ? null : data, error: null, count, status: 200, statusText: 'OK' }
    } catch (err) {
      return { data: null, error: toPgError(err), count: null, status: 400, statusText: 'Bad Request' }
    }
  }
}

export function createPgRestClient(sql: Sql, opts: PgRestOptions = {}): PgRestClient {
  return new PgRestClient(sql, opts)
}
