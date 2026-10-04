// How a photo looks from far back: its colour and its shape, and nothing else.
//
// The entries list draws a page's photos as small prints in that colour (D-034).
// The colour is the photo's own average, the one `analyzeImage` stores in
// `attachments.metadata` when a photo is added, so a print is her photo seen
// from a distance, not a mark we chose for it. No pixels are fetched to draw a
// print: this module reads metadata, a few hundred hashes per request.
//
// Kept on the device under `dayspring.photo_looks`, stamped with its owner and
// scrubbed with the other owner-scoped flags (localData.ts), so the list is
// coloured on a plane and a second account on the same browser starts blank.
//
// ── Photos that came in without a colour ──────────────────────────────────────
//
// Until D-034 the Day One and Diarly importers never ran `analyzeImage`, so an
// archivist's photos (the people with the most of them) arrived with no colour
// at all. Imports measure now; the photos already in are learned lazily: the first time a page's print is asked for, a 48px render
// of the photo is fetched, averaged the same way, and written back to its row.
// A small budget per session, two at a time, and never offline, so an archive
// of thousands colours itself over a few visits of ordinary scrolling.

import { useEffect, useSyncExternalStore } from 'react'
import { analyzeImage } from './imageCompress'
import { resolveAttachmentUrl } from './attachments'
import { supabase } from './supabase'

export interface PhotoLook {
  /** `#rrggbb`, or null when the photo has none (yet). */
  color: string | null
  /** Width over height, when known. */
  ratio: number | null
}

export interface PhotoRef {
  hash: string
  ext: string
}

export interface StoredMeta {
  hash: string
  metadata: Record<string, unknown> | null
}

export interface PhotoLookDeps {
  /** The signed-in owner, or null (guest, signed out, no backend). */
  owner(): Promise<string | null>
  /** `attachments.metadata` for these hashes. Rows for hashes the owner lacks are simply absent. */
  read(owner: string, hashes: string[]): Promise<StoredMeta[]>
  /** Average a small render of the photo. Null when it cannot be had. */
  measure(owner: string, ref: PhotoRef): Promise<string | null>
  /** Merge the learned colour into the row's metadata. */
  write(owner: string, hash: string, metadata: Record<string, unknown>): Promise<void>
  online(): boolean
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
}

export const PHOTO_LOOKS_KEY = 'dayspring.photo_looks'
/** Hashes per metadata read: 64 hex chars each keeps the request line well under any limit. */
const READ_CHUNK = 120
/** Colours learned per session, so a cold archive never turns scrolling into a download. */
export const LEARN_BUDGET = 48
const LEARN_CONCURRENCY = 2
const HEX_RE = /^#[0-9a-f]{6}$/i

/** Read a colour and shape out of a metadata blob, trusting nothing about its shape. */
export function lookFromMetadata(metadata: Record<string, unknown> | null | undefined): PhotoLook {
  const color = typeof metadata?.color === 'string' && HEX_RE.test(metadata.color) ? metadata.color : null
  const w = metadata?.width
  const h = metadata?.height
  const ratio = typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0 ? w / h : null
  return { color, ratio }
}

