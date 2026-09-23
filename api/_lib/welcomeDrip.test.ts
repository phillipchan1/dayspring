import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ENROLL_STEPS,
  TRIAL_TEMPLATE_ID,
  WELCOME_TEMPLATE_IDS,
  applyDecision,
  daysSinceEnroll,
  enrollMapHasTrial,
  greetingName,
  nextEnrollment,
  parseDryRun,
  parseStepLedger,
  planBackfillDecisions,
  planDueDecisions,
  skipReason,
  sendWelcomeTemplate,
  welcomeSendPayload,
  type Enrollment,
  type UserSignals,
} from './welcomeDrip.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const manifest = JSON.parse(
  readFileSync(path.join(ROOT, 'marketing/email/welcome/templates/manifest.json'), 'utf8'),
) as Array<{ key: string; day: number }>

const quiet: UserSignals = {
  hasEntries: false,
  hasImported: false,
  walkedRitual: false,
  usedSlash: false,
}

const enrollment = (
  over: Partial<Enrollment> = {},
): Enrollment => ({
  owner: 'user-1',
  enrolled_at: '2026-09-20',
  source: 'signup',
  status: 'active',
  steps: {},
  ...over,
})

describe('enroll map', () => {
  it('never schedules day 13 or the trial template', () => {
    expect(enrollMapHasTrial()).toBe(false)
    expect(ENROLL_STEPS.some((s) => s.day === 13 || s.key === ('trial' as never))).toBe(false)
    expect(Object.values(WELCOME_TEMPLATE_IDS)).not.toContain(TRIAL_TEMPLATE_ID)
    expect(ENROLL_STEPS.map((s) => s.templateId)).not.toContain(TRIAL_TEMPLATE_ID)
  })

  it('matches the committed manifest for every enrolled step, and leaves trial out', () => {
    const byKey = new Map(manifest.map((m) => [m.key, m.day]))
    expect(byKey.get('trial')).toBe(13)
    for (const step of ENROLL_STEPS) {
      expect(byKey.get(step.key), step.key).toBe(step.day)
    }
    expect(ENROLL_STEPS.map((s) => s.key)).not.toContain('trial')
  })
})

describe('daysSinceEnroll', () => {
  it('is whole UTC calendar days from the anchor', () => {
    expect(daysSinceEnroll('2026-09-20', new Date('2026-09-20T00:00:00.000Z'))).toBe(0)
    expect(daysSinceEnroll('2026-09-20', new Date('2026-09-20T23:59:59.000Z'))).toBe(0)
    expect(daysSinceEnroll('2026-09-20', new Date('2026-09-21T09:30:00.000Z'))).toBe(1)
    expect(daysSinceEnroll('2026-09-20', new Date('2026-09-23T09:30:00.000Z'))).toBe(3)
    expect(daysSinceEnroll('2026-09-20', new Date('2026-09-29T09:30:00.000Z'))).toBe(9)
  })

  it('does not go negative if the clock is behind the anchor', () => {
    expect(daysSinceEnroll('2026-09-22', new Date('2026-09-20T12:00:00.000Z'))).toBe(0)
  })
})

describe('skip branching', () => {
  it('sends welcome on signup when they have not written', () => {
    expect(skipReason('welcome', quiet, 'signup')).toBeNull()
  })

  it('skips welcome on backfill (not fake day-0) and after a first entry', () => {
    expect(skipReason('welcome', quiet, 'backfill')).toBe('backfill_not_day_zero')
    expect(skipReason('welcome', { ...quiet, hasEntries: true }, 'signup')).toBe('already_wrote')
  })

  it('skips slash only after a typed / command', () => {
    expect(skipReason('slash', quiet, 'signup')).toBeNull()
    expect(skipReason('slash', { ...quiet, usedSlash: true }, 'signup')).toBe('already_used_slash')
  })

  it('branches day 3 on the import signal', () => {
    expect(skipReason('journal', quiet, 'signup')).toBe('other_branch')
    expect(skipReason('journal-import', quiet, 'signup')).toBeNull()
    expect(skipReason('journal', { ...quiet, hasImported: true }, 'signup')).toBeNull()
    expect(skipReason('journal-import', { ...quiet, hasImported: true }, 'signup')).toBe('other_branch')
  })

  it('skips rituals after a walked practice', () => {
    expect(skipReason('rituals', quiet, 'signup')).toBeNull()
    expect(skipReason('rituals', { ...quiet, walkedRitual: true }, 'backfill')).toBe(
      'already_walked_ritual',
    )
  })

  it('does not skip told-back — the manifest sends it to everyone', () => {
    expect(skipReason('told-back', { ...quiet, hasEntries: true, hasImported: true }, 'backfill')).toBeNull()
  })
})

