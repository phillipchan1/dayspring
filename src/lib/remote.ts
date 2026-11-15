/**
 * Owner-scoped table client for the Worker. Same fluent shape the app used
 * against PostgREST (from/select/eq/…), posted to POST /api/data/query.
 */
import { apiPost } from './api'
import { getSessionState, subscribeSession, type Session } from './sessionStore'

export type FilterCall = { op: string; args: unknown[] }

export interface DataQuerySpec {
  table: string
  mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete'
  columns?: string
  count?: 'exact'
  head?: boolean
  values?: unknown
  onConflict?: string
  ignoreDuplicates?: boolean
  filters?: FilterCall[]
  orders?: Array<{ col: string; ascending?: boolean; nullsFirst?: boolean }>
  limit?: number
  range?: [number, number]
  single?: 'single' | 'maybe'
}

type QueryResult = {
  // Call sites treat this like the previous PostgREST client (untyped rows).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  error: { message: string; code?: string } | null
  count: number | null
}

class ThenableQuery implements PromiseLike<QueryResult> {
  private throwing = false
  constructor(private readonly spec: DataQuerySpec) {}

  throwOnError(): this {
    this.throwing = true
    return this
  }

  select(columns = '*', opts: { count?: 'exact'; head?: boolean } = {}): this {
    if (this.spec.mode === 'select') {
      this.spec.columns = columns
      if (opts.count) this.spec.count = 'exact'
      if (opts.head) this.spec.head = true
    } else {
      this.spec.columns = columns
    }
    return this
  }

  insert(values: object | object[], opts: { count?: 'exact' } = {}): this {
    this.spec.mode = 'insert'
    this.spec.values = values
    if (opts.count) this.spec.count = 'exact'
    return this
  }

  upsert(
    values: object | object[],
    opts: { onConflict?: string; ignoreDuplicates?: boolean; count?: 'exact' } = {},
  ): this {
    this.spec.mode = 'upsert'
    this.spec.values = values
    if (opts.onConflict !== undefined) this.spec.onConflict = opts.onConflict
    if (opts.ignoreDuplicates !== undefined) this.spec.ignoreDuplicates = opts.ignoreDuplicates
    if (opts.count) this.spec.count = 'exact'
    return this
  }

  update(values: object, opts: { count?: 'exact' } = {}): this {
    this.spec.mode = 'update'
    this.spec.values = values
    if (opts.count) this.spec.count = 'exact'
    return this
  }

  delete(opts: { count?: 'exact' } = {}): this {
    this.spec.mode = 'delete'
    if (opts.count) this.spec.count = 'exact'
    return this
  }

  eq(col: string, v: unknown): this { return this.filterCall('eq', [col, v]) }
  neq(col: string, v: unknown): this { return this.filterCall('neq', [col, v]) }
  gt(col: string, v: unknown): this { return this.filterCall('gt', [col, v]) }
  gte(col: string, v: unknown): this { return this.filterCall('gte', [col, v]) }
  lt(col: string, v: unknown): this { return this.filterCall('lt', [col, v]) }
  lte(col: string, v: unknown): this { return this.filterCall('lte', [col, v]) }
  like(col: string, v: string): this { return this.filterCall('like', [col, v]) }
  ilike(col: string, v: string): this { return this.filterCall('ilike', [col, v]) }
  is(col: string, v: null | boolean): this { return this.filterCall('is', [col, v]) }
  in(col: string, values: readonly unknown[]): this { return this.filterCall('in', [col, values]) }
  not(col: string, op: string, value: unknown): this { return this.filterCall('not', [col, op, value]) }
  or(expr: string): this { return this.filterCall('or', [expr]) }
  filter(col: string, op: string, value: unknown): this { return this.filterCall('filter', [col, op, value]) }
  match(obj: Record<string, unknown>): this { return this.filterCall('match', [obj]) }

  order(col: string, opts: { ascending?: boolean; nullsFirst?: boolean } = {}): this {
    const order: { col: string; ascending?: boolean; nullsFirst?: boolean } = { col }
    if (opts.ascending !== undefined) order.ascending = opts.ascending
    if (opts.nullsFirst !== undefined) order.nullsFirst = opts.nullsFirst
    this.spec.orders = [...(this.spec.orders ?? []), order]
    return this
  }

  limit(n: number): this { this.spec.limit = n; return this }
  range(from: number, to: number): this { this.spec.range = [from, to]; return this }
  single(): this { this.spec.single = 'single'; return this }
  maybeSingle(): this { this.spec.single = 'maybe'; return this }

  private filterCall(op: string, args: unknown[]): this {
    this.spec.filters = [...(this.spec.filters ?? []), { op, args }]
    return this
  }

  then<A = QueryResult, B = never>(
    ok?: ((v: QueryResult) => A | PromiseLike<A>) | null,
    bad?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return run(this.spec, this.throwing).then(ok, bad)
  }
}

async function run(spec: DataQuerySpec, throwing: boolean): Promise<QueryResult> {
  const result = await apiPost<QueryResult>('/api/data/query', spec)
  if (throwing && result.error) throw Object.assign(new Error(result.error.message), result.error)
  return result
}

export interface RemoteClient {
  from(table: string): ThenableQuery
  auth: {
    getSession(): Promise<{ data: { session: Session | null } }>
    getUser(): Promise<{ data: { user: { id: string; email?: string | null } | null } }>
    onAuthStateChange(
      cb: (event: string, session: Session | null) => void,
    ): { data: { subscription: { unsubscribe: () => void } } }
  }
}

export function remote(): RemoteClient {
  return {
    from(table: string) {
      return new ThenableQuery({ table, mode: 'select' })
    },
    auth: {
      async getSession() {
        return { data: { session: getSessionState().session } }
      },
      async getUser() {
        const session = getSessionState().session
        return { data: { user: session?.user ?? null } }
      },
      onAuthStateChange(cb) {
        cb('INITIAL_SESSION', getSessionState().session)
        const unsubscribe = subscribeSession(() => {
          cb('TOKEN_REFRESHED', getSessionState().session)
        })
        return { data: { subscription: { unsubscribe } } }
      },
    },
  }
}
