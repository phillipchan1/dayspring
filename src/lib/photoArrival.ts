// Photos on their way into storage, as the page sees them.
//
// A dropped photo is already on this device; storage is the only place it is
// not. The editor used to draw nothing but an empty box until the round trip
// was over, which made a five-photo drop read as a page that had stopped
// listening. So the bytes in hand are drawn at once, pale, and the photo comes
// into colour as it is saved. This holds what that takes: the local picture,
// how far along each photo is, and — once it is saved — the same picture under
// its permanent name, so the page never asks storage for a photo it is holding.
//
// Nothing here is persisted. A placeholder met after a reload has no arrival;
// it draws as an empty tile and its line says only that it is still to save.

/**
 * `waiting` its turn · `preparing` (read, resized, fingerprinted) · `sending` ·
 * `held` on this device for want of a connection.
 */
export type ArrivalStage = 'waiting' | 'preparing' | 'sending' | 'held'

export interface PhotoArrival {
  /** The dropped file itself. Null when the browser cannot draw it. */
  url: string | null
  stage: ArrivalStage
  /** Its place in the batch it came in with, from 0. */
  index: number
  /** How many came in together. */
  of: number
  /** Width over height, once the picture has loaded. */
  ratio?: number
}

export interface SettledPhoto {
  url: string
  ratio?: number
}

const arrivals = new Map<string, PhotoArrival>()
const settled = new Map<string, SettledPhoto>()
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function localUrl(file: Blob): string | null {
  try {
    return URL.createObjectURL(file)
  } catch {
    return null
  }
}

function release(url: string | null | undefined): void {
  if (!url) return
  try {
    URL.revokeObjectURL(url)
  } catch {
    /* nothing to release */
  }
}

/** Photos that came in together. Call before their placeholders reach the page. */
export function beginArrivals(items: ReadonlyArray<{ id: string; file: Blob }>): void {
  items.forEach(({ id, file }, index) => {
    arrivals.set(id, { url: localUrl(file), stage: 'waiting', index, of: items.length })
  })
}

export function arrivalOf(pendingId: string): PhotoArrival | undefined {
  return arrivals.get(pendingId)
}

export function setArrivalStage(pendingId: string, stage: ArrivalStage): void {
  const arrival = arrivals.get(pendingId)
  if (!arrival || arrival.stage === stage) return
  arrival.stage = stage
  emit()
}

/** The picture loaded and showed its shape; a redraw should not re-flow for it. */
export function setArrivalRatio(pendingId: string, ratio: number): void {
  const arrival = arrivals.get(pendingId)
  if (arrival) arrival.ratio = ratio
}

/** The browser could not draw the file (a HEIC outside Safari). Stop offering it. */
export function forgetArrivalPicture(pendingId: string): void {
  const arrival = arrivals.get(pendingId)
  if (!arrival?.url) return
  release(arrival.url)
  arrival.url = null
}

/**
 * Saved. The local picture is kept under the photo's permanent key
 * (`<hash>.<ext>`) so the page goes on drawing what it already has.
 */
export function settleArrival(pendingId: string, key: string): void {
  const arrival = arrivals.get(pendingId)
  if (!arrival) return
  arrivals.delete(pendingId)
  if (!arrival.url) return
  if (settled.has(key)) release(arrival.url)
  else settled.set(key, { url: arrival.url, ...(arrival.ratio ? { ratio: arrival.ratio } : {}) })
}

/** The placeholder is gone and nothing took its place. */
export function dropArrival(pendingId: string): void {
  const arrival = arrivals.get(pendingId)
  if (!arrival) return
  arrivals.delete(pendingId)
  release(arrival.url)
}

export function settledPhoto(key: string): SettledPhoto | undefined {
  return settled.get(key)
}

export function subscribeArrivals(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const countPhotos = (n: number) => (n === 1 ? '1 photo' : `${n} photos`)

/**
 * The one line of words under photos that are not saved yet, or null when
 * there is nothing left to say and the ordinary caption line should stand.
 * `pendingIds` are the placeholders in one block, in page order.
 */
export function arrivalLine(pendingIds: readonly string[]): string | null {
  if (pendingIds.length === 0) return null
  const known = pendingIds
    .map((id) => arrivals.get(id))
    .filter((a): a is PhotoArrival => a !== undefined)

  const moving = known.filter((a) => a.stage !== 'held').sort((a, b) => a.index - b.index)
  const current = moving.find((a) => a.stage !== 'waiting') ?? moving[0]
  if (current) return current.of === 1 ? 'Saving…' : `Saving ${current.index + 1} of ${current.of}`

  if (known.length === pendingIds.length) {
    return `${countPhotos(pendingIds.length)} waiting for a connection`
  }
  return `${countPhotos(pendingIds.length)} still to save`
}

/** Tests only. */
export function resetArrivalsForTest(): void {
  arrivals.clear()
  settled.clear()
  listeners.clear()
}
