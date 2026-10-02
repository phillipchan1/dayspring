import { formatPhotoMetaLine, isMeaningfulCaption } from '@/lib/attachmentCaption'
import { cropFor } from '@/lib/attachmentLayout'
import {
  ATTACHMENT_REF_RE,
  fetchAttachmentMeta,
  imageSizeFrom,
  resolveAttachmentDisplayUrl,
  type ImageSize,
} from '@/lib/attachments'
import { mountPhotoRows, type PhotoRowsHandle } from '@/lib/photoRowsDom'
import { formatPhotoSetLine, photoRatio } from '@/lib/photoSet'
import { supabase } from '@/lib/supabase'

const ATTACHMENT_URL_RE =
  /^attachment:([a-f0-9]{64})\.([a-z0-9]+)(?:\?size=([smf]))?$/

interface ResolvedReadAttachment {
  url: string | null
  meta: Awaited<ReturnType<typeof fetchAttachmentMeta>>
}

export interface ReadAttachmentDeps {
  resolve: (hash: string, ext: string) => Promise<ResolvedReadAttachment>
}

/** A photo as the viewer shows it (features/photos/PhotoViewer). */
export interface ReadLookPhoto {
  key: string
  url: string | null
  caption: string
  takenAt?: string | undefined
  color?: string | undefined
}

export interface ReadAttachmentOptions {
  /**
   * Circumstance line for the first photo that has no writer caption —
   * the verso of a print. Later photos keep their own capture-time line.
   */
  verso?: string | null
  /**
   * Called when a photo is tapped: the photo, and the set it was put with.
   * Without it photos are not interactive at all.
   */
  onLook?: (photos: ReadLookPhoto[], index: number) => void
}

/** Make a photo's box open the viewer — by tap, click, or Return when focused. */
function makeLookable(el: HTMLElement, label: string, open: () => void): void {
  el.dataset.look = 'true'
  el.tabIndex = 0
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', label)
  el.addEventListener('click', (e) => {
    e.stopPropagation()
    open()
  })
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    open()
  })
}

const defaultDeps: ReadAttachmentDeps = {
  async resolve(hash, ext) {
    if (!supabase) return { url: null, meta: null }
    const { data } = await supabase.auth.getSession()
    const ownerId = data.session?.user?.id
    if (!ownerId) return { url: null, meta: null }
    const [url, meta] = await Promise.all([
      resolveAttachmentDisplayUrl(supabase, ownerId, hash, ext),
      fetchAttachmentMeta(supabase, ownerId, hash),
    ])
    return { url, meta }
  },
}

function replaceWithFigure(img: HTMLImageElement, size: ImageSize): {
  figure: HTMLElement
  media: HTMLElement
  caption: string | null
} {
  const doc = img.ownerDocument
  const source = img.parentElement
  const replaceParagraph =
    source?.tagName === 'P' &&
    source.children.length === 1 &&
    !(source.textContent ?? '').trim()
  const anchor = doc.createComment('attachment')
  source?.insertBefore(anchor, img)
  const alt = img.getAttribute('alt')?.trim() ?? ''
  const caption = isMeaningfulCaption(alt) ? alt : null
  const figure = doc.createElement('figure')
  figure.className = `pg-read1__photo pg-read1__photo--size-${size}`
  figure.dataset.loading = 'true'

  const media = doc.createElement('span')
  media.className = 'pg-read1__photo-media'
  figure.append(media)

  img.removeAttribute('src')
  img.className = 'pg-read1__photo-img'
  img.alt = caption ?? 'Photo'
  img.loading = 'lazy'
  img.draggable = false
  media.append(img)

  if (caption) {
    const cap = doc.createElement('figcaption')
    cap.className = 'pg-read1__photo-caption'
    cap.textContent = caption
    figure.append(cap)
  }

  // Marked renders a block attachment as a paragraph containing only the img.
  // Replace that paragraph so the figure remains valid block markup.
  if (replaceParagraph && source) {
    source.replaceWith(figure)
  } else {
    // Inline images are unusual in entries, but keep their original position.
    anchor.replaceWith(figure)
  }

  return { figure, media, caption }
}

interface ReadPhoto {
  img: HTMLImageElement
  hash: string
  ext: string
  size: ImageSize
}

/**
 * True when a paragraph holds these photos and nothing else — which is what
 * touching photo lines render as (the `<br>` is the single newline between
 * them). That paragraph is a set (lib/photoSet.ts).
 */
function isPhotoParagraph(p: HTMLElement, photos: ReadPhoto[]): boolean {
  if (photos.length < 2 || (p.textContent ?? '').trim()) return false
  const imgs = new Set<Element>(photos.map((photo) => photo.img))
  return [...p.children].every((child) => child.tagName === 'BR' || imgs.has(child))
}

