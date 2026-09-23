// Welcome drip — enroll + timed-send for the feature-discovery series.
//
// Resend Automations are NOT used. This module is the schedule, the skip
// rules, and the send/record loop. Day 13 `trial` is uploaded in Resend but
// must never appear in the enroll map (Product ASC hold).
//
// Sends are gated by WELCOME_DRIP_SENDS_ENABLED (default off). Enroll and
// skip evaluation always run.

import { toDateStr } from './dates.js'
import type { ResendTransport } from './resendAudience.js'

export const NAME_FALLBACK = 'there'
export const WELCOME_DRIP_REPLY_TO = 'hello@usedayspring.app'

/** Published Resend Template ids. These are template UUIDs, not API keys. */
export const WELCOME_TEMPLATE_IDS = {
  welcome: 'd798aca4-20ea-4967-8c67-072aa56fcef8',
  slash: '12e1146a-7ef7-4110-aa42-061b672d1550',
  journal: 'eefadd0c-50ed-4628-932c-2a21ace53d61',
  'journal-import': '650e248b-cfad-419a-9e2b-be4ff3ee3392',
  rituals: '0396e918-c1ab-43e6-8257-60064a2c960d',
  'told-back': 'bcca64a9-693b-4c47-a953-9e3d95e27fe5',
} as const

/** Uploaded, held. Not enrolled, not cron'd. */
export const TRIAL_TEMPLATE_ID = '4eef3200-a6f7-4c2f-b031-7aac3b3221d9'

export type WelcomeStepKey = keyof typeof WELCOME_TEMPLATE_IDS
export type EnrollSource = 'signup' | 'backfill'
export type StepStatus = 'sent' | 'skipped'
export type DecisionAction = 'send' | 'skip' | 'hold'

export interface WelcomeStep {
  key: WelcomeStepKey
  day: number
  templateId: string
}

/** Active schedule. Day 13 / `trial` is deliberately omitted. */
export const ENROLL_STEPS: readonly WelcomeStep[] = [
  { key: 'welcome', day: 0, templateId: WELCOME_TEMPLATE_IDS.welcome },
  { key: 'slash', day: 1, templateId: WELCOME_TEMPLATE_IDS.slash },
  { key: 'journal', day: 3, templateId: WELCOME_TEMPLATE_IDS.journal },
  { key: 'journal-import', day: 3, templateId: WELCOME_TEMPLATE_IDS['journal-import'] },
  { key: 'rituals', day: 5, templateId: WELCOME_TEMPLATE_IDS.rituals },
  { key: 'told-back', day: 9, templateId: WELCOME_TEMPLATE_IDS['told-back'] },
]

export const DAY3_KEYS = ['journal', 'journal-import'] as const satisfies readonly WelcomeStepKey[]

export interface StepRecord {
  status: StepStatus
  at: string
  reason?: string
}

export type StepLedger = Partial<Record<WelcomeStepKey, StepRecord>>

export interface Enrollment {
  owner: string
  enrolled_at: string
  source: EnrollSource
  status: 'active' | 'completed'
  steps: StepLedger
}

export interface UserSignals {
  hasEntries: boolean
  hasImported: boolean
  walkedRitual: boolean
  usedSlash: boolean
}

export interface Decision {
  key: WelcomeStepKey
  action: DecisionAction
  reason: string
  templateId: string
  day: number
}

export function utcDateStr(now: Date = new Date()): string {
  return toDateStr(now)
}

/** Pure half of enroll: never replace an existing row. */
export function nextEnrollment(
  existing: Enrollment | null,
  owner: string,
  source: EnrollSource,
  now: Date,
): { inserted: boolean; enrollment: Enrollment } {
  if (existing) return { inserted: false, enrollment: existing }
  return {
    inserted: true,
    enrollment: {
      owner,
      enrolled_at: utcDateStr(now),
      source,
      status: 'active',
      steps: {},
    },
  }
}

