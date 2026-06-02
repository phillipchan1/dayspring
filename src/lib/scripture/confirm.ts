// The funnel: promote a suggested (AI-inferred) scripture allusion to confirmed.
// This is the ONE place the client writes a status change to scripture_refs; RLS
// scopes the update to the owner (auth.uid()), so the anon client writes its own
// row safely. Confirming is the user's affirmation — "yes, I was reaching for
// this" — never an automatic one. Suggested refs are otherwise read faintly and
// never counted in the heat/returning aggregations (which are confirmed-only).

import { requireSupabase } from '../supabase'

/** Promote a single suggested ref to `confirmed` by row id. Idempotent. */
export async function confirmScriptureRef(refId: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb
    .from('scripture_refs')
    .update({ status: 'confirmed' })
    .eq('id', refId)
    .eq('status', 'suggested') // never disturb an already-confirmed row
  if (error) throw error
}
