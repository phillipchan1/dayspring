// Supabase + Resend orchestration for the welcome drip. Keep HTTP handlers
// thin: enroll, skip, send, and backfill all go through here.

import type { SupabaseClient } from '@supabase/supabase-js'
import { env } from './env.js'
import { liveResendTransport, nameFromAuthMetadata, type ResendTransport } from './resendAudience.js'
import { supabaseAdmin } from './supabaseAdmin.js'
import {
  applyDecision,
  emptyBackfillReport,
  enrollmentComplete,
  greetingName,
  nextEnrollment,
  parseStepLedger,
  planBackfillDecisions,
  planDueDecisions,
  sendWelcomeTemplate,
  tallyDecisions,
  type BackfillReport,
  type Decision,
  type EnrollSource,
  type Enrollment,
  type StepLedger,
  type UserSignals,
} from './welcomeDrip.js'

const AUTH_PAGE = 1000
const IN_CHUNK = 200

export interface AuthAccount {
  id: string
  email: string | null
  firstName?: string
}

export interface WelcomeDripDeps {
  sb: SupabaseClient
  now: Date
  sendsEnabled: boolean
  from: string
  transport: ResendTransport | null
}

export function liveWelcomeDripDeps(now: Date = new Date()): WelcomeDripDeps {
  const key = env.resendKey()
  return {
    sb: supabaseAdmin(),
    now,
    sendsEnabled: env.welcomeDripSendsEnabled(),
    from: env.welcomeDripFrom(),
    transport: key ? liveResendTransport(key) : null,
  }
}

function asEnrollment(row: {
  owner: string
  enrolled_at: string
  source: string
  status: string
  steps: unknown
}): Enrollment {
  return {
    owner: row.owner,
    enrolled_at: String(row.enrolled_at).slice(0, 10),
    source: row.source === 'backfill' ? 'backfill' : 'signup',
    status: row.status === 'completed' ? 'completed' : 'active',
    steps: parseStepLedger(row.steps),
  }
}

export async function getEnrollment(
  sb: SupabaseClient,
  owner: string,
): Promise<Enrollment | null> {
  const { data, error } = await sb
    .from('welcome_drip_enrollments')
    .select('owner, enrolled_at, source, status, steps')
    .eq('owner', owner)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? asEnrollment(data) : null
}

/** Idempotent insert. Returns the row; `inserted` is false when one already existed. */
export async function enrollUser(
  sb: SupabaseClient,
  opts: { owner: string; source: EnrollSource; now: Date },
): Promise<{ inserted: boolean; enrollment: Enrollment }> {
  const existing = await getEnrollment(sb, opts.owner)
  const planned = nextEnrollment(existing, opts.owner, opts.source, opts.now)
  if (!planned.inserted) return planned

  const { data, error } = await sb
    .from('welcome_drip_enrollments')
    .insert({
      owner: opts.owner,
      enrolled_at: planned.enrollment.enrolled_at,
      source: opts.source,
      status: 'active',
      steps: {},
    })
    .select('owner, enrolled_at, source, status, steps')
    .single()

  if (error) {
    // Unique race: another writer won. Treat as already enrolled.
    if (error.code === '23505') {
      const again = await getEnrollment(sb, opts.owner)
      if (again) return { inserted: false, enrollment: again }
    }
    throw new Error(error.message)
  }
  return { inserted: true, enrollment: asEnrollment(data) }
}