/** Whole UTC calendar days from the enroll anchor to `now`. Never negative. */
export function daysSinceEnroll(enrolledAt: string, now: Date): number {
  const start = Date.parse(`${enrolledAt}T00:00:00.000Z`)
  const today = Date.parse(`${utcDateStr(now)}T00:00:00.000Z`)
  if (!Number.isFinite(start) || !Number.isFinite(today)) return 0
  return Math.max(0, Math.round((today - start) / 86_400_000))
}

export function greetingName(firstName: string | undefined | null): string {
  const trimmed = firstName?.trim()
  return trimmed ? trimmed : NAME_FALLBACK
}

export function parseStepLedger(raw: unknown): StepLedger {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: StepLedger = {}
  for (const step of ENROLL_STEPS) {
    const rec = (raw as Record<string, unknown>)[step.key]
    if (!rec || typeof rec !== 'object') continue
    const status = (rec as { status?: unknown }).status
    if (status !== 'sent' && status !== 'skipped') continue
    const at = (rec as { at?: unknown }).at
    const reason = (rec as { reason?: unknown }).reason
    out[step.key] = {
      status,
      at: typeof at === 'string' ? at : '',
      ...(typeof reason === 'string' ? { reason } : {}),
    }
  }
  return out
}

export function isRecorded(steps: StepLedger, key: WelcomeStepKey): boolean {
  return Boolean(steps[key])
}

export function day3Key(signals: UserSignals): WelcomeStepKey {
  return signals.hasImported ? 'journal' : 'journal-import'
}

/**
 * Skip-if-already-done, plus the backfill "not fake day-0" rule.
 * Day 3 is a branch (never a skip of the whole day). told-back matches the
 * manifest (`everyone`) — there is no persisted "opened Ascent/Themes" signal.
 */
export function skipReason(
  key: WelcomeStepKey,
  signals: UserSignals,
  source: EnrollSource,
): string | null {
  if (key === 'welcome') {
    if (source === 'backfill') return 'backfill_not_day_zero'
    if (signals.hasEntries) return 'already_wrote'
    return null
  }
  if (key === 'slash' && signals.usedSlash) return 'already_used_slash'
  if (key === 'rituals' && signals.walkedRitual) return 'already_walked_ritual'
  if (key === 'journal' || key === 'journal-import') {
    return key === day3Key(signals) ? null : 'other_branch'
  }
  return null
}

export function enrollMapHasTrial(): boolean {
  return ENROLL_STEPS.some((s) => s.key === ('trial' as WelcomeStepKey) || s.day === 13)
}

function stepByKey(key: WelcomeStepKey): WelcomeStep {
  const step = ENROLL_STEPS.find((s) => s.key === key)
  if (!step) throw new Error(`unknown welcome step: ${key}`)
  return step
}

/**
 * Decide what to do with each due, unrecorded step.
 * `hold` = would send, but the kill switch is off — leave pending.
 */
export function planDueDecisions(opts: {
  enrollment: Enrollment
  now: Date
  signals: UserSignals
  sendsEnabled: boolean
}): Decision[] {
  const elapsed = daysSinceEnroll(opts.enrollment.enrolled_at, opts.now)
  const due = ENROLL_STEPS.filter(
    (s) => elapsed >= s.day && !isRecorded(opts.enrollment.steps, s.key),
  )
  return decide(due, opts.enrollment.source, opts.signals, opts.sendsEnabled)
}

/**
 * Backfill preview: evaluate every step as if we enroll today as feature-
 * discovery. Counts what would be skipped immediately vs scheduled to send.
 */
export function planBackfillDecisions(signals: UserSignals, sendsEnabled: boolean): Decision[] {
  return decide(ENROLL_STEPS, 'backfill', signals, sendsEnabled)
}

