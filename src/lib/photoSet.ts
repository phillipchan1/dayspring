// Photos, together.
//
// One rule makes a set, and it is a rule about the text:
//
//     photo lines with no blank line between them are one set.
//     a blank line ends it. a photo alone is a set of one.
//
// Nothing else is stored. How a set is drawn (rows of equal height, every
// photo whole) is a rendering, shared by the editor and the reader, so the two
// can never disagree about what belongs together.

import { isMeaningfulCaption } from './attachmentCaption'
import type { ImageSize } from './attachments'
import { ATTACHMENT_REF_RE, imageSizeFrom } from './attachments'

/** A line holding one photo ref and nothing else. Groups: alt, hash, ext, size, pendingId. */
export const PHOTO_LINE_RE =
  /^\s*!\[([^\]]*)\]\((?:attachment:([a-f0-9]{64})\.([a-z0-9]+)(?:\?size=([smf]))?|attachment-pending:([a-f0-9-]{36}))\)\s*$/

export function isPhotoLine(line: string | undefined): boolean {
  return line !== undefined && PHOTO_LINE_RE.test(line)
}

export interface PhotoRunRef {
  /** Range of the ref itself, without the line's surrounding whitespace. */
  from: number
  to: number
  /** Range of the whole line, newline excluded. */
  lineFrom: number
  lineTo: number
  alt: string
  size: ImageSize
  /** Set for an uploaded photo. */
  hash?: string
  ext?: string
  /** Set while the upload is still in flight. */
  pendingId?: string
}

export interface PhotoRun {
  /** From the first ref's start to the last ref's end. */
  from: number
  to: number
  refs: PhotoRunRef[]
}

/** Every run of consecutive photo lines, in document order. A lone photo is a run of one. */
export function findPhotoRuns(doc: string): PhotoRun[] {
  const runs: PhotoRun[] = []
  let current: PhotoRunRef[] = []
  const flush = () => {
    if (current.length) {
      runs.push({ from: current[0]!.from, to: current[current.length - 1]!.to, refs: current })
      current = []
    }
  }

  let lineFrom = 0
  for (const line of doc.split('\n')) {
    const m = PHOTO_LINE_RE.exec(line)
    if (!m) {
      flush()
    } else {
      const lead = line.length - line.trimStart().length
      const from = lineFrom + lead
      current.push({
        from,
        to: from + line.trim().length,
        lineFrom,
        lineTo: lineFrom + line.length,
        alt: m[1] ?? '',
        size: imageSizeFrom(m[4]),
        ...(m[5] ? { pendingId: m[5] } : { hash: m[2]!, ext: m[3]! }),
      })
    }
    lineFrom += line.length + 1
  }
  flush()
  return runs
}

/** Where a photo sits: which run, and at what place in it. */
export function photoPlacement(
  doc: string,
  refFrom: number,
): { run: PhotoRun; index: number; runIndex: number; runs: PhotoRun[] } | null {
  const runs = findPhotoRuns(doc)
  for (let runIndex = 0; runIndex < runs.length; runIndex++) {
    const run = runs[runIndex]!
    const index = run.refs.findIndex((r) => r.from === refFrom)
    if (index >= 0) return { run, index, runIndex, runs }
  }
  return null
}

/** One replacement, in the shape the editor handle's `replaceRange` takes. */
export interface PhotoEdit {
  from: number
  to: number
  insert: string
  /** Where the caret rests afterwards: an edge of the block, never inside it. */
  caret: number
}

/**
 * "Put with the photos above": close the blank lines between this photo and the
 * photo line before it. Null when something other than blank lines sits between
 * them — a photo never jumps over writing.
 */
export function planJoinAbove(doc: string, refFrom: number): PhotoEdit | null {
  const here = photoPlacement(doc, refFrom)
  if (!here || here.index !== 0 || here.runIndex === 0) return null
  const above = here.runs[here.runIndex - 1]!
  const last = above.refs[above.refs.length - 1]!
  const between = doc.slice(last.lineTo, here.run.refs[0]!.lineFrom)
  if (between.trim() !== '') return null
  const first = here.run.refs[0]!
  return {
    from: last.lineTo,
    to: first.lineFrom,
    insert: '\n',
    caret: last.lineTo + 1 + (here.run.to - first.lineFrom),
  }
}

export function canJoinAbove(doc: string, refFrom: number): boolean {
  return planJoinAbove(doc, refFrom) !== null
}

