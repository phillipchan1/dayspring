// Inline image rendering for `attachment:<sha256>.<ext>` refs.
//
// Resolved images render as block widgets: a click or a tap opens the photo,
// a right-click or a long-press its options. A photo still being saved is drawn from the file in hand,
// pale, and comes into colour as it goes (lib/photoArrival.ts).

import {
  Decoration,
  EditorView,
  WidgetType,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { RangeSetBuilder, StateEffect, StateField, type Extension } from '@codemirror/state'
import { supabase } from '@/lib/supabase'
import {
  PENDING_ATTACHMENT_REF_RE,
  fetchAttachmentMeta,
  imageSizeFrom,
  resolveAttachmentDisplayUrl,
  type ImageSize,
} from '@/lib/attachments'
import {
  formatPhotoMetaLine,
  isMeaningfulCaption,
  type AttachmentPhotoMeta,
} from '@/lib/attachmentCaption'
import { cropFor, type CropPlan } from '@/lib/attachmentLayout'
import { mountPhotoRows, type PhotoRowsHandle } from '@/lib/photoRowsDom'
import { findPhotoRuns, formatPhotoSetLine, photoRatio } from '@/lib/photoSet'
import {
  arrivalLine,
  arrivalOf,
  forgetArrivalPicture,
  setArrivalRatio,
  settledPhoto,
  subscribeArrivals,
} from '@/lib/photoArrival'
import {
  ATTACHMENT_DND_MIME,
  findAttachmentAtPos,
  findAttachmentByKey,
  withPhotoPlacement,
  type AttachmentEditTarget,
} from './attachmentInsert'
import { computeBlockPanelAnchor, type InlinePanelAnchor } from './inlinePanelAnchor'
import { editorTap, TAP_HOLD_MS, TAP_SLOP } from './pointerInput'

/**
 * Where a press on a photo landed, and what it asked for.
 *
 * A photo is an object you LOOK at: a plain click or tap opens it in the
 * viewer (`intent: 'look'`), as Photos and Notes do. Its options are the
 * secondary gesture — a right-click, ⌃-click or long-press — and come with no
 * intent. Both travel the same `onMenu` route, so every screen that shows the
 * options menu already knows how to look (ImageContextMenu answers `look` by
 * calling its own `onLook`).
 */
export interface ImageMenuPoint {
  x: number
  y: number
  intent?: 'look'
}

/** The height caps the size classes put on a lone photo (see the theme). */
const PHOTO_HEIGHT_CAP: Record<'s' | 'm', string> = {
  s: 'min(34vh, 260px)',
  m: 'min(56vh, 480px)',
}

/**
 * The width a lone, uncropped photo of known size will settle at — what the
 * size class gives the loaded image: the column for Full; otherwise as wide as
 * the height cap allows at its ratio, never wider than the column.
 */
export function sizedPhotoWidth(size: ImageSize, width: number, height: number): string {
  if (size === 'f') return '100%'
  return `min(100%, calc(${PHOTO_HEIGHT_CAP[size]} * ${(width / height).toFixed(5)}))`
}

/** What a set's own tools do: bring more photos into it, or open it to rearrange. */
export type PhotoSetAction = 'add' | 'arrange'

export type { AttachmentEditTarget } from './attachmentInsert'

const ATTACHMENT_RE =
  /!\[([^\]]*)\]\(attachment:([a-f0-9]{64})\.([a-z0-9]+)(?:\?size=([smf]))?\)/g

const urlResolved = StateEffect.define<void>()
const metaResolved = StateEffect.define<void>()
const resolvedUrls = new Map<string, string>()
const resolvedMeta = new Map<string, AttachmentPhotoMeta | null>()
const pendingFetches = new Map<string, Promise<string | null>>()
const pendingMetaFetches = new Map<string, Promise<AttachmentPhotoMeta | null>>()
// Shapes read off loaded images, for photos stored before sizes were recorded.
// Kept so a set does not re-flow from the 4:3 stand-in every time it is redrawn.
const learnedRatios = new Map<string, number>()
const activeViews = new Set<EditorView>()

let cachedOwnerId: string | null = null
let authListenerRegistered = false

async function getOwnerId(): Promise<string | null> {
  if (cachedOwnerId) return cachedOwnerId
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  cachedOwnerId = data.session?.user?.id ?? null
  return cachedOwnerId
}

function registerAuthListener(): void {
  if (authListenerRegistered || !supabase) return
  authListenerRegistered = true
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedOwnerId = session?.user?.id ?? null
    for (const view of activeViews) {
      if (!(view as unknown as { isDestroyed?: boolean }).isDestroyed) {
        fetchMissingUrls(view)
      }
    }
  })
}

function notifyAttachmentResolved(): void {
  for (const view of activeViews) {
    if (!(view as unknown as { isDestroyed?: boolean }).isDestroyed) {
      view.dispatch({ effects: [urlResolved.of(undefined), metaResolved.of(undefined)] })
    }
  }
}

function fetchAttachmentMetaCached(hash: string): Promise<AttachmentPhotoMeta | null> {
  if (resolvedMeta.has(hash)) return Promise.resolve(resolvedMeta.get(hash)!)

  const inflight = pendingMetaFetches.get(hash)
  if (inflight) return inflight

  const promise = getOwnerId()
    .then((ownerId) => {
      if (!ownerId || !supabase) return null
      return fetchAttachmentMeta(supabase, ownerId, hash)
    })
    .then((meta) => {
      pendingMetaFetches.delete(hash)
      resolvedMeta.set(hash, meta)
      return meta
    })
    .catch(() => {
      pendingMetaFetches.delete(hash)
      resolvedMeta.set(hash, null)
      return null
    })

  pendingMetaFetches.set(hash, promise)
  return promise
}

function fetchMissingMeta(view: EditorView): void {
  if (!supabase) return
  const text = view.state.doc.toString()
  ATTACHMENT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTACHMENT_RE.exec(text)) !== null) {
    const hash = m[2]!
    if (resolvedMeta.has(hash)) continue
    void fetchAttachmentMetaCached(hash).then((meta) => {
      if (meta) notifyAttachmentResolved()
    })
  }
}

