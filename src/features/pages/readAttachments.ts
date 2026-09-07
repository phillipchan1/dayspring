import { formatPhotoMetaLine, isMeaningfulCaption } from '@/lib/attachmentCaption'
import { cropFor } from '@/lib/attachmentLayout'
import {
  ATTACHMENT_REF_RE,
  fetchAttachmentMeta,
  imageSizeFrom,
  resolveAttachmentDisplayUrl,
  type ImageSize,
} from '@/lib/attachments'
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
): () => void {
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
    const { hash, ext, size } = attachment
    const { figure, media, caption } = replaceWithFigure(img, size)

    void deps
      .resolve(hash!, ext!)
      .then(({ url, meta }) => {
        if (!alive || !figure.isConnected) return

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
          const metaLine = formatPhotoMetaLine(meta ?? undefined)
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
  }
}