export async function listActiveEnrollments(sb: SupabaseClient): Promise<Enrollment[]> {
  const out: Enrollment[] = []
  for (let from = 0; ; from += AUTH_PAGE) {
    const { data, error } = await sb
      .from('welcome_drip_enrollments')
      .select('owner, enrolled_at, source, status, steps')
      .eq('status', 'active')
      .order('owner', { ascending: true })
      .range(from, from + AUTH_PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    for (const row of batch) out.push(asEnrollment(row))
    if (batch.length < AUTH_PAGE) break
  }
  return out
}

export async function writeSteps(
  sb: SupabaseClient,
  enrollment: Enrollment,
  steps: StepLedger,
): Promise<void> {
  const status = enrollmentComplete(steps) ? 'completed' : 'active'
  const { error } = await sb
    .from('welcome_drip_enrollments')
    .update({ steps, status })
    .eq('owner', enrollment.owner)
  if (error) throw new Error(error.message)
}

const EMPTY_SIGNALS: UserSignals = {
  hasEntries: false,
  hasImported: false,
  walkedRitual: false,
  usedSlash: false,
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Real DB signals for skip rules. Ritual tokens live in entry markdown
 * (`<!-- ritual:` or the legacy `<!-- practice:`). Imports are any
 * entries.source other than `native`. Slash = a spiritual_items row the
 * writer typed (`source = 'command'`).
 */
export async function loadSignalsForOwners(
  sb: SupabaseClient,
  owners: string[],
): Promise<Map<string, UserSignals>> {
  const map = new Map<string, UserSignals>()
  for (const owner of owners) map.set(owner, { ...EMPTY_SIGNALS })
  if (owners.length === 0) return map

  for (const ids of chunk(owners, IN_CHUNK)) {
    await Promise.all(
      ids.map(async (owner) => {
        const s = map.get(owner)
        if (!s) return
        const [hasEntries, hasImported, walkedRitual, usedSlash] = await Promise.all([
          ownerExists(sb, 'entries', owner),
          ownerExists(sb, 'entries', owner, { sourceNe: 'native' }),
          ownerExists(sb, 'entries', owner, { ritual: true }),
          ownerExists(sb, 'spiritual_items', owner, { sourceEq: 'command' }),
        ])
        s.hasEntries = hasEntries
        s.hasImported = hasImported
        s.walkedRitual = walkedRitual
        s.usedSlash = usedSlash
      }),
    )
  }
  return map
}

async function ownerExists(
  sb: SupabaseClient,
  table: 'entries' | 'spiritual_items',
  owner: string,
  opts: { sourceNe?: string; sourceEq?: string; ritual?: boolean } = {},
): Promise<boolean> {
  let q = sb.from(table).select('owner').eq('owner', owner)
  if (opts.sourceNe) q = q.neq('source', opts.sourceNe)
  if (opts.sourceEq) q = q.eq('source', opts.sourceEq)
  if (opts.ritual) {
    q = q.or('body_markdown.like.%<!-- ritual:%,body_markdown.like.%<!-- practice:name:%')
  }
  const { data, error } = await q.limit(1).maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function listAuthAccounts(sb: SupabaseClient): Promise<AuthAccount[]> {
  const users: AuthAccount[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: AUTH_PAGE })
    if (error) throw new Error(error.message)
    const batch = data.users ?? []
    for (const u of batch) {
      const names = nameFromAuthMetadata((u.user_metadata ?? null) as Record<string, unknown> | null)
      users.push({
        id: u.id,
        email: u.email ?? null,
        firstName: names.firstName,
      })
    }
    if (batch.length < AUTH_PAGE) break
  }
  return users
}

export interface CronResult {
  sends_enabled: boolean
  enrollments: number
  sent: number
  skipped: number
  held: number
  completed: number
  errors: string[]
}

async function applyDecisions(
  deps: WelcomeDripDeps,
  enrollment: Enrollment,
  decisions: Decision[],
  account: AuthAccount | undefined,
  errors: string[],
): Promise<{ sent: number; skipped: number; held: number; completed: boolean }> {
  let sent = 0
  let skipped = 0
  let held = 0
  let steps = { ...enrollment.steps }

  for (const decision of decisions) {
    if (decision.action === 'hold') {
      held++
      continue
    }
    if (decision.action === 'send') {
      if (!account?.email) {
        errors.push(`${enrollment.owner}: no email; leaving ${decision.key} pending`)
        continue
      }
      if (!deps.transport) {
        errors.push(`${enrollment.owner}: no Resend transport; leaving ${decision.key} pending`)
        continue
      }
      try {
        await sendWelcomeTemplate(deps.transport, {
          from: deps.from,
          to: account.email,
          templateId: decision.templateId,
          name: greetingName(account.firstName),
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        errors.push(`${enrollment.owner}:${decision.key}: ${msg}`)
        continue
      }
      sent++
    } else {
      skipped++
    }
    steps = applyDecision(steps, decision, deps.now.toISOString())
  }

  if (JSON.stringify(steps) !== JSON.stringify(enrollment.steps)) {
    await writeSteps(deps.sb, enrollment, steps)
  }
  return { sent, skipped, held, completed: enrollmentComplete(steps) }
}

export async function sendDueForEnrollment(
  deps: WelcomeDripDeps,
  enrollment: Enrollment,
  account: AuthAccount,
): Promise<{ sent: number; skipped: number; held: number; completed: boolean; errors: string[] }> {
  const signals = await loadSignalsForOwners(deps.sb, [enrollment.owner])
  const decisions = planDueDecisions({
    enrollment,
    now: deps.now,
    signals: signals.get(enrollment.owner) ?? EMPTY_SIGNALS,
    sendsEnabled: deps.sendsEnabled && Boolean(deps.transport),
  })
  const errors: string[] = []
  if (decisions.length === 0) {
    return { sent: 0, skipped: 0, held: 0, completed: enrollmentComplete(enrollment.steps), errors }
  }
  const applied = await applyDecisions(deps, enrollment, decisions, account, errors)
  return { ...applied, errors }
}

export async function runWelcomeDripCron(deps: WelcomeDripDeps): Promise<CronResult> {
  const enrollments = await listActiveEnrollments(deps.sb)
  const accounts = await listAuthAccounts(deps.sb)
  const byId = new Map(accounts.map((a) => [a.id, a]))
  const signals = await loadSignalsForOwners(
    deps.sb,
    enrollments.map((e) => e.owner),
  )

  const result: CronResult = {
    sends_enabled: deps.sendsEnabled,
    enrollments: enrollments.length,
    sent: 0,
    skipped: 0,
    held: 0,
    completed: 0,
    errors: [],
  }

  for (const enrollment of enrollments) {
    const decisions = planDueDecisions({
      enrollment,
      now: deps.now,
      signals: signals.get(enrollment.owner) ?? EMPTY_SIGNALS,
      sendsEnabled: deps.sendsEnabled && Boolean(deps.transport),
    })
    if (decisions.length === 0) continue
    try {
      const applied = await applyDecisions(
        deps,
        enrollment,
        decisions,
        byId.get(enrollment.owner),
        result.errors,
      )
      result.sent += applied.sent
      result.skipped += applied.skipped
      result.held += applied.held
      if (applied.completed) result.completed++
    } catch (e) {
      result.errors.push(`${enrollment.owner}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return result
}

export async function runWelcomeDripBackfill(
  deps: WelcomeDripDeps,
  opts: { dryRun: boolean },
): Promise<BackfillReport> {
  const report = emptyBackfillReport(opts.dryRun, deps.sendsEnabled)
  const accounts = await listAuthAccounts(deps.sb)
  const signals = await loadSignalsForOwners(
    deps.sb,
    accounts.map((a) => a.id),
  )

  let recordedSkips = 0
  let enrolled = 0

  for (const account of accounts) {
    const existing = await getEnrollment(deps.sb, account.id)
    if (existing) {
      report.already_enrolled++
      continue
    }
    report.would_enroll++
    const userSignals = signals.get(account.id) ?? EMPTY_SIGNALS
    // Count as if sends were on — Vera's dry-run is "who would get what",
    // not "what the kill switch will do". The write path still only records
    // skips; the cron is what mails, and only when the flag is on.
    const decisions = planBackfillDecisions(userSignals, true)
    tallyDecisions(report, decisions)
    if (opts.dryRun) continue

    const { enrollment } = await enrollUser(deps.sb, {
      owner: account.id,
      source: 'backfill',
      now: deps.now,
    })
    enrolled++
    let steps = { ...enrollment.steps }
    for (const decision of decisions) {
      if (decision.action !== 'skip') continue
      steps = applyDecision(steps, decision, deps.now.toISOString())
      recordedSkips++
    }
    if (JSON.stringify(steps) !== JSON.stringify(enrollment.steps)) {
      await writeSteps(deps.sb, enrollment, steps)
    }
  }

  if (!opts.dryRun) {
    report.enrolled = enrolled
    report.recorded_skips = recordedSkips
  }
  return report
}