function rewriteRun(run: PhotoRun, lines: string[]): PhotoEdit {
  const from = run.refs[0]!.lineFrom
  const to = run.refs[run.refs.length - 1]!.lineTo
  const insert = lines.join('\n')
  return { from, to, insert, caret: from + insert.length }
}

/** "Take out of the set": the photo becomes a photo on its own, just below the set. */
export function planTakeOut(doc: string, refFrom: number): PhotoEdit | null {
  const here = photoPlacement(doc, refFrom)
  if (!here || here.run.refs.length < 2) return null
  const lines = here.run.refs.map((r) => doc.slice(r.lineFrom, r.lineTo))
  const [mine] = lines.splice(here.index, 1)
  return rewriteRun(here.run, [...lines, '', mine!])
}

/** "Make this the first photo": the lead is whatever the writer put first. */
export function planMakeFirst(doc: string, refFrom: number): PhotoEdit | null {
  const here = photoPlacement(doc, refFrom)
  if (!here || here.index === 0) return null
  const lines = here.run.refs.map((r) => doc.slice(r.lineFrom, r.lineTo))
  const [mine] = lines.splice(here.index, 1)
  return rewriteRun(here.run, [mine!, ...lines])
}

/**
 * Remove a photo. Inside a set the whole line goes, newline included — an empty
 * line left behind is a blank line, and a blank line would cut the set in two.
 */
export function planRemovePhoto(doc: string, refFrom: number, refTo: number): PhotoEdit {
  const here = photoPlacement(doc, refFrom)
  if (!here || here.run.refs.length < 2) {
    return { from: refFrom, to: refTo, insert: '', caret: refFrom }
  }
  const ref = here.run.refs[here.index]!
  const isLast = here.index === here.run.refs.length - 1
  const from = isLast ? here.run.refs[here.index - 1]!.lineTo : ref.lineFrom
  const to = isLast ? ref.lineTo : here.run.refs[here.index + 1]!.lineFrom
  // What is left of the set ends this many characters sooner.
  return { from, to, insert: '', caret: here.run.to - (to - from) }
}

/** "Move earlier" / "Move later": one place along within the set. The way to reorder without a drag. */
export function planMoveWithin(doc: string, refFrom: number, delta: -1 | 1): PhotoEdit | null {
  const here = photoPlacement(doc, refFrom)
  if (!here) return null
  const to = here.index + delta
  if (to < 0 || to >= here.run.refs.length) return null
  const lines = here.run.refs.map((r) => doc.slice(r.lineFrom, r.lineTo))
  const [mine] = lines.splice(here.index, 1)
  lines.splice(to, 0, mine!)
  return rewriteRun(here.run, lines)
}

/** The smallest single replacement that turns `before` into `after`. */
function singleChange(before: string, after: string): { from: number; to: number; insert: string } {
  let head = 0
  const max = Math.min(before.length, after.length)
  while (head < max && before[head] === after[head]) head++
  let tail = 0
  while (
    tail < max - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail++
  }
  return { from: head, to: before.length - tail, insert: after.slice(head, after.length - tail) }
}

/** The end of the run that holds the photo line starting at `lineFrom`. */
function runEndAt(doc: string, lineFrom: number): number {
  const run = findPhotoRuns(doc).find((r) => r.refs.some((ref) => ref.lineFrom === lineFrom))
  return run ? run.to : lineFrom
}

/**
 * Photo lines dropped beside a photo: they join its set, before or after it.
 * This is how files from outside land on a set, and how a lone photo gains a
 * neighbour.
 */
export function planInsertBeside(
  doc: string,
  targetFrom: number,
  after: boolean,
  lines: readonly string[],
): PhotoEdit | null {
  const there = photoPlacement(doc, targetFrom)
  if (!there || lines.length === 0) return null
  const ref = there.run.refs[there.index]!
  const text = lines.join('\n')
  const at = after ? ref.lineTo : ref.lineFrom
  const insert = after ? `\n${text}` : `${text}\n`
  return { from: at, to: at, insert, caret: there.run.to + insert.length }
}

/**
 * A photo dragged onto another photo: it leaves where it was and sits beside
 * the one it was dropped on, in that photo's set. Covers reordering within a
 * set, carrying a photo from one set to another, and making a set of two out
 * of two lone photos. Null when it would land where it already is.
 */