/**
 * The picture for a photo, if this session already has one — including the
 * file it was saved from a moment ago, which is taken up here so the page
 * never goes to storage for a photo it is holding.
 */
function knownUrl(key: string): string | null {
  const url = resolvedUrls.get(key)
  if (url) return url
  const local = settledPhoto(key)
  if (!local) return null
  resolvedUrls.set(key, local.url)
  if (local.ratio && !learnedRatios.has(key)) learnedRatios.set(key, local.ratio)
  return local.url
}

function fetchAttachmentUrl(hash: string, ext: string): Promise<string | null> {
  const key = `${hash}.${ext}`
  const known = knownUrl(key)
  if (known) return Promise.resolve(known)

  const inflight = pendingFetches.get(key)
  if (inflight) return inflight

  const promise = getOwnerId()
    .then((ownerId) => {
      if (!ownerId || !supabase) return null
      return resolveAttachmentDisplayUrl(supabase, ownerId, hash, ext)
    })
    .then((url) => {
      pendingFetches.delete(key)
      if (url) resolvedUrls.set(key, url)
      return url ?? null
    })
    .catch(() => {
      pendingFetches.delete(key)
      return null
    })

  pendingFetches.set(key, promise)
  return promise
}

function syncCachedUrls(view: EditorView): void {
  const text = view.state.doc.toString()
  ATTACHMENT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTACHMENT_RE.exec(text)) !== null) {
    const key = `${m[2]!}.${m[3]!}`
    if (resolvedUrls.has(key)) {
      // Not synchronously: this runs while the view is being constructed, and a
      // dispatch from inside that throws ("update in progress"), which takes
      // this whole plugin down — and with it every later URL fetch.
      queueMicrotask(() => {
        if (activeViews.has(view)) {
          view.dispatch({ effects: [urlResolved.of(undefined), metaResolved.of(undefined)] })
        }
      })
      return
    }
  }
}

// ── Widgets ───────────────────────────────────────────────────────────────────

export { cropFor }
export type { CropPlan }

class AttachmentImageWidget extends WidgetType {
  constructor(
    readonly cacheKey: string,
    readonly resolvedUrl: string | null,
    readonly caption: string | null,
    readonly metaLine: string | null,
    readonly size: ImageSize,
    readonly width: number | undefined,
    readonly height: number | undefined,
    readonly color: string | undefined,
  ) {
    super()
  }

  eq(other: AttachmentImageWidget): boolean {
    return (
      other.cacheKey === this.cacheKey &&
      other.resolvedUrl === this.resolvedUrl &&
      other.caption === this.caption &&
      other.metaLine === this.metaLine &&
      other.size === this.size &&
      other.width === this.width &&
      other.height === this.height &&
      other.color === this.color
    )
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = `cm-attachment cm-attachment--interactive cm-attachment--size-${this.size}`
    wrap.contentEditable = 'false'
    // No `title`: a tooltip of instructions is a web tell, and the gestures
    // are the platform's own (click to look, right-click for options).
    wrap.draggable = true
    wrap.dataset.attachmentKey = this.cacheKey

    // Dominant color tints the drop shadow and backs the media box so the photo
    // feels woven into the page (and the loading wash matches).
    if (this.color) wrap.style.setProperty('--photo-tint', this.color)

    // A centered frame that hugs the image so the hover chrome and caption align
    // to the photo — not the empty column — when a portrait renders narrow.
    const frame = document.createElement('div')
    frame.className = 'cm-attachment__frame'
    wrap.append(frame)

    // Media box holds the image + hover chrome so the chrome overlays the photo's
    // bottom edge, never the caption/meta text that sits below it.
    const media = document.createElement('div')
    media.className = 'cm-attachment__media'
    if (this.color) media.style.backgroundColor = this.color
    // Cover-crop extreme aspect ratios (S/M only) to a calmer frame; the axis
    // class fixes the constrained dimension and the inline aspect-ratio derives
    // the other. Full and within-bounds photos render whole.
    const crop = cropFor(this.size, this.width, this.height)
    if (crop) {
      wrap.classList.add(crop.axis === 'height' ? 'cm-attachment--crop-h' : 'cm-attachment--crop-w')
      media.style.aspectRatio = crop.aspect
    } else if (this.width && this.height) {
      // Known dimensions: the photo's box is laid out at its final size before
      // a byte of it has decoded, so the page — and the caret line under it —
      // never jumps when it arrives (N5).
      wrap.classList.add('cm-attachment--sized')
      media.style.aspectRatio = `${this.width} / ${this.height}`
      frame.style.width = sizedPhotoWidth(this.size, this.width, this.height)
    }
    frame.append(media)

    const url = this.resolvedUrl
    if (url) {
      // Saved a moment ago from this very file: finish coming into colour
      // rather than fading in from nothing, the once.
      if (settledPhoto(this.cacheKey)?.url === url && !arrivedShown.has(this.cacheKey)) {
        arrivedShown.add(this.cacheKey)
        wrap.classList.add('cm-attachment--arrived')
      }
      const img = document.createElement('img')
      img.src = url
      img.alt = this.caption ?? 'Photo'
      img.className = 'cm-attachment__img'
      img.loading = 'lazy'
      img.draggable = false
      media.append(img)

      const chrome = document.createElement('div')
      chrome.className = 'cm-attachment__chrome'
      chrome.setAttribute('aria-hidden', 'true')
      const label = document.createElement('span')
      label.className = 'cm-attachment__chrome-label'
      label.textContent = 'photo'
      const hint = document.createElement('span')
      hint.className = 'cm-attachment__chrome-hint'
      hint.textContent = 'look'
      chrome.append(label, hint)
      media.append(chrome)
    } else {
      const ph = document.createElement('div')
      ph.className = 'cm-attachment__placeholder'
      ph.setAttribute('aria-hidden', 'true')
      // Loading wash in the photo's own color (falls back to the CSS gray).
      if (this.color) ph.style.background = this.color
      media.append(ph)
    }

    if (this.metaLine && !this.caption) {
      const meta = document.createElement('p')
      meta.className = 'cm-attachment__meta'
      meta.textContent = this.metaLine
      frame.append(meta)
    }

    if (this.caption) {
      const cap = document.createElement('p')
      cap.className = 'cm-attachment__caption'
      cap.textContent = this.caption
      frame.append(cap)
    }

    return wrap
  }

