import { requireSupabase } from './supabase'
import { apiUrl } from './api'

export async function submitFeedback(message: string, type: string): Promise<void> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const res = await fetch(apiUrl('/api/feedback'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ message, type }),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'unknown error' }))) as {
      error?: string
    }
    throw new Error(err.error ?? 'failed to submit feedback')
  }
}
