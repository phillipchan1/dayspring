// Keeps Resend Contacts in lockstep with Dayspring accounts so Broadcasts
// (feature announcements) can go to "everyone who has an account" without a
// CSV. Transactional mail (reminders) still uses api/_lib/notify.ts — this
// module never sends email.
//
// Source of truth is Supabase auth.users. Resend is a projection:
//   • signup / profile ensure → upsert + add to the accounts segment
//   • account delete         → remove the contact
//   • daily cron             → reconcile (catch missed hooks, drop leftovers)
//
// An existing `unsubscribed: true` on a contact is never overwritten. Broadcasts
// skip those rows automatically.

import { waitUntil } from '@vercel/functions'
import { env } from './env.js'

const RESEND = 'https://api.resend.com'
export const DEFAULT_SEGMENT_NAME = 'Dayspring accounts'

export interface AccountContact {
  email: string
  firstName?: string
  lastName?: string
}

export interface AuthUserLike {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

export interface AudienceSyncResult {
  segmentId: string
  upserted: number
  removed: number
  errors: string[]
}

export type ResendMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface ResendRequest {
  method: ResendMethod
  path: string
  body?: unknown
}

export interface ResendResponse {
  status: number
  json: unknown
}

export type ResendTransport = (req: ResendRequest) => Promise<ResendResponse>

// ── Name + email shaping (pure) ──────────────────────────────────────────────

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/**
 * Pull a first/last name out of Supabase `user_metadata`.
 * Google puts a string on `full_name` / `name`; Apple sometimes puts
 * `{ givenName, familyName }` on `full_name`.
 */
export function nameFromAuthMetadata(
  meta: Record<string, unknown> | null | undefined,
): Pick<AccountContact, 'firstName' | 'lastName'> {
  if (!meta) return {}

  const given = asString(meta.given_name)
  const family = asString(meta.family_name)
  if (given) return { firstName: given, lastName: family }

  const full = meta.full_name
  if (full && typeof full === 'object') {
    const obj = full as { givenName?: unknown; familyName?: unknown }
    const first = asString(obj.givenName)
    const last = asString(obj.familyName)
    if (first) return { firstName: first, lastName: last }
  }

  const fullStr = asString(full) ?? asString(meta.name)
  if (!fullStr) return {}
  const [first, ...rest] = fullStr.split(/\s+/)
  return { firstName: first, lastName: rest.length > 0 ? rest.join(' ') : undefined }
}

export function accountContactsFromAuthUsers(users: AuthUserLike[]): AccountContact[] {
  const out: AccountContact[] = []
  const seen = new Set<string>()
  for (const user of users) {
    const email = user.email?.trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    out.push({ email, ...nameFromAuthMetadata(user.user_metadata) })
  }
  return out
}

/** Who to add / drop so the segment matches the current account list. */
export function planAudienceSync(
  accounts: AccountContact[],
  segmentEmails: string[],
): { upsert: AccountContact[]; remove: string[] } {
  const byEmail = new Map<string, AccountContact>()
  for (const account of accounts) {
    const email = account.email.trim().toLowerCase()
    if (!email) continue
    byEmail.set(email, { ...account, email })
  }
  const inSegment = new Set(segmentEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))
  return {
    upsert: [...byEmail.values()],
    remove: [...inSegment].filter((email) => !byEmail.has(email)),
  }
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

export function liveResendTransport(apiKey: string): ResendTransport {
  return async (req) => {
    const init: RequestInit = {
      method: req.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(req.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
    }
    if (req.body !== undefined) init.body = JSON.stringify(req.body)

    let last: ResendResponse = { status: 0, json: null }
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${RESEND}${req.path}`, init)
      const text = await res.text().catch(() => '')
      let json: unknown = null
      if (text) {
        try {
          json = JSON.parse(text)
        } catch {
          json = { message: text.slice(0, 200) }
        }
      }
      last = { status: res.status, json }
      if (res.status !== 429) return last
      await sleep(400 * (attempt + 1))
    }
    return last
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function contactPath(email: string): string {
  return `/contacts/${encodeURIComponent(email)}`
}

function resendError(status: number, json: unknown): string {
  const msg =
    json && typeof json === 'object' && 'message' in json
      ? String((json as { message: unknown }).message)
      : JSON.stringify(json)
  return `Resend ${status}: ${msg}`.slice(0, 240)
}

function isNotFound(status: number): boolean {
  return status === 404
}

function alreadyExists(status: number, json: unknown): boolean {
  if (status === 409) return true
  const msg =
    json && typeof json === 'object' && 'message' in json
      ? String((json as { message: unknown }).message).toLowerCase()
      : ''
  return status === 422 && msg.includes('already')
}

// ── Segment + contacts ───────────────────────────────────────────────────────

interface ListPayload {
  data?: Array<{ id?: string; email?: string; name?: string }>
  has_more?: boolean
}

async function listAll(
  transport: ResendTransport,
  path: string,
): Promise<Array<{ id: string; email?: string; name?: string }>> {
  const out: Array<{ id: string; email?: string; name?: string }> = []
  let after: string | undefined
  for (;;) {
    const qs = new URLSearchParams({ limit: '100' })
    if (after) qs.set('after', after)
    const sep = path.includes('?') ? '&' : '?'
    const res = await transport({ method: 'GET', path: `${path}${sep}${qs}` })
    if (res.status >= 400) throw new Error(resendError(res.status, res.json))
    const payload = (res.json ?? {}) as ListPayload
    const batch = (payload.data ?? []).filter((row): row is { id: string; email?: string; name?: string } =>
      Boolean(row.id),
    )
    out.push(...batch)
    if (!payload.has_more || batch.length === 0) break
    after = batch[batch.length - 1]!.id
  }
  return out
}

export async function resolveAccountsSegment(
  transport: ResendTransport,
  opts: { segmentId?: string | null; segmentName?: string },
): Promise<string> {
  if (opts.segmentId) return opts.segmentId

  const name = opts.segmentName || DEFAULT_SEGMENT_NAME
  const segments = await listAll(transport, '/segments')
  const existing = segments.find((s) => s.name === name)
  if (existing) return existing.id

  const created = await transport({ method: 'POST', path: '/segments', body: { name } })
  if (created.status >= 400) throw new Error(resendError(created.status, created.json))
  const id = (created.json as { id?: string } | null)?.id
  if (!id) throw new Error('Resend created a segment without an id')
  return id
}

export async function listSegmentEmails(
  transport: ResendTransport,
  segmentId: string,
): Promise<string[]> {
  // Dedicated membership list — never `GET /contacts`, which would include
  // waitlist / manually-added rows we must not delete.
  const rows = await listAll(transport, `/segments/${encodeURIComponent(segmentId)}/contacts`)
  return rows.map((r) => r.email?.trim().toLowerCase()).filter((e): e is string => Boolean(e))
}

/**
 * Create-or-update a contact and put them on the accounts segment.
 * Never writes `unsubscribed` on update — a prior opt-out stays an opt-out.
 */
export async function upsertAccountContact(
  transport: ResendTransport,
  contact: AccountContact,
  segmentId: string,
): Promise<'created' | 'updated'> {
  const email = contact.email.trim().toLowerCase()
  if (!email) throw new Error('upsertAccountContact: empty email')

  const created = await transport({
    method: 'POST',
    path: '/contacts',
    body: {
      email,
      ...(contact.firstName ? { first_name: contact.firstName } : {}),
      ...(contact.lastName ? { last_name: contact.lastName } : {}),
      unsubscribed: false,
      segments: [{ id: segmentId }],
    },
  })

  if (created.status < 400) return 'created'
  if (!alreadyExists(created.status, created.json)) {
    throw new Error(resendError(created.status, created.json))
  }

  const patch: Record<string, string> = {}
  if (contact.firstName) patch.first_name = contact.firstName
  if (contact.lastName) patch.last_name = contact.lastName
  if (Object.keys(patch).length > 0) {
    const updated = await transport({ method: 'PATCH', path: contactPath(email), body: patch })
    if (updated.status >= 400 && !isNotFound(updated.status)) {
      throw new Error(resendError(updated.status, updated.json))
    }
  }

  const added = await transport({
    method: 'POST',
    path: `${contactPath(email)}/segments/${encodeURIComponent(segmentId)}`,
  })
  if (added.status >= 400 && !alreadyExists(added.status, added.json)) {
    throw new Error(resendError(added.status, added.json))
  }
  return 'updated'
}

export async function removeAccountContact(
  transport: ResendTransport,
  email: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return
  const res = await transport({ method: 'DELETE', path: contactPath(normalized) })
  if (res.status >= 400 && !isNotFound(res.status)) {
    throw new Error(resendError(res.status, res.json))
  }
}

export async function syncAccountAudience(
  transport: ResendTransport,
  accounts: AccountContact[],
  opts: { segmentId?: string | null; segmentName?: string },
): Promise<AudienceSyncResult> {
  const errors: string[] = []
  const segmentId = await resolveAccountsSegment(transport, opts)
  let segmentEmails: string[] = []
  try {
    segmentEmails = await listSegmentEmails(transport, segmentId)
  } catch (e) {
    // Upsert still runs; skip removals so a bad list cannot wipe other contacts.
    errors.push(`list segment: ${e instanceof Error ? e.message : String(e)}`)
  }
  const { upsert, remove } = planAudienceSync(accounts, segmentEmails)

  let upserted = 0
  let removed = 0

  for (const contact of upsert) {
    try {
      await upsertAccountContact(transport, contact, segmentId)
      upserted++
    } catch (e) {
      errors.push(`${contact.email}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  for (const email of remove) {
    try {
      await removeAccountContact(transport, email)
      removed++
    } catch (e) {
      errors.push(`${email}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { segmentId, upserted, removed, errors }
}

// ── Request-scoped helpers (signup / delete) ─────────────────────────────────

function tryTransport(): ResendTransport | null {
  const key = env.resendKey()
  return key ? liveResendTransport(key) : null
}

async function segmentForLive(transport: ResendTransport): Promise<string> {
  return resolveAccountsSegment(transport, {
    segmentId: env.resendSegmentId(),
    segmentName: env.resendSegmentName(),
  })
}

/** Best-effort: never throws, never blocks the caller. */
export function scheduleAccountContactUpsert(contact: AccountContact): void {
  const transport = tryTransport()
  if (!transport || !contact.email?.trim()) return
  try {
    waitUntil(
      segmentForLive(transport)
        .then((segmentId) => upsertAccountContact(transport, contact, segmentId))
        .then(() => undefined)
        .catch((e) => {
          console.error('[resend-audience] upsert failed:', e)
        }),
    )
  } catch {
    // waitUntil is only valid inside a request; ignore elsewhere.
  }
}

export function scheduleAccountContactRemoval(email: string | undefined): void {
  const transport = tryTransport()
  if (!transport || !email?.trim()) return
  try {
    waitUntil(
      removeAccountContact(transport, email)
        .then(() => undefined)
        .catch((e) => {
          console.error('[resend-audience] remove failed:', e)
        }),
    )
  } catch {
    // same as above
  }
}