  ignoreEvent(): boolean {
    return false
  }
}

/** Lone photos already shown arriving, so a later redraw does not replay it. */
const arrivedShown = new Set<string>()

/** Write the line under photos still being saved, or the caption that follows it. */
function paintArrivalLine(el: HTMLElement): void {
  const ids = (el.dataset.arrivalLine ?? '').split(',').filter(Boolean)
  const text = arrivalLine(ids) ?? el.dataset.settledLine ?? ''
  if (el.textContent !== text) el.textContent = text
}

/**
 * A photo moved a step closer to saved. Stages are painted straight onto the
 * tiles already on screen rather than through a redraw, so the picture stays
 * put and the change of colour is a transition, not a new image.
 */
function paintArrivals(view: EditorView): void {
  for (const el of view.dom.querySelectorAll<HTMLElement>('[data-pending-id]')) {
    const stage = arrivalOf(el.dataset.pendingId!)?.stage
    if (stage) el.dataset.arrival = stage
  }
  for (const el of view.dom.querySelectorAll<HTMLElement>('[data-arrival-line]')) paintArrivalLine(el)
}

class PendingAttachmentWidget extends WidgetType {
  constructor(
    readonly alt: string,
    readonly pendingId: string,
    readonly url: string | null,
  ) {
    super()
  }

  eq(other: PendingAttachmentWidget): boolean {
    return other.alt === this.alt && other.pendingId === this.pendingId && other.url === this.url
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cm-attachment cm-attachment--uploading cm-attachment--size-m'
    wrap.contentEditable = 'false'
    wrap.setAttribute('aria-label', 'Saving photo')

    const line = (tag: 'p' | 'span', className: string) => {
      const el = document.createElement(tag)
      el.className = className
      el.dataset.arrivalLine = this.pendingId
      paintArrivalLine(el)
      return el
    }
    const placeholder = () => {
      const ph = document.createElement('div')
      ph.className = 'cm-attachment__placeholder'
      ph.append(line('span', 'cm-attachment__status'))
      return ph
    }

    if (!this.url) {
      wrap.append(placeholder())
      return wrap
    }

    // The file in hand, in the frame the saved photo will have.
    const frame = document.createElement('div')
    frame.className = 'cm-attachment__frame'
    const media = document.createElement('div')
    media.className = 'cm-attachment__media'
    media.dataset.pendingId = this.pendingId
    media.dataset.arrival = arrivalOf(this.pendingId)?.stage ?? 'waiting'
    const img = document.createElement('img')
    img.src = this.url
    img.alt = ''
    img.className = 'cm-attachment__img'
    img.draggable = false
    img.addEventListener(
      'error',
      () => {
        forgetArrivalPicture(this.pendingId)
        frame.replaceWith(placeholder())
      },
      { once: true },
    )
    media.append(img)
    frame.append(media, line('p', 'cm-attachment__meta'))
    wrap.append(frame)
    return wrap
  }

  ignoreEvent(): boolean {
    return true
  }
}

/** One photo in a set. `key` is null while the upload is still in flight. */
interface SetTile {
  key: string | null
  /** The placeholder's id, while there is no key. */
  pendingId: string | null
  /** For a photo not saved yet, the file it is being saved from. */
  url: string | null
  caption: string | null
  ratio: number
  /** False while `ratio` is the 4:3 stand-in. */
  known: boolean
  color: string | undefined
}

const setHandles = new WeakMap<HTMLElement, PhotoRowsHandle>()
/** What each set block on screen was last drawn from, for `updateDOM`. */
const setSpecs = new WeakMap<HTMLElement, readonly SetTile[]>()

/** Everything about a tile that changes when its photo goes from saving to saved. */
function dressTile(tile: HTMLElement, spec: SetTile): void {
  tile.style.backgroundColor = spec.color ?? ''
  tile.classList.toggle('cm-attachment--interactive', spec.key !== null)
  tile.classList.toggle('cm-photoset__tile--pending', spec.key === null && !spec.url)
  if (spec.key) {
    tile.dataset.attachmentKey = spec.key
    tile.draggable = true
    tile.removeAttribute('title')
    tile.removeAttribute('aria-label')
    delete tile.dataset.pendingId
    delete tile.dataset.arrival
    return
  }
  delete tile.dataset.attachmentKey
  tile.draggable = false
  tile.removeAttribute('title')
  tile.setAttribute('aria-label', 'Saving photo')
  const stage = spec.pendingId ? arrivalOf(spec.pendingId)?.stage : undefined
  if (spec.pendingId) tile.dataset.pendingId = spec.pendingId
  if (stage) tile.dataset.arrival = stage
}

function setArrivalIds(tiles: readonly SetTile[]): string {
  return tiles.flatMap((t) => (t.pendingId ? [t.pendingId] : [])).join(',')
}

/**
 * Several photos on touching lines, drawn as one block of rows (lib/photoSet.ts).
 *
 * One widget over the whole run rather than one per line: a row holds photos
 * from several lines, and CodeMirror gives each block widget a line box of its
 * own. Every tile still carries its own key and its place in the set, so a
 * click or a drag acts on that photo and not on the block.
 */
class PhotoSetWidget extends WidgetType {
  constructor(
    readonly tiles: readonly SetTile[],
    readonly metaLine: string,
  ) {
    super()
  }

  eq(other: PhotoSetWidget): boolean {
    return (
      other.metaLine === this.metaLine &&
      other.tiles.length === this.tiles.length &&
      other.tiles.every((t, i) => {
        const mine = this.tiles[i]!
        return (
          t.key === mine.key &&
          t.pendingId === mine.pendingId &&
          t.url === mine.url &&
          t.caption === mine.caption &&
          t.ratio === mine.ratio &&
          t.known === mine.known &&
          t.color === mine.color
        )
      })
    )
  }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cm-attachment cm-photoset'
    wrap.contentEditable = 'false'

    const rows = document.createElement('div')
    rows.className = 'cm-photoset__rows'
    wrap.append(rows)