/**
 * Draw a paragraph of photos as rows. The figure and a 4:3 stand-in layout are
 * installed at once; shapes and URLs settle together and re-flow it one time.
 */
function hydratePhotoSet(
  paragraph: HTMLElement,
  photos: ReadPhoto[],
  resolve: ReadAttachmentDeps['resolve'],
  verso: string | null,
  isAlive: () => boolean,
  onLook: ReadAttachmentOptions['onLook'],
): PhotoRowsHandle {
  const doc = paragraph.ownerDocument
  const figure = doc.createElement('figure')
  figure.className = 'pg-read1__photoset'
  const rows = doc.createElement('div')
  rows.className = 'pg-read1__photoset-rows'
  figure.append(rows)

  const tiles = photos.map(({ img }) => {
    const alt = img.getAttribute('alt')?.trim() ?? ''
    const caption = isMeaningfulCaption(alt) ? alt : null
    const tile = doc.createElement('span')
    tile.className = 'pg-read1__photoset-tile'
    tile.dataset.loading = 'true'
    img.removeAttribute('src')
    img.className = 'pg-read1__photoset-img'
    img.alt = caption ?? 'Photo'
    img.loading = 'lazy'
    img.draggable = false
    tile.append(img)
    if (caption) {
      const cap = doc.createElement('span')
      cap.className = 'pg-read1__photoset-caption'
      cap.textContent = caption
      tile.append(cap)
    }
    return tile
  })

  // What the viewer is handed. Filled in as the photos resolve; a tap before
  // then still opens it, on a photo that is still arriving.
  const look: ReadLookPhoto[] = photos.map(({ img, hash, ext }) => ({
    key: `${hash}.${ext}`,
    url: null,
    caption: img.alt === 'Photo' ? '' : img.alt,
  }))
  if (onLook) {
    tiles.forEach((tile, i) =>
      makeLookable(tile, look[i]!.caption || `Photo ${i + 1} of ${tiles.length}`, () => onLook(look, i)),
    )
  }

  paragraph.replaceWith(figure)
  const handle = mountPhotoRows(
    rows,
    tiles.map((el, i) => ({ el, ratio: photoRatio(), known: false, img: photos[i]!.img })),
    { rowClass: 'pg-read1__photoset-row' },
  )

  void Promise.all(
    photos.map(({ hash, ext }) => resolve(hash, ext).catch(() => ({ url: null, meta: null }))),
  ).then((results) => {
    if (!isAlive() || !figure.isConnected) return

    handle.setRatios(
      results.map(({ meta }) =>
        meta?.width && meta?.height ? photoRatio(meta.width, meta.height) : null,
      ),
    )

    const line = verso ?? formatPhotoSetLine(photos.length, results.map(({ meta }) => meta?.takenAt))
    const metaLine = doc.createElement('figcaption')
    metaLine.className = 'pg-read1__photo-meta pg-read1__photoset-meta'
    metaLine.textContent = line
    figure.append(metaLine)

    results.forEach(({ url, meta }, i) => {
      const tile = tiles[i]!
      const img = photos[i]!.img
      look[i] = { ...look[i]!, url, takenAt: meta?.takenAt, color: meta?.color }
      if (meta?.color) tile.style.backgroundColor = meta.color
      const settle = (state: 'ready' | 'error') => {
        if (!isAlive()) return
        delete tile.dataset.loading
        tile.dataset[state] = 'true'
      }
      if (!url) return settle('error')
      img.addEventListener('load', () => settle('ready'), { once: true })
      img.addEventListener('error', () => settle('error'), { once: true })
      img.src = url
      if (img.complete && img.naturalWidth > 0) settle('ready')
    })
  })

  return handle
}

/**
 * Turn private attachment refs in rendered markdown into stable read figures.
 *
 * The figure is installed synchronously. Metadata and the display URL settle
 * together, so width/height are reserved before the image starts decoding.
 * Returns a cancellation function for a reader that changed pages mid-flight.
 */
