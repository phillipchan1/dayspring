import type { SaveStatus } from '@/hooks/useAutosave'

/**
 * What the status cluster says, and how loudly.
 *
 * Saving and syncing are almost always nominal, and a status that is always
 * nominal has not earned permanent prose. So the steady state is one reassuring
 * word — "Saved" — and words are added back only when something actually needs
 * the writer: offline, a queue the server refused, a failed save.
 *
 * A journal is the one app where "is my writing safe?" is a real question, so
 * the word never disappears entirely. What goes is the running commentary: the
 * timestamp and the second "Synced" move into `detail`, shown on hover or a
 * long press, where they are available without being spent on every glance.
 *
 * Pure, so the whole ladder can be tested without rendering anything.
 */

export interface SyncSnapshot {
  online: boolean
  /** Queued local writes not yet on the server; these clear on their own. */
  pending: number
  /** Writes the server refused and the flush stopped retrying; these do not. */
  blocked: number
  pulling: boolean
}

/** How much attention the line is asking for. Drives the dot's colour. */
export type StatusTone = 'quiet' | 'attention' | 'error'

export interface StatusLine {
  /** What sits beside the dot. One word when all is well. */
  label: string
  tone: StatusTone
  /** The full picture, revealed on hover or long press. */
  detail: string
  /** Work in flight — the dot breathes faster. */
  busy: boolean
}

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.round((now - ts) / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return `${h}h ago`
}

/** The save half, on its own — also the word the nominal line shows. */
function savedWord(save: SaveStatus, lastSavedAt: number | null): string {
  if (save === 'saving') return 'Saving…'
  if (save === 'error') return 'Save failed'
  return lastSavedAt ? 'Saved' : 'Not saved yet'
}

export function statusLine(args: {
  save: SaveStatus
  lastSavedAt: number | null
  saveError: string | null
  sync: SyncSnapshot
  now?: number
}): StatusLine {
  const { save, lastSavedAt, saveError, sync, now = Date.now() } = args
  const word = savedWord(save, lastSavedAt)

  // The detail is always the whole picture, whatever the label ends up saying.
  const saveDetail =
    save === 'error'
      ? saveError || 'Save failed'
      : lastSavedAt
        ? `Saved ${timeAgo(lastSavedAt, now)}`
        : word
  let syncDetail: string
  if (!sync.online) syncDetail = sync.pending > 0 ? `Offline · ${sync.pending} waiting` : 'Offline'
  else if (sync.blocked > 0) syncDetail = `${sync.blocked} couldn't be saved to the cloud`
  else if (sync.pulling) syncDetail = 'Updating library'
  else if (sync.pending > 0) syncDetail = `Syncing ${sync.pending}`
  else syncDetail = 'Synced'
  const detail = `${saveDetail} · ${syncDetail}`

  const busy = save === 'saving' || sync.pulling || sync.pending > 0

  // The ladder, most urgent first. Only one rung ever shows.
  if (save === 'error') return { label: 'Save failed', tone: 'error', detail, busy }
  // Blocked writes outrank the reassurance: they are still only on this device
  // and, unlike pending, they will not clear on their own.
  if (sync.blocked > 0) {
    return { label: `${sync.blocked} didn't sync`, tone: 'attention', detail, busy }
  }
  // Offline still says "Saved" first — it is true, and it is the thing the
  // writer is actually asking about.
  if (!sync.online) return { label: `${word} · Offline`, tone: 'attention', detail, busy }

  return { label: word, tone: 'quiet', detail, busy }
}
