import { describe, expect, it } from 'vitest'
import {
  lifecycleEventFor,
  personPropertiesFor,
  postHogLifecycleProperties,
} from './growthEvents.js'
import type { Plan } from './entitlement.js'

describe('lifecycleEventFor', () => {
  it('fires StartTrial from no profile at all', () => {
    expect(lifecycleEventFor(null, 'trialing')).toBe('StartTrial')
  })

  it('fires StartTrial from none', () => {
    expect(lifecycleEventFor('none', 'trialing')).toBe('StartTrial')
  })

  it('fires StartTrial from a lapsed relationship (win-back trial)', () => {
    expect(lifecycleEventFor('cancelled', 'trialing')).toBe('StartTrial')
    expect(lifecycleEventFor('past_due', 'trialing')).toBe('StartTrial')
  })

  it('does not fire StartTrial for an active account somehow re-entering trialing', () => {
    expect(lifecycleEventFor('active', 'trialing')).toBeNull()
  })

  it('fires Purchase on first purchase, trial conversion, win-back, and dunning recovery', () => {
    expect(lifecycleEventFor('none', 'active')).toBe('Purchase')
    expect(lifecycleEventFor('trialing', 'active')).toBe('Purchase')
    expect(lifecycleEventFor('cancelled', 'active')).toBe('Purchase')
    expect(lifecycleEventFor('past_due', 'active')).toBe('Purchase')
    expect(lifecycleEventFor(null, 'active')).toBe('Purchase')
  })

  it('fires Cancel only when ending a live relationship', () => {
    expect(lifecycleEventFor('active', 'cancelled')).toBe('Cancel')
    expect(lifecycleEventFor('trialing', 'cancelled')).toBe('Cancel')
    expect(lifecycleEventFor('past_due', 'cancelled')).toBe('Cancel')
  })

  it('does not fire Cancel for a duplicate or already-lapsed cancellation', () => {
    expect(lifecycleEventFor('cancelled', 'cancelled')).toBeNull()
    expect(lifecycleEventFor('none', 'cancelled')).toBeNull()
    expect(lifecycleEventFor(null, 'cancelled')).toBeNull()
  })

  it('never fires on a no-op transition', () => {
    const plans: Plan[] = ['none', 'trialing', 'active', 'cancelled', 'past_due']
    for (const p of plans) expect(lifecycleEventFor(p, p)).toBeNull()
  })

  it('is silent on past_due — no lifecycle event maps to it', () => {
    expect(lifecycleEventFor('active', 'past_due')).toBeNull()
    expect(lifecycleEventFor('trialing', 'past_due')).toBeNull()
  })
})

describe('personPropertiesFor', () => {
  it('sets plan to the plan after the transition, and store from source', () => {
    expect(personPropertiesFor('StartTrial', 'reverse-trial')).toEqual({
      plan: 'trialing',
      store: 'reverse-trial',
    })
    expect(personPropertiesFor('Purchase', 'stripe')).toEqual({
      plan: 'active',
      store: 'stripe',
    })
    expect(personPropertiesFor('Cancel', 'apple')).toEqual({
      plan: 'cancelled',
      store: 'apple',
    })
  })
})

describe('postHogLifecycleProperties', () => {
  it('stamps $set person properties on the capture body without dropping source', () => {
    expect(
      postHogLifecycleProperties({
        userId: 'user-123',
        event: 'Purchase',
        source: 'apple',
      }),
    ).toEqual({
      source: 'apple',
      $lib: 'dayspring-server',
      $set: { plan: 'active', store: 'apple' },
    })
  })

  it('maps each lifecycle moment to the matching plan on $set', () => {
    expect(
      postHogLifecycleProperties({
        userId: 'u',
        event: 'StartTrial',
        source: 'stripe',
      }).$set,
    ).toEqual({ plan: 'trialing', store: 'stripe' })
    expect(
      postHogLifecycleProperties({
        userId: 'u',
        event: 'Cancel',
        source: 'reverse-trial',
      }).$set,
    ).toEqual({ plan: 'cancelled', store: 'reverse-trial' })
  })
})
