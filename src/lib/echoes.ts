import { requireSupabase } from './supabase'

export interface EchoCandidate {
  id: string
  entry_id: string | null
  text: string
  entry_date: string
  created_at: string
}

export type ResurfaceSourceType =
  | 'echo'
  | 'open_prayer'
  | 'due_reminder'
  | 'anniversary_sense'

export type ResurfaceCard =
  | {
      kind: 'echo'
      entry_id: string
      text: string
      entry_date: string
    }
  | {
      kind: 'open_prayer'
      id: string
      content: string
      created_at: string
      entry_id: string | null
    }
  | {
      kind: 'due_reminder'
      id: string
      content: string
      remind_at: string
      entry_id: string | null
    }
  | {
      kind: 'anniversary_sense'
      id: string
      content: string
      years_ago: number
      entry_id: string | null
    }

const OPEN_PRAYER_MIN_DAYS = 21

async function loadDismissedIds(
  sb: ReturnType<typeof requireSupabase>,
  owner: string,
): Promise<Set<string>> {
  const { data } = await sb
    .from('resurface_dismissals')
    .select('source_type, source_id')
    .eq('owner', owner)

  const set = new Set<string>()
  for (const row of data ?? []) {
    set.add(`${row.source_type}:${row.source_id}`)
  }
  return set
}

function isDismissed(dismissed: Set<string>, type: ResurfaceSourceType, id: string): boolean {
  return dismissed.has(`${type}:${id}`)
}

async function fetchDueReminder(
  sb: ReturnType<typeof requireSupabase>,
  dismissed: Set<string>,
): Promise<ResurfaceCard | null> {
  const now = new Date().toISOString()
  const { data, error } = await sb
    .from('reminders')
    .select('id, content, remind_at, entry_id')
    .eq('fired', false)
    .lte('remind_at', now)
    .order('remind_at', { ascending: true })
    .limit(5)

  if (error) {
    console.warn('[resurface] reminders error:', error.message)
    return null
  }

  const row = (data ?? []).find(
    (r) => !isDismissed(dismissed, 'due_reminder', r.id as string),
  )
  if (!row) return null

  return {
    kind: 'due_reminder',
    id: row.id as string,
    content: row.content as string,
    remind_at: row.remind_at as string,
    entry_id: (row.entry_id as string | null) ?? null,
  }
}

async function fetchOpenPrayer(
  sb: ReturnType<typeof requireSupabase>,
  dismissed: Set<string>,
): Promise<ResurfaceCard | null> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - OPEN_PRAYER_MIN_DAYS)

  const { data, error } = await sb
    .from('spiritual_items')
    .select('id, content, created_at, entry_id')
    .eq('type', 'prayer')
    .is('resolved_at', null)
    .lte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true })
    .limit(10)

  if (error) {
    console.warn('[resurface] prayers error:', error.message)
    return null
  }

  const row = (data ?? []).find(
    (r) => !isDismissed(dismissed, 'open_prayer', r.id as string),
  )
  if (!row) return null

  return {
    kind: 'open_prayer',
    id: row.id as string,
    content: row.content as string,
    created_at: row.created_at as string,
    entry_id: (row.entry_id as string | null) ?? null,
  }
}

async function fetchEcho(
  sb: ReturnType<typeof requireSupabase>,
  dismissed: Set<string>,
): Promise<ResurfaceCard | null> {
  const { data, error } = await sb
    .from('echo_candidates')
    .select('id, entry_id, text, entry_date, created_at')
    .maybeSingle()

  if (error) {
    console.warn('[resurface] echo error:', error.message)
    return null
  }
  if (!data?.entry_id) return null
  if (isDismissed(dismissed, 'echo', data.entry_id as string)) return null

  return {
    kind: 'echo',
    entry_id: data.entry_id as string,
    text: data.text as string,
    entry_date: data.entry_date as string,
  }
}

async function fetchAnniversarySense(
  sb: ReturnType<typeof requireSupabase>,
  dismissed: Set<string>,
): Promise<ResurfaceCard | null> {
  const now = new Date()
  const month = now.getUTCMonth() + 1
  const day = now.getUTCDate()

  const { data, error } = await sb
    .from('spiritual_items')
    .select('id, content, created_at, entry_id')
    .eq('type', 'sense')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.warn('[resurface] senses error:', error.message)
    return null
  }

  for (const row of data ?? []) {
    const id = row.id as string
    if (isDismissed(dismissed, 'anniversary_sense', id)) continue

    const created = new Date(row.created_at as string)
    if (created.getUTCMonth() + 1 !== month || created.getUTCDate() !== day) continue

    const yearsAgo = now.getUTCFullYear() - created.getUTCFullYear()
    if (yearsAgo < 1) continue

    return {
      kind: 'anniversary_sense',
      id,
      content: row.content as string,
      years_ago: yearsAgo,
      entry_id: (row.entry_id as string | null) ?? null,
    }
  }

  return null
}