export function hydrateReadAttachments(
  root: HTMLElement,
  markdown: string,
  deps: ReadAttachmentDeps = defaultDeps,
  options: ReadAttachmentOptions = {},
): () => void {
  const resolve = deps?.resolve ?? defaultDeps.resolve
  let alive = true
  const images = [...root.querySelectorAll<HTMLImageElement>('img')]
  ATTACHMENT_REF_RE.lastIndex = 0
  const refs: { alt: string; hash: string; ext: string; size: ImageSize }[] = []
  let refMatch: RegExpExecArray | null
  while ((refMatch = ATTACHMENT_REF_RE.exec(markdown)) !== null) {
    refs.push({
      alt: refMatch[1]?.trim() ?? '',
      hash: refMatch[2]!,
      ext: refMatch[3]!,
      size: imageSizeFrom(refMatch[4]),
    })
  }
  ATTACHMENT_REF_RE.lastIndex = 0
  const usedRefs = new Set<number>()
  let firstPhoto = true
  const verso = options.verso?.trim() || null

  // Find the photos first: a set is known by its paragraph, and that has to be
  // read before any one photo is lifted out of it.
  const photos: ReadPhoto[] = []
  for (const img of images) {
    const raw = img.getAttribute('src') ?? ''
    const urlMatch = ATTACHMENT_URL_RE.exec(raw)
    let attachment:
      | { alt: string; hash: string; ext: string; size: ImageSize }
      | undefined
    if (urlMatch) {
      attachment = {
        alt: img.getAttribute('alt')?.trim() ?? '',
        hash: urlMatch[1]!,
        ext: urlMatch[2]!,
        size: imageSizeFrom(urlMatch[3]),
      }
    } else if (!raw) {
      // DOMPurify deliberately removes unknown URL schemes, including our
      // private `attachment:` scheme. Recover identity from the source
      // markdown, matching alt text first so ordinary sanitized images cannot
      // steal an attachment that follows them.
      const alt = img.getAttribute('alt')?.trim() ?? ''
      let refIndex = refs.findIndex((ref, index) => !usedRefs.has(index) && ref.alt === alt)
      if (refIndex < 0 && refs.length === 1 && !usedRefs.has(0)) refIndex = 0
      if (refIndex >= 0) {
        usedRefs.add(refIndex)
        attachment = refs[refIndex]
      }
    }
    if (!attachment) continue
    photos.push({ img, hash: attachment.hash, ext: attachment.ext, size: attachment.size })
  }

  const byParagraph = new Map<HTMLElement, ReadPhoto[]>()
  for (const photo of photos) {
    const p = photo.img.parentElement
    if (p?.tagName !== 'P') continue
    byParagraph.set(p, [...(byParagraph.get(p) ?? []), photo])
  }
  const inSet = new Set<ReadPhoto>()
  const setHandles: PhotoRowsHandle[] = []
  for (const [p, group] of byParagraph) {
    if (!isPhotoParagraph(p, group)) continue
    group.forEach((photo) => inSet.add(photo))
    const leads = firstPhoto && photos[0] === group[0]
    setHandles.push(
      hydratePhotoSet(p, group, resolve, leads ? verso : null, () => alive, options.onLook),
    )
  }

  for (const photo of photos) {
    if (inSet.has(photo)) {
      firstPhoto = false
      continue
    }
    const { img, hash, ext, size } = photo
    const { figure, media, caption } = replaceWithFigure(img, size)
    const isFirstPhoto = firstPhoto
    firstPhoto = false

    const look: ReadLookPhoto = { key: `${hash}.${ext}`, url: null, caption: caption ?? '' }
    const onLook = options.onLook
    if (onLook) makeLookable(media, caption ?? 'Photo', () => onLook([look], 0))

    void resolve(hash!, ext!)
      .then(({ url, meta }) => {
        if (!alive || !figure.isConnected) return

        look.url = url
        look.takenAt = meta?.takenAt
        look.color = meta?.color
        if (meta?.color) {
          figure.style.setProperty('--photo-tint', meta.color)
          media.style.backgroundColor = meta.color
        }
        if (meta?.width && meta?.height) {
          img.width = meta.width
          img.height = meta.height
          const crop = cropFor(size, meta.width, meta.height)
          if (crop) {
            figure.classList.add(
              crop.axis === 'height'
                ? 'pg-read1__photo--crop-h'
                : 'pg-read1__photo--crop-w',
            )
            media.style.aspectRatio = crop.aspect
          }
        }

        if (!caption) {
          const metaLine = (isFirstPhoto ? verso : null) ?? formatPhotoMetaLine(meta ?? undefined)
          if (metaLine) {
            const line = root.ownerDocument.createElement('figcaption')
            line.className = 'pg-read1__photo-meta'
            line.textContent = metaLine
            figure.append(line)
          }
        }

        if (!url) {
          delete figure.dataset.loading
          figure.dataset.error = 'true'
          return
        }

        img.addEventListener(
          'load',
          () => {
            if (!alive) return
            delete figure.dataset.loading
            figure.dataset.ready = 'true'
          },
          { once: true },
        )
        img.addEventListener(
          'error',
          () => {
            if (!alive) return
            delete figure.dataset.loading
            figure.dataset.error = 'true'
          },
          { once: true },
        )
        img.src = url
        if (img.complete && img.naturalWidth > 0) {
          delete figure.dataset.loading
          figure.dataset.ready = 'true'
        }
      })
      .catch(() => {
        if (!alive || !figure.isConnected) return
        delete figure.dataset.loading
        figure.dataset.error = 'true'
      })
  }

  return () => {
    alive = false
    setHandles.forEach((handle) => handle.destroy())
  }
}