function decide(
  candidates: readonly WelcomeStep[],
  source: EnrollSource,
  signals: UserSignals,
  sendsEnabled: boolean,
): Decision[] {
  const out: Decision[] = []
  for (const step of candidates) {
    const reason = skipReason(step.key, signals, source)
    if (reason) {
      out.push({
        key: step.key,
        action: 'skip',
        reason,
        templateId: step.templateId,
        day: step.day,
      })
      continue
    }
    out.push({
      key: step.key,
      action: sendsEnabled ? 'send' : 'hold',
      reason: sendsEnabled ? 'due' : 'sends_disabled',
      templateId: step.templateId,
      day: step.day,
    })
  }
  return out
}

export function enrollmentComplete(steps: StepLedger): boolean {
  return ENROLL_STEPS.every((s) => isRecorded(steps, s.key))
}

export function applyDecision(steps: StepLedger, decision: Decision, at: string): StepLedger {
  if (decision.action === 'hold') return steps
  return {
    ...steps,
    [decision.key]: {
      status: decision.action === 'send' ? 'sent' : 'skipped',
      at,
      reason: decision.reason,
    },
  }
}

export interface StepCounts {
  welcome: number
  slash: number
  journal: number
  'journal-import': number
  rituals: number
  'told-back': number
}

export function emptyStepCounts(): StepCounts {
  return { welcome: 0, slash: 0, journal: 0, 'journal-import': 0, rituals: 0, 'told-back': 0 }
}

export function incrementStep(counts: StepCounts, key: WelcomeStepKey): void {
  counts[key] += 1
}

export interface BackfillReport {
  dry_run: boolean
  sends_enabled: boolean
  would_enroll: number
  already_enrolled: number
  would_send: StepCounts
  would_skip: StepCounts
  would_hold: StepCounts
  enrolled?: number
  recorded_skips?: number
}

export function emptyBackfillReport(dryRun: boolean, sendsEnabled: boolean): BackfillReport {
  return {
    dry_run: dryRun,
    sends_enabled: sendsEnabled,
    would_enroll: 0,
    already_enrolled: 0,
    would_send: emptyStepCounts(),
    would_skip: emptyStepCounts(),
    would_hold: emptyStepCounts(),
  }
}

export function tallyDecisions(report: BackfillReport, decisions: Decision[]): void {
  for (const d of decisions) {
    if (d.action === 'skip') incrementStep(report.would_skip, d.key)
    else if (d.action === 'hold') incrementStep(report.would_hold, d.key)
    else incrementStep(report.would_send, d.key)
  }
}

/** Query/body parser. Default is dry-run; only an explicit false writes. */
export function parseDryRun(body: unknown, url: URL): boolean {
  const q = url.searchParams.get('dry_run')
  if (q === 'true' || q === '1') return true
  if (q === 'false' || q === '0') {
    // Query can opt into a write, but a body of { dry_run: true } still wins.
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const v = (body as { dry_run?: unknown }).dry_run
      if (v === true) return true
    }
    return false
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const v = (body as { dry_run?: unknown }).dry_run
    if (v === false) return false
  }
  return true
}

export function welcomeSendPayload(opts: {
  from: string
  to: string
  templateId: string
  name: string
}): { method: 'POST'; path: '/emails'; body: Record<string, unknown> } {
  return {
    method: 'POST',
    path: '/emails',
    body: {
      from: opts.from,
      to: [opts.to],
      reply_to: WELCOME_DRIP_REPLY_TO,
      template: {
        id: opts.templateId,
        variables: { NAME: opts.name },
      },
    },
  }
}

export async function sendWelcomeTemplate(
  transport: ResendTransport,
  opts: { from: string; to: string; templateId: string; name: string },
): Promise<void> {
  const req = welcomeSendPayload(opts)
  const res = await transport(req)
  if (res.status >= 400) {
    const msg =
      res.json && typeof res.json === 'object' && 'message' in res.json
        ? String((res.json as { message: unknown }).message)
        : JSON.stringify(res.json)
    throw new Error(`Resend ${res.status}: ${msg}`.slice(0, 240))
  }
}

export { stepByKey }
