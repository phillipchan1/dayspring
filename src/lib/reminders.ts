import { requireSupabase } from './supabase'

export type ReminderHorizon = '1w' | '1m' | '3m' | '1y'

export interface NewReminder {
  entry_id?: string | null
  content: string
  horizon: ReminderHorizon
}

export interface Reminder {
  id: string
  owner: string
  entry_id: string | null
  content: string
  remind_at: string
  fired: boolean
  created_at: string
}

function remindAtFromHorizon(horizon: ReminderHorizon): string {
  const d = new Date()
  switch (horizon) {
    case '1w':
      d.setDate(d.getDate() + 7)
      break
    case '1m':
      d.setMonth(d.getMonth() + 1)
      break
    case '3m':
      d.setMonth(d.getMonth() + 3)
      break
    case '1y':
      d.setFullYear(d.getFullYear() + 1)
      break
  }
  // Fire at 9am UTC so the daily cron picks it up on the right day.
  d.setUTCHours(9, 0, 0, 0)
  return d.toISOString()
}

export async function createReminder(item: NewReminder): Promise<Reminder> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) throw new Error('not authenticated')

  const { data, error } = await sb
    .from('reminders')
    .insert({
      owner: session.user.id,
      entry_id: item.entry_id ?? null,
      content: item.content,
      remind_at: remindAtFromHorizon(item.horizon),
    })
    .select()
    .single()

  if (error) throw error
  return data as Reminder
}