    const items = this.tiles.map((spec, index) => {
      const tile = document.createElement('div')
      tile.className = 'cm-photoset__tile'
      tile.dataset.setIndex = String(index)
      dressTile(tile, spec)

      let img: HTMLImageElement | null = null
      if (spec.url) {
        img = document.createElement('img')
        img.src = spec.url
        img.alt = spec.caption ?? 'Photo'
        img.className = 'cm-photoset__img'
        img.loading = 'lazy'
        img.draggable = false
        const pendingId = spec.pendingId
        if (pendingId) {
          const shown = img
          shown.addEventListener(
            'error',
            () => {
              forgetArrivalPicture(pendingId)
              shown.remove()
              tile.classList.add('cm-photoset__tile--pending')
            },
            { once: true },
          )
        }
        tile.append(img)
      }
      if (spec.caption) {
        const cap = document.createElement('span')
        cap.className = 'cm-photoset__caption'
        cap.textContent = spec.caption
        tile.append(cap)
      }
      return { el: tile, ratio: spec.ratio, known: spec.known, img }
    })

    // Two quiet words over the set's corner, shown while the pointer is on it.
    // Not drawn for touch: there the photo's own sheet carries the same two.
    const tools = document.createElement('div')
    tools.className = 'cm-photoset__tools'
    for (const [action, label, hint] of [
      ['add', '+ Add', 'Add photos to this set'],
      ['arrange', 'Arrange', 'Reorder or remove photos'],
    ] as const) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'cm-photoset__tool'
      button.dataset.photosetAction = action
      button.textContent = label
      button.title = hint
      button.setAttribute('aria-label', hint)
      tools.append(button)
    }
    wrap.append(tools)

    const meta = document.createElement('p')
    meta.className = 'cm-attachment__meta'
    meta.dataset.settledLine = this.metaLine
    meta.dataset.arrivalLine = setArrivalIds(this.tiles)
    paintArrivalLine(meta)
    wrap.append(meta)

    setSpecs.set(wrap, this.tiles)
    // The block is not in the document yet, so it has no width to measure. The
    // column it is about to sit in does: the content box, less its own padding.
    const column = getComputedStyle(view.contentDOM)
    const columnWidth =
      view.contentDOM.clientWidth - parseFloat(column.paddingLeft) - parseFloat(column.paddingRight)
    setHandles.set(
      wrap,
      mountPhotoRows(rows, items, {
        rowClass: 'cm-photoset__row',
        fallbackWidth: columnWidth,
        // The block changed height; CodeMirror's height map has to hear of it.
        onLayout: () => view.requestMeasure(),
        onLearnRatio: (index, ratio) => {
          const spec = setSpecs.get(wrap)?.[index]
          if (spec?.key) learnedRatios.set(spec.key, ratio)
          else if (spec?.pendingId) setArrivalRatio(spec.pendingId, ratio)
        },
      }),
    )
    return wrap
  }

  /**
   * The same photos showing the same pictures: change what is said about them
   * and leave the images alone. This is what lets a photo finish coming into
   * colour when its placeholder becomes its ref — a rebuilt tile would start
   * over from a blank one, and so would every other photo in the set.
   */
  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    const prev = setSpecs.get(dom)
    const handle = setHandles.get(dom)
    if (!prev || !handle || prev.length !== this.tiles.length) return false
    if (!this.tiles.every((t, i) => t.url === prev[i]!.url && t.caption === prev[i]!.caption)) {
      return false
    }
    const els = new Map<number, HTMLElement>()
    for (const el of dom.querySelectorAll<HTMLElement>('.cm-photoset__tile')) {
      els.set(Number(el.dataset.setIndex), el)
    }
    if (els.size !== this.tiles.length) return false
    const meta = dom.querySelector<HTMLElement>(':scope > .cm-attachment__meta')
    if (!meta) return false

    this.tiles.forEach((spec, index) => dressTile(els.get(index)!, spec))
    setSpecs.set(dom, this.tiles)
    handle.setRatios(this.tiles.map((t) => (t.known ? t.ratio : null)))
    meta.dataset.settledLine = this.metaLine
    meta.dataset.arrivalLine = setArrivalIds(this.tiles)
    paintArrivalLine(meta)
    view.requestMeasure()
    return true
  }

  destroy(dom: HTMLElement): void {
    setHandles.get(dom)?.destroy()
    setHandles.delete(dom)
  }

  ignoreEvent(): boolean {
    return false
  }
}

// ── Decoration builder ────────────────────────────────────────────────────────

interface AttachmentDecoMatch {
  from: number
  to: number
  deco: Decoration
}

function buildDecos(text: string): DecorationSet {
  const matches: AttachmentDecoMatch[] = []

  // Photo lines that touch are one set, drawn by one widget; the per-photo
  // loops below skip anything a set already covers.
  const sets = findPhotoRuns(text).filter((run) => run.refs.length > 1)
  const inSet = (pos: number) => sets.some((run) => pos >= run.from && pos < run.to)
  for (const run of sets) {
    const taken: (string | undefined)[] = []
    const tiles = run.refs.map((ref): SetTile => {
      const caption = isMeaningfulCaption(ref.alt) ? ref.alt.trim() : null
      if (!ref.hash) {
        const arrival = ref.pendingId ? arrivalOf(ref.pendingId) : undefined
        return {
          key: null,
          pendingId: ref.pendingId ?? null,
          url: arrival?.url ?? null,
          caption,
          ratio: arrival?.ratio ?? photoRatio(),
          known: arrival?.ratio !== undefined,
          color: undefined,
        }
      }
      const key = `${ref.hash}.${ref.ext!}`
      const meta = resolvedMeta.get(ref.hash) ?? undefined
      taken.push(meta?.takenAt)
      const sized = Boolean(meta?.width && meta?.height)
      const learned = learnedRatios.get(key)
      return {
        key,
        pendingId: null,
        url: knownUrl(key),
        caption,
        ratio: sized ? photoRatio(meta!.width, meta!.height) : (learned ?? photoRatio()),
        known: sized || learned !== undefined,
        color: meta?.color,
      }
    })
    matches.push({
      from: run.from,
      to: run.to,
      deco: Decoration.replace({
        widget: new PhotoSetWidget(tiles, formatPhotoSetLine(tiles.length, taken)),
        block: true,
        inclusive: false,
      }),
    })
  }

  PENDING_ATTACHMENT_REF_RE.lastIndex = 0
  let pending: RegExpExecArray | null
  while ((pending = PENDING_ATTACHMENT_REF_RE.exec(text)) !== null) {
    if (inSet(pending.index)) continue
    const [full, alt, pendingId] = pending
    matches.push({
      from: pending.index,
      to: pending.index + full!.length,
      deco: Decoration.replace({
        widget: new PendingAttachmentWidget(alt ?? '', pendingId!, arrivalOf(pendingId!)?.url ?? null),
        block: true,
        inclusive: false,
      }),
    })
  }

  ATTACHMENT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTACHMENT_RE.exec(text)) !== null) {
    if (inSet(m.index)) continue
    const [full, alt, hash, ext, sizeRaw] = m
    const key = `${hash!}.${ext!}`
    const caption = isMeaningfulCaption(alt ?? '') ? alt!.trim() : null
    const meta = resolvedMeta.get(hash!) ?? undefined
    const metaLine = formatPhotoMetaLine(meta)
    matches.push({
      from: m.index,
      to: m.index + full!.length,
      deco: Decoration.replace({
        widget: new AttachmentImageWidget(
          key,
          knownUrl(key),
          caption,
          caption ? null : metaLine,
          imageSizeFrom(sizeRaw),
          meta?.width,
          meta?.height,
          meta?.color,
        ),
        block: true,
        inclusive: false,
      }),
    })
  }

  matches.sort((a, b) => a.from - b.from || a.to - b.to)

  const builder = new RangeSetBuilder<Decoration>()
  for (const { from, to, deco } of matches) {
    builder.add(from, to, deco)
  }
  return builder.finish()
}

