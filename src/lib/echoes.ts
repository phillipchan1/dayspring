import { requireSupabase } from './supabase'

export interface EchoCandidate {
  id: string
  entry_id: string | null
  text: string
  entry_date: string
  created_at: string
}

export async function fetchCurrentEcho(): Promise<EchoCandidate | null> {
  const sb = requireSupabase()
  const { data, error } = await sb
    .from('echo_candidates')
    .select('id, entry_id, text, entry_date, created_at')
    .maybeSingle()

  if (error) {
    console.warn('[echoes] fetch error:', error.message)
    return null
  }
  return data as EchoCandidate | null
}

export async function dismissEcho(entryId: string | null): Promise<void> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) return

  // Add to permanent dismissal list so the cron won't resurface this entry.
  if (entryId) {
    await sb
      .from('echo_dismissals')
      .upsert({ owner: session.user.id, entry_id: entryId }, { onConflict: 'owner,entry_id' })
      .throwOnError()
  }

  // Delete the candidate — next week's cron will generate a fresh one.
  await sb.from('echo_candidates').delete().eq('owner', session.user.id).throwOnError()
}
