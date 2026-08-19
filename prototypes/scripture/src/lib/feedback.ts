export type Preference = 'A' | 'B' | 'other'

export const PREFERENCE_OPTIONS: {
  id: Preference
  label: string
  short: string
}[] = [
  {
    id: 'A',
    label: 'Link out to ESV.org when I want the full chapter',
    short: 'A — link out',
  },
  {
    id: 'B',
    label: 'Read this chapter beside my journal (with ESV.org to go deeper)',
    short: 'B — chapter beside journal',
  },
  {
    id: 'other',
    label: 'Something else',
    short: 'Something else',
  },
]

export async function sendFeedback(payload: {
  preference: Preference
  otherDetail: string
  notes: string
}): Promise<void> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prototype: 'scripture', ...payload }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(data.error || 'Could not send just now.')
  }
}