const attachmentDecoField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecos(state.doc.toString())
  },
  update(deco, tr) {
    const hasEffect = tr.effects.some((e) => e.is(urlResolved) || e.is(metaResolved))
    if (tr.docChanged || hasEffect) return buildDecos(tr.state.doc.toString())
    return deco.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f),
})

// ── URL fetch ─────────────────────────────────────────────────────────────────

function fetchMissingUrls(view: EditorView): void {
  if (!supabase) return
  const text = view.state.doc.toString()
  ATTACHMENT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTACHMENT_RE.exec(text)) !== null) {
    const hash = m[2]!
    const ext = m[3]!
    const key = `${hash}.${ext}`
    if (knownUrl(key)) continue
    void fetchAttachmentUrl(hash, ext).then((url) => {
      if (url) notifyAttachmentResolved()
    })
  }
}

function attachmentInitPlugin(): Extension {
  return ViewPlugin.define((view) => {
    activeViews.add(view)
    registerAuthListener()
    fetchMissingUrls(view)
    fetchMissingMeta(view)
    syncCachedUrls(view)
    const stopArrivals = subscribeArrivals(() => {
      paintArrivals(view)
      view.requestMeasure()
    })
    return {
      update(u: ViewUpdate) {
        if (u.docChanged) {
          fetchMissingUrls(u.view)
          fetchMissingMeta(u.view)
        }
      },
      destroy() {
        stopArrivals()
        activeViews.delete(view)
      },
    }
  })
}

/**
 * The photo a piece of editor DOM stands for — a tile in a set, or a lone
 * photo's block. For a drop, where there is an element under the pointer but
 * the coordinates only resolve to an edge of the block.
 */
export function resolvePhotoElement(
  view: EditorView,
  blockEl: HTMLElement,
): AttachmentEditTarget | null {
  const rect = blockEl.getBoundingClientRect()
  return resolveAttachmentTarget(view, blockEl, rect.left + rect.width / 2, rect.top + rect.height / 2)
}

function resolveAttachmentTarget(
  view: EditorView,
  blockEl: HTMLElement,
  clientX: number,
  clientY: number,
): AttachmentEditTarget | null {
  const doc = view.state.doc.toString()

  // A tile in a set: coordinates resolve to the block, not to the photo, so the
  // tile says which place it holds and the run under the block says which ref.
  const setEl = blockEl.closest<HTMLElement>('.cm-photoset')
  if (setEl && blockEl.dataset.setIndex !== undefined) {
    const at = view.posAtDOM(setEl)
    const run = findPhotoRuns(doc).find(
      (r) => r.refs.length > 1 && at >= r.refs[0]!.lineFrom && at <= r.to,
    )
    const ref = run?.refs[Number(blockEl.dataset.setIndex)]
    if (!ref?.hash) return null
    return withPhotoPlacement(doc, {
      hash: ref.hash,
      ext: ref.ext!,
      alt: ref.alt,
      size: ref.size,
      from: ref.from,
      to: ref.to,
    })
  }

  const pos = view.posAtCoords({ x: clientX, y: clientY })
  let target = pos === null ? null : findAttachmentAtPos(doc, pos)
  // Coords can land outside the ref range (a photo rendered tight against
  // another block widget); fall back to the clicked element's own key.
  if (!target && blockEl.dataset.attachmentKey) {
    target = findAttachmentByKey(doc, blockEl.dataset.attachmentKey)
  }
  return target ? withPhotoPlacement(doc, target) : null
}

/**
 * The presses a photo answers (DESIGN_PRINCIPLES N4):
 *
 *  - a click (mouse, on release, so a press can still become a drag) or a
 *    tap (`editorTap`: a finger acts on release, once it has proved to be a
 *    tap) opens the photo in the viewer;
 *  - a right-click, ⌃-click or long-press opens its options at the pointer.
 *
 * WebKit's own image callout never fires: the attachment is
 * `-webkit-touch-callout: none` (theme). `dragstart` tags the transfer so the
 * drop handler can move the ref instead of treating it as a file drop.
 */
