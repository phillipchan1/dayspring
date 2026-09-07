// Inline image rendering for `attachment:<sha256>.<ext>` refs.
//
// Resolved images render as block widgets with hover + click-to-edit, matching
// spiritual blocks. Pending uploads show a pulsing placeholder.

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
import {
  ATTACHMENT_DND_MIME,
  findAttachmentAtPos,
  findAttachmentByKey,
  type AttachmentEditTarget,
} from './attachmentInsert'
import { computeBlockPanelAnchor, type InlinePanelAnchor } from './inlinePanelAnchor'

export interface ImageMenuPoint {
  x: number
  y: number
}

export type { AttachmentEditTarget } from './attachmentInsert'

const ATTACHMENT_RE =
  /!\[([^\]]*)\]\(attachment:([a-f0-9]{64})\.([a-z0-9]+)(?:\?size=([smf]))?\)/g

const urlResolved = StateEffect.define<void>()
const metaResolved = StateEffect.define<void>()
const resolvedUrls = new Map<string, string>()
const resolvedMeta = new Map<string, AttachmentPhotoMeta | null>()
const pendingFetches = new Map<string, Promise<string | null>>()
const pendingMetaFetches = new Map<string, Promise<AttachmentPhotoMeta | null>>()
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

function fetchAttachmentUrl(hash: string, ext: string): Promise<string | null> {
  const key = `${hash}.${ext}`
  if (resolvedUrls.has(key)) return Promise.resolve(resolvedUrls.get(key)!)

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
      view.dispatch({ effects: [urlResolved.of(undefined), metaResolved.of(undefined)] })
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
    wrap.title = 'Click for options · drag to move'
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
    }
    frame.append(media)

    const url = this.resolvedUrl
    if (url) {
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
      hint.textContent = this.caption ? 'options' : 'add caption'
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

class PendingAttachmentWidget extends WidgetType {
  constructor(readonly alt: string) {
    super()
  }

  eq(other: PendingAttachmentWidget): boolean {
    return other.alt === this.alt
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div')
    wrap.className = 'cm-attachment cm-attachment--uploading'
    wrap.contentEditable = 'false'
    wrap.setAttribute('aria-label', 'Uploading photo')

    const ph = document.createElement('div')
    ph.className = 'cm-attachment__placeholder'
    const label = document.createElement('span')
    label.className = 'cm-attachment__status'
    label.textContent = 'uploading…'
    ph.append(label)
    wrap.append(ph)
    return wrap
  }

  ignoreEvent(): boolean {
    return true
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

  PENDING_ATTACHMENT_REF_RE.lastIndex = 0
  let pending: RegExpExecArray | null
  while ((pending = PENDING_ATTACHMENT_REF_RE.exec(text)) !== null) {
    const [full, alt] = pending
    matches.push({
      from: pending.index,
      to: pending.index + full!.length,
      deco: Decoration.replace({
        widget: new PendingAttachmentWidget(alt ?? ''),
        block: true,
        inclusive: false,
      }),
    })
  }

  ATTACHMENT_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTACHMENT_RE.exec(text)) !== null) {
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
          resolvedUrls.get(key) ?? null,
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
    if (resolvedUrls.has(key)) continue
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
    return {
      update(u: ViewUpdate) {
        if (u.docChanged) {
          fetchMissingUrls(u.view)
          fetchMissingMeta(u.view)
        }
      },
      destroy() {
        activeViews.delete(view)
      },
    }
  })
}

function resolveAttachmentTarget(
  view: EditorView,
  blockEl: HTMLElement,
  clientX: number,
  clientY: number,
): AttachmentEditTarget | null {
  const doc = view.state.doc.toString()
  const pos = view.posAtCoords({ x: clientX, y: clientY })
  let target = pos === null ? null : findAttachmentAtPos(doc, pos)
  // Coords can land outside the ref range (a photo rendered tight against
  // another block widget); fall back to the clicked element's own key.
  if (!target && blockEl.dataset.attachmentKey) {
    target = findAttachmentByKey(doc, blockEl.dataset.attachmentKey)
  }
  return target
}

/**
 * A photo is an object, not text, so left- and right-click both open the same
 * options menu (anchored at the pointer). `dragstart` tags the transfer so the
 * drop handler can move the ref instead of treating it as a file drop.
 */
function attachmentMenuHandler(
  onMenu: (
    target: AttachmentEditTarget,
    point: ImageMenuPoint,
    anchor: InlinePanelAnchor,
  ) => void,
): Extension {
  const open = (event: MouseEvent, view: EditorView): boolean => {
    const blockEl = (event.target as HTMLElement | null)?.closest(
      '.cm-attachment--interactive',
    ) as HTMLElement | null
    if (!blockEl) return false
    const target = resolveAttachmentTarget(view, blockEl, event.clientX, event.clientY)
    if (!target) return false
    event.preventDefault()
    onMenu(target, { x: event.clientX, y: event.clientY }, computeBlockPanelAnchor(view, blockEl))
    return true
  }

  return EditorView.domEventHandlers({
    // A completed drag emits no `click`, so a plain handler won't fire mid-move.
    click(event, view) {
      if (event.button !== 0) return false
      return open(event, view)
    },
    contextmenu(event, view) {
      // Suppress the native browser menu on photos only; text keeps spellcheck.
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
  })
}

const attachmentTheme = EditorView.theme({
  '.cm-attachment': {
    display: 'block',
    margin: '0.6rem 0',
    lineHeight: '1',
  },
  '.cm-attachment--interactive': {
    cursor: 'pointer',
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
  '.cm-attachment--interactive:hover .cm-attachment__media': {
    boxShadow:
      '0 10px 26px -8px color-mix(in srgb, var(--photo-tint, #1a120a) 48%, transparent), inset 0 0 0 1px rgba(20, 12, 4, 0.07), 0 0 0 1px color-mix(in srgb, var(--accent) 34%, transparent)',
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
  '.cm-attachment--interactive:hover .cm-attachment__chrome': {
    opacity: '1',
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
  '.cm-attachment__status': {
    fontFamily: 'var(--font-editor)',
    fontSize: '0.7em',
    letterSpacing: '0.04em',
    textTransform: 'lowercase',
    color: 'var(--text-faint)',
  },
})

// ── Export ────────────────────────────────────────────────────────────────────

/** @param onMenu Called when the user left- or right-clicks a resolved photo block. */
export function attachmentImageExtension(
  onMenu?: (
    target: AttachmentEditTarget,
    point: ImageMenuPoint,
    anchor: InlinePanelAnchor,
  ) => void,
): Extension {
  return [
    attachmentTheme,
    attachmentDecoField,
    EditorView.atomicRanges.of((view) => view.state.field(attachmentDecoField)),
    attachmentInitPlugin(),
    ...(onMenu ? [attachmentMenuHandler(onMenu)] : []),
  ]
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
