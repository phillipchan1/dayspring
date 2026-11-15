/**
 * Server-side table client. On the Worker this is the Neon pgrest shim
 * (worker/src/vercel/bridge.ts). There is no hosted Supabase client.
 *
 * `from()` is a fluent thenable whose row type is untyped (`data: any`), matching
 * the previous supabase-js usage in the ported Vercel handlers.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RowData = any

export type AdminQuery = {
  select: (...args: RowData[]) => AdminQuery
  insert: (...args: RowData[]) => AdminQuery
  upsert: (...args: RowData[]) => AdminQuery
  update: (...args: RowData[]) => AdminQuery
  delete: (...args: RowData[]) => AdminQuery
  eq: (...args: RowData[]) => AdminQuery
  neq: (...args: RowData[]) => AdminQuery
  gt: (...args: RowData[]) => AdminQuery
  gte: (...args: RowData[]) => AdminQuery
  lt: (...args: RowData[]) => AdminQuery
  lte: (...args: RowData[]) => AdminQuery
  like: (...args: RowData[]) => AdminQuery
  ilike: (...args: RowData[]) => AdminQuery
  is: (...args: RowData[]) => AdminQuery
  in: (...args: RowData[]) => AdminQuery
  not: (...args: RowData[]) => AdminQuery
  or: (...args: RowData[]) => AdminQuery
  filter: (...args: RowData[]) => AdminQuery
  match: (...args: RowData[]) => AdminQuery
  order: (...args: RowData[]) => AdminQuery
  limit: (...args: RowData[]) => AdminQuery
  range: (...args: RowData[]) => AdminQuery
  single: (...args: RowData[]) => AdminQuery
  maybeSingle: (...args: RowData[]) => AdminQuery
  throwOnError: (...args: RowData[]) => AdminQuery
  then: (
    onfulfilled?: (value: { data: RowData; error: { message: string; code?: string } | null; count: number | null }) => RowData,
    onrejected?: (reason: RowData) => RowData,
  ) => Promise<RowData>
}

export type AdminUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
  app_metadata?: Record<string, unknown>
}

export type AdminClient = {
  from: (relation: string) => AdminQuery
  rpc: (fn: string, args?: Record<string, unknown>, opts?: Record<string, unknown>) => AdminQuery
  auth: {
    getUser: (token?: string) => Promise<{
      data: { user: AdminUser | null }
      error: { message: string; code?: string } | null
    }>
    admin: {
      getUserById: (id: string) => Promise<{
        data: { user: AdminUser | null }
        error: { message: string; code?: string } | null
      }>
      listUsers: (params?: { page?: number; perPage?: number }) => Promise<{
        data: { users: AdminUser[] }
        error: { message: string; code?: string } | null
      }>
    }
  }
}

let override: (() => AdminClient) | null = null
export function setSupabaseAdminOverride(fn: (() => AdminClient) | null): void {
  override = fn
}

export function supabaseAdmin(): AdminClient {
  if (override) return override()
  throw new Error(
    'supabaseAdmin() has no client. The Worker sets an override per request; this path is not a hosted Supabase project.',
  )
}