function attachmentMenuHandler(
  onMenu: (
    target: AttachmentEditTarget,
    point: ImageMenuPoint,
    anchor: InlinePanelAnchor,
  ) => void,
  onSetAction?: (action: PhotoSetAction, target: AttachmentEditTarget) => void,
): Extension {
  /** A set's Add or Arrange. It acts on the set, so any photo in it stands for it. */
  const setTool = (event: MouseEvent, view: EditorView): boolean => {
    const button = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-photoset-action]')
    if (!button) return false
    event.preventDefault()
    const action = button.dataset.photosetAction as PhotoSetAction
    const tiles = button.closest('.cm-photoset')?.querySelectorAll<HTMLElement>('.cm-photoset__tile[data-attachment-key]')
    const tile = tiles?.[tiles.length - 1]
    const target = tile ? resolvePhotoElement(view, tile) : null
    if (target) onSetAction?.(action, target)
    return true
  }

  const photoAt = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) return null
    if (target.closest('[data-photoset-action]')) return null
    return target.closest<HTMLElement>('.cm-attachment--interactive')
  }

  const openAt = (
    view: EditorView,
    blockEl: HTMLElement,
    x: number,
    y: number,
    intent?: 'look',
  ): boolean => {
    const target = resolveAttachmentTarget(view, blockEl, x, y)
    if (!target) return false
    onMenu(target, { x, y, ...(intent ? { intent } : null) }, computeBlockPanelAnchor(view, blockEl))
    return true
  }

  const open = (event: MouseEvent, view: EditorView, intent?: 'look'): boolean => {
    const blockEl = photoAt(event.target)
    if (!blockEl) return false
    if (!openAt(view, blockEl, event.clientX, event.clientY, intent)) return false
    event.preventDefault()
    return true
  }

  /*
   * A finger: a tap looks, a hold asks for options. The hold is timed here;
   * `editorTap` refuses anything held past TAP_HOLD_MS, and `held` covers the
   * release that lands on the very millisecond.
   */
  let held = false
  const touchTap = editorTap({
    claims: (ctx) => ctx.pointerType !== 'mouse' && photoAt(ctx.target) != null,
    onTap: (ctx, view) => {
      if (held) {
        held = false
        return true
      }
      const blockEl = photoAt(ctx.target)
      return blockEl ? openAt(view, blockEl, ctx.clientX, ctx.clientY, 'look') : false
    },
  })
  const longPress = ViewPlugin.define((view) => {
    let timer: number | undefined
    let origin: { x: number; y: number; id: number } | null = null
    const cancel = () => {
      window.clearTimeout(timer)
      timer = undefined
      origin = null
    }
    const down = (e: PointerEvent) => {
      cancel()
      held = false
      if (e.pointerType === 'mouse') return
      const blockEl = photoAt(e.target)
      if (!blockEl) return
      const start = { x: e.clientX, y: e.clientY, id: e.pointerId }
      origin = start
      timer = window.setTimeout(() => {
        timer = undefined
        origin = null
        held = true
        openAt(view, blockEl, start.x, start.y)
      }, TAP_HOLD_MS)
    }
    const move = (e: PointerEvent) => {
      if (!origin || e.pointerId !== origin.id) return
      if (Math.abs(e.clientX - origin.x) > TAP_SLOP || Math.abs(e.clientY - origin.y) > TAP_SLOP) cancel()
    }
    const dom = view.contentDOM
    dom.addEventListener('pointerdown', down, true)
    dom.addEventListener('pointermove', move, true)
    dom.addEventListener('pointerup', cancel, true)
    dom.addEventListener('pointercancel', cancel, true)
    return {
      destroy() {
        cancel()
        dom.removeEventListener('pointerdown', down, true)
        dom.removeEventListener('pointermove', move, true)
        dom.removeEventListener('pointerup', cancel, true)
        dom.removeEventListener('pointercancel', cancel, true)
      },
    }
  })

  return [touchTap, longPress, EditorView.domEventHandlers({
    // A completed drag emits no `click`, so a plain handler won't fire mid-move.
    // Pressing a set's tool must not move the caret into the text beside it.
    mousedown(event) {
      if (!(event.target as HTMLElement | null)?.closest('[data-photoset-action]')) return false
      event.preventDefault()
      return true
    },
    click(event, view) {
      if (event.button !== 0) return false
      if (setTool(event, view)) return true
      // ⌃-click is the Mac's right-click; the contextmenu below answers it.
      if (event.ctrlKey) return false
      return open(event, view, 'look')
    },
    contextmenu(event, view) {
      // Options, and no native menu — on photos only; text keeps spellcheck.
      return open(event, view)
    },
    dragstart(event, _view) {
      const blockEl = (event.target as HTMLElement | null)?.closest(
        '.cm-attachment--interactive',
      ) as HTMLElement | null
      const key = blockEl?.dataset.attachmentKey
      if (!blockEl || !key || !event.dataTransfer) return false
      event.dataTransfer.setData(ATTACHMENT_DND_MIME, key)
      event.dataTransfer.effectAllowed = 'move'
      blockEl.classList.add('cm-attachment--dragging')
      const clear = () => {
        blockEl.classList.remove('cm-attachment--dragging')
        blockEl.removeEventListener('dragend', clear)
      }
      blockEl.addEventListener('dragend', clear)
      return false
    },
  })]
}