export function planPlaceBeside(
  doc: string,
  sourceFrom: number,
  targetFrom: number,
  after: boolean,
): PhotoEdit | null {
  const src = photoPlacement(doc, sourceFrom)
  const dst = photoPlacement(doc, targetFrom)
  if (!src || !dst || sourceFrom === targetFrom) return null
  const moved = src.run.refs[src.index]!
  const line = doc.slice(moved.from, moved.to)

  if (src.runIndex === dst.runIndex) {
    const lines = src.run.refs.map((r) => doc.slice(r.lineFrom, r.lineTo))
    const [mine] = lines.splice(src.index, 1)
    const at = (dst.index > src.index ? dst.index - 1 : dst.index) + (after ? 1 : 0)
    if (at === src.index) return null
    lines.splice(at, 0, mine!)
    return rewriteRun(src.run, lines)
  }

  // Out of where it was. In a set the line goes whole; a lone photo takes the
  // blank line that set it apart with it, so no gap is left behind.
  let cutFrom: number
  let cutTo: number
  if (src.run.refs.length > 1) {
    const cut = planRemovePhoto(doc, moved.from, moved.to)
    cutFrom = cut.from
    cutTo = cut.to
  } else {
    cutFrom = moved.lineFrom
    cutTo = moved.lineTo
    let taken = 0
    while (cutTo < doc.length && doc[cutTo] === '\n' && taken < 2) {
      cutTo++
      taken++
    }
    if (taken === 0) {
      while (cutFrom > 0 && doc[cutFrom - 1] === '\n' && taken < 2) {
        cutFrom--
        taken++
      }
    }
  }

  const target = dst.run.refs[dst.index]!
  const at = after ? target.lineTo : target.lineFrom
  const piece = after ? `\n${line}` : `${line}\n`
  // Later edit first, so the earlier position is still good when it is applied.
  let next = doc
  let landed: number
  if (at >= cutTo) {
    next = next.slice(0, at) + piece + next.slice(at)
    next = next.slice(0, cutFrom) + next.slice(cutTo)
    landed = at - (cutTo - cutFrom)
  } else {
    next = next.slice(0, cutFrom) + next.slice(cutTo)
    next = next.slice(0, at) + piece + next.slice(at)
    landed = at
  }
  const lineFrom = after ? landed + 1 : landed
  return { ...singleChange(doc, next), caret: runEndAt(next, lineFrom) }
}

/**
 * The captions a writer gave their photos, in order. A filename the Photos app
 * made up is not one. These are the writer's own sentences, so anything that
 * searches or quotes "what she wrote" may read them.
 */
export function photoCaptions(markdown: string | null | undefined): string[] {
  const out: string[] = []
  for (const m of (markdown ?? '').matchAll(ATTACHMENT_REF_RE)) {
    const alt = (m[1] ?? '').trim()
    if (isMeaningfulCaption(alt)) out.push(alt)
  }
  return out
}

/** A caption lives in the ref's alt text, so it cannot hold a bracket or a line break. */
export function cleanCaption(text: string): string {
  return text.replace(/[[\]\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
}

// ── Rows ──────────────────────────────────────────────────────────────────────

/** Space between photos in a set, both ways. */
export const PHOTO_ROW_GAP = 4

/** Below this column width a set is on a phone and its rows run lower. */
const PHONE_COLUMN = 480
const ROW_TARGET_PHONE = 140
const ROW_TARGET_WIDE = 172

/** No row runs lower than this share of the target: under it a photo is a thumbnail. */
const MIN_ROW_SHARE = 0.7

/** A photo with a row to itself is a photo on its own, so it takes a lone photo's height cap. */
const SOLO_MAX_HEIGHT = 480

/**
 * What it costs to leave the last row short of the column, at the target height
 * and centred. Priced like a row half again too tall, so a pair that would have
 * to grow further than that to fill the column is left at the target instead.
 */
const LOOSE_END_COST = Math.log(1.5) ** 2
/** On top of that when the row is one photo: a lone photo at the end looks forgotten. */
const LONE_END_COST = 0.5
/** A tie between "first photo alone" and "last photo alone" goes to the first. */
const LEAD_BIAS = 0.95

// The same limits a lone photo crops at (attachmentLayout.ts), so a screenshot
// or a panorama cannot bend the row it sits in.
const MIN_RATIO = 2 / 3
const MAX_RATIO = 16 / 9
const UNKNOWN_RATIO = 4 / 3

/** The height a row aims for at this column width. */
export function photoRowTarget(width: number): number {
  return width < PHONE_COLUMN ? ROW_TARGET_PHONE : ROW_TARGET_WIDE
}

/** Width over height, held to the ratios a photo is ever drawn at. 4:3 until it is known. */
export function photoRatio(width?: number, height?: number): number {
  if (!width || !height) return UNKNOWN_RATIO
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, width / height))
}