/** Pick one resurfacing card by priority: reminder → prayer → echo → anniversary sense. */
export async function fetchCurrentResurface(): Promise<ResurfaceCard | null> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) return null

  const dismissed = await loadDismissedIds(sb, session.user.id)

  const dueReminder = await fetchDueReminder(sb, dismissed)
  if (dueReminder) return dueReminder

  const openPrayer = await fetchOpenPrayer(sb, dismissed)
  if (openPrayer) return openPrayer

  const echo = await fetchEcho(sb, dismissed)
  if (echo) return echo

  return fetchAnniversarySense(sb, dismissed)
}

/** @deprecated Use fetchCurrentResurface */
export async function fetchCurrentEcho(): Promise<EchoCandidate | null> {
  const card = await fetchCurrentResurface()
  if (!card || card.kind !== 'echo') return null
  return {
    id: '',
    entry_id: card.entry_id,
    text: card.text,
    entry_date: card.entry_date,
    created_at: '',
  }
}

export async function dismissResurface(card: ResurfaceCard): Promise<void> {
  const sb = requireSupabase()
  const {
    data: { session },
  } = await sb.auth.getSession()
  if (!session) return

  let sourceType: ResurfaceSourceType
  let sourceId: string

  switch (card.kind) {
    case 'echo':
      sourceType = 'echo'
      sourceId = card.entry_id
      break
    case 'open_prayer':
      sourceType = 'open_prayer'
      sourceId = card.id
      break
    case 'due_reminder':
      sourceType = 'due_reminder'
      sourceId = card.id
      break
    case 'anniversary_sense':
      sourceType = 'anniversary_sense'
      sourceId = card.id
      break
  }

  await sb
    .from('resurface_dismissals')
    .upsert(
      { owner: session.user.id, source_type: sourceType, source_id: sourceId },
      { onConflict: 'owner,source_type,source_id' },
    )
    .throwOnError()

  if (card.kind === 'echo') {
    if (card.entry_id) {
      await sb
        .from('echo_dismissals')
        .upsert(
          { owner: session.user.id, entry_id: card.entry_id },
          { onConflict: 'owner,entry_id' },
        )
        .throwOnError()
    }
    await sb.from('echo_candidates').delete().eq('owner', session.user.id).throwOnError()
  }
}

/** @deprecated Use dismissResurface */
export async function dismissEcho(entryId: string | null): Promise<void> {
  if (!entryId) return
  await dismissResurface({
    kind: 'echo',
    entry_id: entryId,
    text: '',
    entry_date: '',
  })
}

function weeksAgo(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000))
}

function formatEchoDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}

export function resurfaceLeadCopy(card: ResurfaceCard): string {
  switch (card.kind) {
    case 'echo':
      return 'A resonance from your journal'
    case 'open_prayer': {
      const w = weeksAgo(card.created_at)
      if (w < 1) return 'You asked this recently. Still carrying it?'
      if (w === 1) return 'You asked this a week ago. Still carrying it?'
      return `You asked this ${w} weeks ago. Still carrying it?`
    }
    case 'due_reminder':
      return 'You asked to return to this'
    case 'anniversary_sense':
      if (card.years_ago === 1) return 'A year ago you sensed…'
      return `${card.years_ago} years ago you sensed…`
  }
}

export function resurfaceBodyText(card: ResurfaceCard): string {
  switch (card.kind) {
    case 'echo':
      return card.text
    case 'open_prayer':
    case 'due_reminder':
    case 'anniversary_sense':
      return card.content
  }
}

export function resurfaceDateLabel(card: ResurfaceCard): string | null {
  switch (card.kind) {
    case 'echo':
      return formatEchoDate(card.entry_date)
    case 'open_prayer':
      return formatEchoDate(card.created_at.slice(0, 10))
    case 'due_reminder':
      return new Date(card.remind_at).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    case 'anniversary_sense':
      return null
  }
}