const attachmentTheme = EditorView.theme({
  '.cm-attachment': {
    display: 'block',
    margin: '0.6rem 0',
    lineHeight: '1',
    // A long-press is ours (options), never WebKit's image callout. The
    // editor turns the callout back on for text, so the photo turns it off.
    WebkitTouchCallout: 'none',
  },
  '.cm-attachment--interactive': {
    cursor: 'default',
  },
  // The frame hugs the image (fit-content) and centers it, so a portrait that
  // renders narrow leaves balanced whitespace and the chrome/caption align to
  // the photo — not the full-width wrapper.
  '.cm-attachment__frame': {
    position: 'relative',
    display: 'block',
    width: 'fit-content',
    // Floor so the frame can't collapse when the image has no width yet — while
    // loading, unresolved, or broken. Without it, fit-content shrinks to ~0
    // (the caption is width:0, see below), and the caption's min-width:100%
    // resolves to ~0 → one glyph per line. Loaded photos exceed this and the
    // floor never binds; clamped to the column so it can't overflow on mobile.
    minWidth: 'min(240px, 100%)',
    maxWidth: '100%',
    margin: '0 auto',
  },
  // Media box owns the rounded clip, drop shadow, and a hairline ring so the
  // photo edge stays crisp against the warm page background (light photos
  // otherwise bleed into it). Chrome overlays this box, not the caption below.
  '.cm-attachment__media': {
    position: 'relative',
    display: 'block',
    maxWidth: '100%',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    // Drop shadow tinted by the photo's dominant color (neutral fallback), plus
    // a hairline ring to keep the edge crisp on the warm page.
    boxShadow:
      '0 10px 26px -8px color-mix(in srgb, var(--photo-tint, #1a120a) 40%, transparent), inset 0 0 0 1px rgba(20, 12, 4, 0.07)',
    transition: 'box-shadow 160ms ease',
  },
  '.cm-attachment__img': {
    display: 'block',
    width: 'auto',
    maxWidth: '100%',
    // Default cap so a tall portrait can't dominate the entry; size classes
    // below tune it. Landscape stays full-width (the cap doesn't bind).
    maxHeight: 'min(56vh, 480px)',
    height: 'auto',
    margin: '0',
    background: 'var(--bg-input)',
    animation: 'cm-attachment-fadein 220ms ease both',
    transition: 'filter 900ms ease',
  },
  // ── A photo still being saved (lib/photoArrival.ts) ─────────────────────────
  // It is on the page from the moment it is dropped, pale, and comes into
  // colour as it is read, sent and kept. `filter` rather than `opacity`: the
  // fade-in above holds opacity at its last frame.
  '[data-arrival] > .cm-attachment__img, [data-arrival] > .cm-photoset__img': {
    filter: 'grayscale(1) contrast(0.85) opacity(0.32)',
  },
  '[data-arrival="preparing"] > .cm-attachment__img, [data-arrival="preparing"] > .cm-photoset__img': {
    filter: 'grayscale(0.7) contrast(0.9) opacity(0.5)',
  },
  // The long one: sending is most of the wait, so it is most of the colour.
  '[data-arrival="sending"] > .cm-attachment__img, [data-arrival="sending"] > .cm-photoset__img': {
    filter: 'grayscale(0.25) contrast(1) opacity(0.8)',
    transitionDuration: '2400ms',
  },
  // A lone photo is redrawn when it is saved; this carries it the last step.
  '.cm-attachment--arrived .cm-attachment__img': {
    animation: 'cm-attachment-arrive 900ms ease both',
  },
  '@media (prefers-reduced-motion: reduce)': {
    '.cm-attachment__img, .cm-photoset__img': { transition: 'none' },
    '.cm-attachment--arrived .cm-attachment__img': { animation: 'none' },
  },
  '.cm-attachment--size-s .cm-attachment__img': {
    maxHeight: 'min(34vh, 260px)',
  },
  '.cm-attachment--size-m .cm-attachment__img': {
    maxHeight: 'min(56vh, 480px)',
  },
  // Full: fill the text column (the original behavior), opt-in per photo.
  '.cm-attachment--size-f .cm-attachment__img': {
    width: '100%',
    maxHeight: 'none',
  },
  // Cover-crop modes (extreme aspect ratios). The media box's aspect-ratio is set
  // inline; here we fix the constrained dimension and let the image fill it.
  // Listed after the size rules so the cover override wins on equal specificity.
  '.cm-attachment--crop-h.cm-attachment--size-s .cm-attachment__media': {
    height: 'min(34vh, 260px)',
    width: 'auto',
  },
  '.cm-attachment--crop-h.cm-attachment--size-m .cm-attachment__media': {
    height: 'min(56vh, 480px)',
    width: 'auto',
  },
  '.cm-attachment--crop-w .cm-attachment__media': {
    width: '100%',
    height: 'auto',
  },
  '.cm-attachment--crop-h .cm-attachment__img, .cm-attachment--crop-w .cm-attachment__img': {
    width: '100%',
    height: '100%',
    maxHeight: 'none',
    objectFit: 'cover',
  },
  // Known dimensions (see toDOM): the frame carries the final width inline and
  // the media box the ratio, so the image — and its placeholder — just fill it.
  // After the size rules, which they override at equal specificity.
  '.cm-attachment--sized .cm-attachment__frame': {
    minWidth: '0',
  },
  '.cm-attachment--sized .cm-attachment__media': {
    width: '100%',
  },
  '.cm-attachment--sized .cm-attachment__img': {
    width: '100%',
    height: '100%',
    maxHeight: 'none',
    objectFit: 'cover',
  },
  '.cm-attachment--sized .cm-attachment__placeholder': {
    height: '100%',
    borderRadius: '0',
  },
  '.cm-attachment__chrome': {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
    padding: '0.45rem 0.65rem',
    borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
    background: 'linear-gradient(to top, rgba(20, 12, 4, 0.52), transparent)',
    opacity: '0',
    transition: 'opacity 160ms ease',
    pointerEvents: 'none',
  },
  '.cm-attachment__chrome-label': {
    fontFamily: 'var(--font-editor)',
    fontSize: '0.66em',
    letterSpacing: '0.06em',
    textTransform: 'lowercase',
    color: 'rgba(255, 255, 255, 0.92)',
  },
  '.cm-attachment__chrome-hint': {
    fontFamily: 'var(--font-editor)',
    fontSize: '0.66em',
    letterSpacing: '0.02em',
    color: 'rgba(255, 255, 255, 0.72)',
  },
  // Caption/meta sit below the photo and must track the photo's width, not the
  // full column. The frame is `fit-content`, so a bare paragraph would widen it
  // to its single-line max-content (overflowing a narrow portrait). `width: 0`
  // makes the text contribute nothing to the frame's intrinsic width — the frame
  // keeps hugging the photo — while `min-width: 100%` forces the text to fill the
  // photo's width and wrap beneath it. Sizes are kept small so they read as
  // captions, not body text (the editor font is large and user-scalable).
  '.cm-attachment__caption': {
    width: '0',
    minWidth: '100%',
    margin: '0.35rem 0 0',
    fontFamily: 'var(--font-editor)',
    fontSize: '0.66em',
    lineHeight: '1.45',
    color: 'var(--text-dim)',
  },
  '.cm-attachment__meta': {
    width: '0',
    minWidth: '100%',
    margin: '0.3rem 0 0',
    fontFamily: 'var(--font-editor)',
    fontSize: '0.62em',
    letterSpacing: '0.02em',
    color: 'var(--text-faint)',
    lineHeight: '1.4',
  },
  '.cm-attachment__placeholder': {
    display: 'block',
    width: '100%',
    maxWidth: '100%',
    height: '120px',
    borderRadius: 'var(--radius)',
    background: 'var(--bg-input)',
    opacity: '0.6',
    animation: 'cm-attachment-pulse 1.4s ease-in-out infinite',
  },
  '.cm-attachment--uploading .cm-attachment__placeholder': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── A set: touching photo lines drawn as rows (lib/photoSet.ts) ──────────────
  // Tile sizes and the row wrappers are set by mountPhotoRows; this is only skin.
  '.cm-photoset__tile': {
    position: 'relative',
    flex: '0 0 auto',
    overflow: 'hidden',
    borderRadius: '4px',
    background: 'var(--bg-input)',
    boxShadow: 'inset 0 0 0 1px rgba(20, 12, 4, 0.07)',
  },
  '.cm-photoset__img': {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    animation: 'cm-attachment-fadein 220ms ease both',
    transition: 'filter 900ms ease',
  },
  '.cm-photoset__tile--pending': {
    animation: 'cm-attachment-pulse 1.4s ease-in-out infinite',
  },
  '.cm-photoset__caption': {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '1.1rem 0.5rem 0.35rem',
    background: 'linear-gradient(to top, rgba(15, 10, 5, 0.66), transparent)',
    color: '#fff8ec',
    fontFamily: 'var(--font-editor)',
    fontStyle: 'italic',
    fontSize: '0.62em',
    lineHeight: '1.3',
    display: '-webkit-box',
    WebkitLineClamp: '2',
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  '.cm-photoset': {
    position: 'relative',
  },
  '.cm-photoset__tools': {
    position: 'absolute',
    top: '0.45rem',
    right: '0.45rem',
    display: 'flex',
    gap: '0.3rem',
    opacity: '0',
    transition: 'opacity 160ms ease',
    pointerEvents: 'none',
  },
  '.cm-photoset__tools:focus-within': {
    opacity: '1',
    pointerEvents: 'auto',
  },
  '@media (hover: none)': {
    '.cm-photoset__tools': { display: 'none' },
  },
  // Every hover on a photo, pointer only: on touch `:hover` latches on the
  // last tap, which left the "photo · options" gradient and the accent ring
  // painted on a photo after it was tapped (DESIGN_PRINCIPLES N2).
  '@media (hover: hover)': {
    '.cm-attachment--interactive:hover .cm-attachment__media': {
      boxShadow:
        '0 10px 26px -8px color-mix(in srgb, var(--photo-tint, #1a120a) 48%, transparent), inset 0 0 0 1px rgba(20, 12, 4, 0.07), 0 0 0 1px color-mix(in srgb, var(--accent) 34%, transparent)',
    },
    '.cm-attachment--interactive:hover .cm-attachment__chrome': {
      opacity: '1',
    },
    // Inset: the rows clip at the set's edge, and an outer ring would be cut there.
    '.cm-photoset__tile.cm-attachment--interactive:hover': {
      boxShadow: 'inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 55%, transparent)',
    },
    '.cm-photoset:hover .cm-photoset__tools': {
      opacity: '1',
      pointerEvents: 'auto',
    },
    '.cm-photoset__tool:hover': {
      background: 'rgba(20, 12, 4, 0.8)',
    },
  },
  '.cm-photoset__tool': {
    border: '0',
    borderRadius: '999px',
    padding: '0.3rem 0.7rem',
    background: 'rgba(20, 12, 4, 0.62)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    color: 'rgba(255, 255, 255, 0.94)',
    fontFamily: 'var(--font-ui, system-ui, sans-serif)',
    fontSize: '12px',
    lineHeight: '1.2',
    letterSpacing: '0.01em',
    cursor: 'default',
  },
  '.cm-photoset__tool:focus-visible': {
    outline: '2px solid var(--accent)',
    outlineOffset: '1px',
  },
  '.cm-photoset .cm-attachment__meta': {
    width: 'auto',
    minWidth: '0',
    margin: '0.45rem 0 0',
    textAlign: 'center',
  },
  '.cm-attachment__status': {
    fontFamily: 'var(--font-editor)',
    fontSize: '0.7em',
    letterSpacing: '0.04em',
    textTransform: 'lowercase',
    color: 'var(--text-faint)',
  },
})

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * @param onMenu Called for any press on a resolved photo: with `intent: 'look'`
 * for a click or a tap, without one for a right-click or a long-press.
 */
export function attachmentImageExtension(
  onMenu?: (
    target: AttachmentEditTarget,
    point: ImageMenuPoint,
    anchor: InlinePanelAnchor,
  ) => void,
  onSetAction?: (action: PhotoSetAction, target: AttachmentEditTarget) => void,
): Extension {
  return [
    attachmentTheme,
    attachmentDecoField,
    EditorView.atomicRanges.of((view) => view.state.field(attachmentDecoField)),
    attachmentInitPlugin(),
    ...(onMenu ? [attachmentMenuHandler(onMenu, onSetAction)] : []),
  ]
}

/**
 * Dev harness only (`?__preview=photos`): seed what the network would have
 * resolved, so photos draw with no account behind them.
 */
export function primeAttachmentPreview(
  key: string,
  url: string,
  meta: AttachmentPhotoMeta | null,
): void {
  resolvedUrls.set(key, url)
  resolvedMeta.set(key.split('.')[0]!, meta)
}

/** Warm the URL cache so edit popovers can show a preview immediately. */
export async function resolveCachedAttachmentPreview(
  hash: string,
  ext: string,
): Promise<string | null> {
  const key = `${hash}.${ext}`
  if (resolvedUrls.has(key)) return resolvedUrls.get(key)!
  if (!supabase) return null
  const ownerId = await getOwnerId()
  if (!ownerId) return null
  const url = await resolveAttachmentDisplayUrl(supabase, ownerId, hash, ext)
  if (url) resolvedUrls.set(key, url)
  return url
}

export async function resolveCachedAttachmentMeta(
  hash: string,
): Promise<AttachmentPhotoMeta | null> {
  if (resolvedMeta.has(hash)) return resolvedMeta.get(hash)! ?? null
  return fetchAttachmentMetaCached(hash)
}