export function createPhotoLookStore(deps: PhotoLookDeps) {
  const looks = new Map<string, PhotoLook>()
  /** Rows as read, so a learned colour merges into everything else already there. */
  const rows = new Map<string, Record<string, unknown>>()
  const exts = new Map<string, string>()
  const asked = new Set<string>()
  const wanted = new Set<string>()
  const toLearn: string[] = []
  const listeners = new Set<() => void>()
  let version = 0
  let owner: string | null | undefined
  let flushing: Promise<void> | null = null
  let scheduled = false
  let learning = 0
  let learned = 0
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function emit() {
    version++
    for (const fn of listeners) fn()
  }

  function restore(id: string) {
    try {
      const raw = deps.storage?.getItem(PHOTO_LOOKS_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as { owner?: unknown; looks?: Record<string, [string | null, number | null]> }
      if (saved.owner !== id || !saved.looks) return
      for (const [hash, [color, ratio]] of Object.entries(saved.looks)) {
        if (!looks.has(hash)) looks.set(hash, { color, ratio })
      }
    } catch {
      /* unreadable cache: start over */
    }
  }

  function save() {
    if (saveTimer || !deps.storage || !owner) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      // Only colours are worth keeping. A photo with none is asked again next
      // visit, which is what lets a colour learned on another device arrive.
      const out: Record<string, [string | null, number | null]> = {}
      for (const [hash, look] of looks) if (look.color) out[hash] = [look.color, look.ratio]
      try {
        deps.storage?.setItem(PHOTO_LOOKS_KEY, JSON.stringify({ owner, looks: out }))
      } catch {
        /* full or blocked: the prints still draw this session */
      }
    }, 800)
  }

  async function ownerNow(): Promise<string | null> {
    if (owner !== undefined) return owner
    owner = await deps.owner()
    if (owner) {
      restore(owner)
      // Whatever the device already knew draws now, before any read lands.
      if (looks.size > 0) emit()
    }
    return owner
  }

  async function flush() {
    scheduled = false
    const id = await ownerNow()
    const batch = [...wanted].filter((h) => !looks.has(h) || !looks.get(h)?.color)
    wanted.clear()
    if (!id || batch.length === 0 || !deps.online()) {
      // Offline: let these be asked again once the reads can land.
      if (id && !deps.online()) for (const h of batch) asked.delete(h)
      return
    }
    for (let i = 0; i < batch.length; i += READ_CHUNK) {
      const chunk = batch.slice(i, i + READ_CHUNK)
      let found: StoredMeta[]
      try {
        found = await deps.read(id, chunk)
      } catch {
        // Offline or refused: let these be asked again on the next scroll.
        for (const h of chunk) asked.delete(h)
        continue
      }
      const seen = new Set<string>()
      for (const row of found) {
        seen.add(row.hash)
        rows.set(row.hash, row.metadata ?? {})
        const look = lookFromMetadata(row.metadata)
        looks.set(row.hash, look)
        if (!look.color) toLearn.push(row.hash)
      }
      for (const h of chunk) if (!seen.has(h)) looks.set(h, { color: null, ratio: null })
    }
    emit()
    save()
    learnSome()
  }

  function learnSome() {
    while (learning < LEARN_CONCURRENCY && learned < LEARN_BUDGET && toLearn.length > 0 && owner && deps.online()) {
      const hash = toLearn.shift()!
      const ext = exts.get(hash)
      if (!ext) continue
      learning++
      learned++
      void learnOne(owner, { hash, ext }).finally(() => {
        learning--
        learnSome()
      })
    }
  }

  async function learnOne(id: string, ref: PhotoRef) {
    try {
      const color = await deps.measure(id, ref)
      if (!color || !HEX_RE.test(color)) return
      const prev = looks.get(ref.hash)
      looks.set(ref.hash, { color, ratio: prev?.ratio ?? null })
      emit()
      save()
      const metadata = { ...(rows.get(ref.hash) ?? {}), color }
      rows.set(ref.hash, metadata)
      await deps.write(id, ref.hash, metadata)
    } catch {
      /* a colour we could not learn is a neutral print, which is still true */
    }
  }

  return {
    /** Looks known without asking: dev previews, which have no account to ask. */
    seed(known: Record<string, PhotoLook>) {
      for (const [hash, look] of Object.entries(known)) {
        looks.set(hash, look)
        asked.add(hash)
      }
      emit()
    },
    /** Ask for these photos' looks. Cheap to call on every render: only new hashes go out. */
    want(refs: readonly PhotoRef[]) {
      let added = false
      for (const r of refs) {
        exts.set(r.hash, r.ext)
        if (asked.has(r.hash)) continue
        asked.add(r.hash)
        wanted.add(r.hash)
        added = true
      }
      if (!added || scheduled) return
      scheduled = true
      // One read for everything a scroll frame brought into view.
      queueMicrotask(() => {
        flushing = (flushing ?? Promise.resolve()).then(flush)
      })
    },
    get(hash: string): PhotoLook | undefined {
      return looks.get(hash)
    },
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    version: () => version,
    /** Settles once every read asked for so far has landed. For tests. */
    idle: async () => {
      await Promise.resolve()
      await flushing
    },
  }
}

export type PhotoLookStore = ReturnType<typeof createPhotoLookStore>

const SMALL = { width: 48, quality: 60, resize: 'contain' as const }

const defaultDeps: PhotoLookDeps = {
  async owner() {
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return data.session?.user?.id ?? null
  },
  async read(owner, hashes) {
    if (!supabase) return []
    const { data, error } = await supabase
      .from('attachments')
      .select('hash, metadata')
      .eq('owner', owner)
      .in('hash', hashes)
    if (error) throw error
    return (data ?? []) as StoredMeta[]
  },
  async measure(owner, ref) {
    if (!supabase) return null
    const url = await resolveAttachmentUrl(supabase, owner, ref.hash, ref.ext, SMALL)
    if (!url) return null
    const res = await fetch(url)
    if (!res.ok) return null
    return (await analyzeImage(await res.blob())).color ?? null
  },
  async write(owner, hash, metadata) {
    if (!supabase) return
    await supabase.from('attachments').update({ metadata }).eq('owner', owner).eq('hash', hash)
  },
  online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  storage: typeof localStorage === 'undefined' ? null : localStorage,
}

let shared: PhotoLookStore | null = null
function store(): PhotoLookStore {
  shared ??= createPhotoLookStore(defaultDeps)
  return shared
}

/** Dev previews only (`?__preview=pages&photos=1`): colours for fixture photos. */
export function seedPhotoLooks(known: Record<string, PhotoLook>): void {
  store().seed(known)
}

/**
 * The looks of these photos, re-rendering as they arrive.
 *
 * Returns the store's getter; read it during render. `undefined` means not
 * known yet, and a print draws neutral until it is.
 */
export function usePhotoLooks(refs: readonly PhotoRef[]): (hash: string) => PhotoLook | undefined {
  const s = store()
  useSyncExternalStore(s.subscribe, s.version, s.version)
  const key = refs.map((r) => r.hash).join(',')
  useEffect(() => {
    if (refs.length > 0) s.want(refs)
    // `key` stands for `refs`: a new array with the same photos is not a new ask.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, s])
  return s.get
}
