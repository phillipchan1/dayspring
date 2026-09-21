/**
 * VOLUMES — the finished notebook, which an app never gives you.
 *
 * A paper journal ends: you run out of pages, close it, and it goes on the
 * shelf with dates on the spine. Here a volume closes when about a notebook's
 * worth has been written, and the fill is NEVER shown — no meter, no "pages
 * left". A visible fill is a streak by another name (Principle 2); a volume
 * that closes on its own day is a surprise, not a target.
 *
 * Volumes follow the writer's pace, not the calendar: a slow year makes one
 * long volume, a full season fills one fast. Once a volume closes its last
 * page is recorded (`settings.volumeClosings`), so editing an old page can
 * never reopen a volume that has already gone on the shelf.
 */

import type { Entry } from '@/lib/types'

/** About a paper notebook's worth of handwriting. Tunable; never shown. */
export const VOLUME_WORDS = 35_000

type PageLike = Pick<Entry, 'id' | 'created_at' | 'word_count'>

export interface Volume {
  /** 1-based, oldest first. */
  n: number
  /** The first page — the stable key a name is stored under. */
  firstId: string
  lastId: string
  /** YYYY-MM-DD of the first and last page. */
  from: string
  to: string
  /** False for the volume being written now. */
  closed: boolean
  /** Every page in it, oldest first. */
  ids: string[]
}

export interface VolumesResult {
  volumes: Volume[]
  /** The last page of every closed volume, oldest first — what to persist. */
  closings: string[]
}

function chronological(entries: PageLike[]): PageLike[] {
  return entries.slice().sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

/**
 * Cut the archive into volumes. Recorded closings are honoured first (a
 * closing whose page no longer exists is simply dropped — that volume runs
 * on); past the last recorded closing, a volume closes on the page that
 * carries it over `threshold` words.
 */
export function computeVolumes(entries: PageLike[], recorded: readonly string[] = [], threshold = VOLUME_WORDS): VolumesResult {
  const pages = chronological(entries)
  const present = new Set(pages.map((p) => p.id))
  const kept = recorded.filter((id) => present.has(id))
  const keptSet = new Set(kept)
  const lastRecorded = kept[kept.length - 1]
  let pastRecorded = lastRecorded === undefined

  const volumes: Volume[] = []
  let current: PageLike[] = []
  let words = 0
  const close = (isClosed: boolean) => {
    if (current.length === 0) return
    const first = current[0]!
    const last = current[current.length - 1]!
    volumes.push({
      n: volumes.length + 1,
      firstId: first.id,
      lastId: last.id,
      from: first.created_at.slice(0, 10),
      to: last.created_at.slice(0, 10),
      closed: isClosed,
      ids: current.map((p) => p.id),
    })
    current = []
    words = 0
  }

  for (const p of pages) {
    current.push(p)
    words += Math.max(0, p.word_count ?? 0)
    if (keptSet.has(p.id)) {
      close(true)
      if (p.id === lastRecorded) pastRecorded = true
      continue
    }
    if (pastRecorded && words >= threshold) close(true)
  }
  close(false)

  return { volumes, closings: volumes.filter((v) => v.closed).map((v) => v.lastId) }
}

/** The volume a page is in. */
export function volumeOf(volumes: Volume[], entryId: string): Volume | undefined {
  return volumes.find((v) => v.ids.includes(entryId))
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** A stretch of the calendar said the way people say it: "March 2025",
 *  "March – June 2025", "November 2024 – February 2025", "March 2025 – now". */
export function spanName(from: string, to: string, open = false): string {
  const m = (d: string) => MONTHS[+d.slice(5, 7) - 1]!
  const y = (d: string) => d.slice(0, 4)
  if (open) return `${m(from)} ${y(from)} – now`
  if (from.slice(0, 7) === to.slice(0, 7)) return `${m(from)} ${y(from)}`
  if (y(from) === y(to)) return `${m(from)} – ${m(to)} ${y(to)}`
  return `${m(from)} ${y(from)} – ${m(to)} ${y(to)}`
}

/** The same stretch to the day — for volumes that share a month with a
 *  neighbour: "August 1 – 17, 2026", "August 18 – September 9, 2026". */
export function daySpanName(from: string, to: string, open = false): string {
  const md = (d: string) => `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}`
  const y = (d: string) => d.slice(0, 4)
  if (open) return `${md(from)}, ${y(from)} – now`
  if (y(from) !== y(to)) return `${md(from)}, ${y(from)} – ${md(to)}, ${y(to)}`
  if (from.slice(0, 7) === to.slice(0, 7)) return from === to ? `${md(from)}, ${y(from)}` : `${md(from)} – ${+to.slice(8, 10)}, ${y(to)}`
  return `${md(from)} – ${md(to)}, ${y(to)}`
}

/** The name the writer gave it, else its dates — "March – June 2025". The
 *  number is a shelf position, not a name, so it is never the title. When a
 *  neighbour shares its first or last month (a full season can fill two in
 *  one August), both are named to the day so no two read the same. */
export function volumeTitle(v: Volume, names: Record<string, string> | undefined, all?: readonly Volume[]): string {
  const given = names?.[v.firstId]?.trim()
  if (given) return given
  const prev = all?.[v.n - 2]
  const next = all?.[v.n]
  const shares = (prev && prev.to.slice(0, 7) === v.from.slice(0, 7)) || (next && next.from.slice(0, 7) === v.to.slice(0, 7))
  return shares ? daySpanName(v.from, v.to, !v.closed) : spanName(v.from, v.to, !v.closed)
}

/** A cloth colour per volume — stable, never meaningful. */
const CLOTH = ['#7a3b2e', '#2f4a5e', '#3d5a45', '#9a6b2f', '#5b5566', '#6d2f3a', '#2e3b36', '#8a4f33', '#4a4f6b', '#6b6247', '#3c2f4d', '#7d5a3c']
export function volumeColour(v: Pick<Volume, 'n'>): string {
  return CLOTH[(v.n - 1) % CLOTH.length]!
}