describe('planDueDecisions', () => {
  it('releases steps on their day offset and holds them when sends are off', () => {
    const day3 = planDueDecisions({
      enrollment: enrollment(),
      now: new Date('2026-09-23T09:30:00.000Z'),
      signals: quiet,
      sendsEnabled: false,
    })
    expect(day3.map((d) => d.key).sort()).toEqual(['journal', 'journal-import', 'slash', 'welcome'])
    expect(day3.find((d) => d.key === 'welcome')?.action).toBe('hold')
    expect(day3.find((d) => d.key === 'journal-import')?.action).toBe('hold')
    expect(day3.find((d) => d.key === 'journal')?.action).toBe('skip')
    expect(day3.some((d) => d.key === 'rituals' || d.key === 'told-back')).toBe(false)
  })

  it('sends the imported journal branch on day 3 when enabled', () => {
    const day3 = planDueDecisions({
      enrollment: enrollment(),
      now: new Date('2026-09-23T09:30:00.000Z'),
      signals: { ...quiet, hasImported: true },
      sendsEnabled: true,
    })
    expect(day3.find((d) => d.key === 'journal')).toEqual(
      expect.objectContaining({ action: 'send', reason: 'due' }),
    )
    expect(day3.find((d) => d.key === 'journal-import')?.action).toBe('skip')
  })

  it('never re-plans a recorded step (idempotent send/skip)', () => {
    const steps = applyDecision(
      {},
      {
        key: 'welcome',
        action: 'send',
        reason: 'due',
        templateId: WELCOME_TEMPLATE_IDS.welcome,
        day: 0,
      },
      '2026-09-20T09:30:00.000Z',
    )
    const again = planDueDecisions({
      enrollment: enrollment({ steps }),
      now: new Date('2026-09-20T18:00:00.000Z'),
      signals: quiet,
      sendsEnabled: true,
    })
    expect(again.map((d) => d.key)).not.toContain('welcome')
  })
})

describe('planBackfillDecisions', () => {
  it('skips welcome for everyone and rituals/slash when already done', () => {
    const decisions = planBackfillDecisions(
      { hasEntries: true, hasImported: true, walkedRitual: true, usedSlash: true },
      false,
    )
    const byKey = Object.fromEntries(decisions.map((d) => [d.key, d]))
    expect(byKey.welcome.action).toBe('skip')
    expect(byKey.slash.action).toBe('skip')
    expect(byKey.rituals.action).toBe('skip')
    expect(byKey.journal.action).toBe('hold')
    expect(byKey['journal-import'].action).toBe('skip')
    expect(byKey['told-back'].action).toBe('hold')
    expect(decisions.some((d) => d.day === 13)).toBe(false)
  })
})

describe('nextEnrollment', () => {
  it('inserts a signup row and is a no-op when one already exists', () => {
    const first = nextEnrollment(null, 'ada', 'signup', new Date('2026-09-23T15:00:00.000Z'))
    expect(first.inserted).toBe(true)
    expect(first.enrollment).toMatchObject({
      owner: 'ada',
      enrolled_at: '2026-09-23',
      source: 'signup',
      status: 'active',
      steps: {},
    })

    const again = nextEnrollment(first.enrollment, 'ada', 'backfill', new Date('2026-09-24T00:00:00.000Z'))
    expect(again.inserted).toBe(false)
    expect(again.enrollment).toBe(first.enrollment)
    expect(again.enrollment.source).toBe('signup')
  })
})

describe('parseDryRun', () => {
  it('defaults to dry-run so a throwaway cannot mail by accident', () => {
    const url = new URL('https://example.com/api/admin/welcome-drip-backfill')
    expect(parseDryRun(undefined, url)).toBe(true)
    expect(parseDryRun({}, url)).toBe(true)
    expect(parseDryRun({ dry_run: false }, url)).toBe(false)
    expect(parseDryRun({ dry_run: false }, new URL(`${url.href}?dry_run=true`))).toBe(true)
  })
})

describe('greeting + Resend payload', () => {
  it('falls back to "there" and never ships an API key', () => {
    expect(greetingName(undefined)).toBe('there')
    expect(greetingName('  ')).toBe('there')
    expect(greetingName('Ada')).toBe('Ada')

    const payload = welcomeSendPayload({
      from: 'The Dayspring team <hello@usedayspring.app>',
      to: 'ada@example.com',
      templateId: WELCOME_TEMPLATE_IDS.slash,
      name: greetingName(null),
    })
    expect(payload.body.template).toEqual({
      id: WELCOME_TEMPLATE_IDS.slash,
      variables: { NAME: 'there' },
    })
    expect(JSON.stringify(payload)).not.toMatch(/re_/)
  })

  it('sendWelcomeTemplate uses the injected transport (Resend is mocked)', async () => {
    const calls: unknown[] = []
    await sendWelcomeTemplate(
      async (req) => {
        calls.push(req)
        return { status: 200, json: { id: 'em_1' } }
      },
      {
        from: 'The Dayspring team <hello@usedayspring.app>',
        to: 'ada@example.com',
        templateId: WELCOME_TEMPLATE_IDS.welcome,
        name: 'Ada',
      },
    )
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/emails',
      body: {
        template: { id: WELCOME_TEMPLATE_IDS.welcome, variables: { NAME: 'Ada' } },
      },
    })
  })
})

describe('parseStepLedger', () => {
  it('drops unknown keys so a stray trial record cannot schedule', () => {
    const steps = parseStepLedger({
      welcome: { status: 'sent', at: '2026-09-20T00:00:00.000Z' },
      trial: { status: 'sent', at: '2026-09-20T00:00:00.000Z' },
      junk: { status: 'sent' },
    })
    expect(steps.welcome?.status).toBe('sent')
    expect(steps).not.toHaveProperty('trial')
  })
})
