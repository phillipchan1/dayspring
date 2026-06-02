export type Plan = 'none' | 'trialing' | 'active' | 'cancelled' | 'past_due'

export interface PlanState {
  plan: Plan
  trial_ends_at?: string | null
  plan_expires_at?: string | null
}

export function isEntitled(state: PlanState): boolean {
  if (state.plan === 'active') return true
  if (state.plan === 'trialing' && state.trial_ends_at) {
    return new Date(state.trial_ends_at) > new Date()
  }
  return false
}