export interface PhotoRow {
  /** Index of the row's first photo, and how many it holds. */
  start: number
  count: number
  height: number
  /** False when the row does not reach both edges — it is centred instead. */
  justified: boolean
}

/**
 * Lay photos in rows of equal height that fill the column, every photo whole.
 *
 * The breaks are chosen over the whole set at once, not row by row: of every
 * way to split the photos into rows, take the one whose rows sit nearest the
 * target height. Filling greedily strands the end — a short full row, then a
 * taller loose one — and the end is where a justified layout looks careless.
 *
 * Three things shape the choice beyond "near the target":
 *
 * - no row runs under `MIN_ROW_SHARE` of the target;
 * - the last row may stay short of the column, centred at the target height,
 *   but it costs, and costs more when it is a single photo — so three photos
 *   that would leave one over give the first photo a row to itself instead.
 *   The first photo is the one the writer chose to put first;
 * - a photo alone in a row is never taller than a lone photo is anywhere else.
 */
export function layoutPhotoRows(
  ratios: readonly number[],
  width: number,
  target: number = photoRowTarget(width),
  gap: number = PHOTO_ROW_GAP,
): PhotoRow[] {
  const n = ratios.length
  if (n === 0 || width <= 0) return []

  const sums = [0]
  for (const r of ratios) sums.push(sums[sums.length - 1]! + r)
  /** Height at which photos `start..end-1` exactly fill the column. */
  const fit = (start: number, end: number): number =>
    (width - gap * (end - start - 1)) / (sums[end]! - sums[start]!)

  // best[i]: the cheapest way to lay out photos i..n-1, and where its first row ends.
  const best: { cost: number; end: number; loose: boolean }[] = new Array(n + 1)
  best[n] = { cost: 0, end: n, loose: false }
  for (let i = n - 1; i >= 0; i--) {
    let pick = { cost: Infinity, end: n, loose: true }
    for (let end = i + 1; end <= n; end++) {
      const h = fit(i, end)
      const count = end - i
      if (h >= target * MIN_ROW_SHARE || count === 1) {
        let cost = Math.log(h / target) ** 2
        if (count === 1 && i === 0) cost *= LEAD_BIAS
        cost += best[end]!.cost
        if (cost < pick.cost) pick = { cost, end, loose: false }
      }
      if (end === n && h > target) {
        const cost = LOOSE_END_COST + (count === 1 ? LONE_END_COST : 0)
        if (cost < pick.cost) pick = { cost, end, loose: true }
      }
    }
    best[i] = pick
  }

  const rows: PhotoRow[] = []
  for (let i = 0; i < n; i = best[i]!.end) {
    const { end, loose } = best[i]!
    const h = fit(i, end)
    const solo = end - i === 1
    if (loose) rows.push({ start: i, count: end - i, height: target, justified: false })
    else if (solo && h > SOLO_MAX_HEIGHT) rows.push({ start: i, count: 1, height: SOLO_MAX_HEIGHT, justified: false })
    else rows.push({ start: i, count: end - i, height: h, justified: true })
  }
  return rows
}

/** "5 photos · Saturday, September 20 · 7:02 – 7:48 AM", from when they were taken. Never authored. */
export function formatPhotoSetLine(count: number, takenAts: readonly (string | undefined)[]): string {
  const label = `${count} photos`
  const times = takenAts
    .map((t) => (t ? new Date(t) : null))
    .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())
  if (times.length === 0) return label

  const first = times[0]!
  const lastTime = times[times.length - 1]!
  const day = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

  if (first.toDateString() !== lastTime.toDateString()) {
    const short = (d: Date) => d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    return `${label} · ${short(first)} – ${short(lastTime)}`
  }
  const span = first.getTime() === lastTime.getTime() ? time(first) : `${time(first)} – ${time(lastTime)}`
  return `${label} · ${day(first)} · ${span}`
}
