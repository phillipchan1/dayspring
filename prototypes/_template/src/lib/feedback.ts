export type Preference = 'A' | 'B' | 'C' | 'other'

export async function sendFeedback(payload: {
  preference: Preference
  otherDetail: string
  notes: string
}): Promise<void> {
  const res = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prototype: '__SLUG__', ...payload }),
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) {
    throw new Error(data.error || 'Could not send just now.')
  }
}
